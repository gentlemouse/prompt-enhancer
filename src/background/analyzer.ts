/**
 * Prompt 分析器模块
 *
 * 多维度特征检测 + 策略选择引擎
 * 根据输入长度、结构特征、上下文信号动态选择优化策略
 */

import {
  type PromptAnalysis,
  type HistoryItem,
  TaskType,
  ReasoningMode,
  OptimizationStrategy,
} from '@shared/types';
import { TASK_INDICATORS, COMPLEXITY_SIGNALS } from '@shared/constants';

// ==========================================================
//  特征检测
// ==========================================================

/** 修正/补充类关键词（中英） */
const CORRECTION_PATTERNS = [
  /^(加上|添加|补充|修改|改为|改成|去掉|删除|移除|换成|替换)/,
  /^(另外|还要|还需要|同时|并且|而且|除此之外)/,
  /^(不要|别|避免|禁止)/,
  /^(add|remove|change|replace|also|don't|avoid|include|exclude)/i,
];

/** 追问类关键词 */
const FOLLOWUP_PATTERNS = [
  /^(那|那么|所以|然后|接着|继续|请问|那个)/,
  /^(具体|详细|展开|深入|进一步|更多|再|多)/,
  /^(上面|上述|之前|刚才|前面|第[一二三四五六七八九十\d]+[点条个项])/,
  /^(what about|how about|can you|could you|please also|and |also )/i,
  /^(more |further |elaborate|expand|continue|go on)/i,
];

/** 已有良好结构的检测（用户自己写了结构化 prompt） */
const STRUCTURE_MARKERS = [
  /角色[：:]/,
  /任务[：:]/,
  /背景[：:]/,
  /上下文[：:]/,
  /约束[：:]/,
  /输出[格式要求]*[：:]/,
  /要求[：:]/,
  /目标[：:]/,
  /role[：:]/i,
  /task[：:]/i,
  /context[：:]/i,
  /constraints?[：:]/i,
  /output[：:]/i,
  /instructions?[：:]/i,
  /you are /i,
  /act as /i,
  /作为一[个名位]/,
  /你是一[个名位]/,
];

/**
 * 检测是否为修正/补充类指令
 */
const detectCorrection = (text: string): boolean => {
  return CORRECTION_PATTERNS.some(p => p.test(text.trim()));
};

/**
 * 检测是否为追问
 * @param text 当前输入
 * @param history 会话历史
 */
const detectFollowUp = (text: string, history: HistoryItem[]): boolean => {
  // 无历史则不可能是追问
  if (history.length === 0) return false;

  const trimmed = text.trim();

  // 模式 1：以追问关键词开头
  if (FOLLOWUP_PATTERNS.some(p => p.test(trimmed))) return true;

  // 模式 2：极短文本（<50字）且与上一条时间间隔短（<3分钟）
  const lastItem = history[history.length - 1];
  const timeDiff = Date.now() - lastItem.timestamp;
  if (trimmed.length < 50 && timeDiff < 3 * 60 * 1000) return true;

  return false;
};

/**
 * 检测是否已有良好结构
 */
const detectGoodStructure = (text: string): boolean => {
  let markerCount = 0;
  for (const marker of STRUCTURE_MARKERS) {
    if (marker.test(text)) markerCount++;
  }
  // 命中 2 个以上结构标记 → 用户已写了结构化 prompt
  return markerCount >= 2;
};

/**
 * 生成会话历史摘要
 * @param history 会话历史
 */
const buildHistorySummary = (history: HistoryItem[]): string | undefined => {
  if (history.length === 0) return undefined;

  // 取最近 3 条，每条截取前 80 字
  const recent = history.slice(-3);
  const lines = recent.map((item, i) => {
    const preview = item.text.length > 80
      ? item.text.substring(0, 80) + '...'
      : item.text;
    return `[第${i + 1}轮] ${preview}`;
  });

  return lines.join('\n');
};

// ==========================================================
//  策略选择引擎
// ==========================================================

/**
 * 选择优化策略
 * 优先级：修正/补充 > 追问 > 轻润色 > 微调锐化 > 结构化重写
 */
const selectStrategy = (
  _text: string,
  length: number,
  isFollowUp: boolean,
  isCorrection: boolean,
  hasGoodStructure: boolean
): OptimizationStrategy => {
  // 1. 修正/补充类 → 约束追加
  if (isCorrection) return OptimizationStrategy.CONSTRAINT_APPEND;

  // 2. 多轮追问 → 意图澄清
  if (isFollowUp) return OptimizationStrategy.INTENT_CLARIFY;

  // 3. 简短指令（<50字）且意图明确 → 轻润色
  if (length < 50) return OptimizationStrategy.LIGHT_POLISH;

  // 4. 已有良好结构 → 微调锐化
  if (hasGoodStructure) return OptimizationStrategy.SHARPEN;

  // 5. 默认 → 结构化重写
  return OptimizationStrategy.STRUCTURAL_REWRITE;
};

// ==========================================================
//  主分析函数
// ==========================================================

/**
 * 分析 Prompt 并确定优化策略
 * @param prompt 用户输入的原始 Prompt
 * @param history 会话历史（来自 session-memory）
 * @returns 分析结果
 */
export const analyzePrompt = (
  prompt: string,
  history: HistoryItem[] = []
): PromptAnalysis => {
  const text = prompt.toLowerCase();
  const length = prompt.length;

  // --- 语言检测 ---
  const isChinese = /[\u4e00-\u9fa5]/.test(prompt);
  const language = isChinese ? 'zh' : 'en';

  // --- 任务类型检测 ---
  let detectedType: TaskType = TaskType.CHAT;
  let maxScore = 0;

  for (const [type, keywords] of Object.entries(TASK_INDICATORS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += keyword.length > 3 ? 2 : 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      detectedType = type as TaskType;
    }
  }

  // --- 复杂度信号检测 ---
  let complexityScore = 0;
  let needsChainOfThought = false;
  let needsReflection = false;

  for (const signal of COMPLEXITY_SIGNALS.HIGH) {
    if (text.includes(signal.toLowerCase())) complexityScore += 2;
  }
  for (const signal of COMPLEXITY_SIGNALS.CHAIN_OF_THOUGHT) {
    if (text.includes(signal.toLowerCase())) {
      needsChainOfThought = true;
      complexityScore += 1;
    }
  }
  for (const signal of COMPLEXITY_SIGNALS.REFLECTION) {
    if (text.includes(signal.toLowerCase())) {
      needsReflection = true;
      complexityScore += 1;
    }
  }

  // --- 结构特征检测 ---
  const hasCode = /```|`[^`]+`|function\s|def\s|class\s|import\s|const\s|let\s|var\s/.test(prompt);
  const hasFormatRequest = /json|xml|markdown|表格|列表|格式|yaml/.test(text);
  const hasMultipleQuestions = (prompt.match(/[?？]/g) || []).length > 1;
  const hasNumberedList = /\d+[.、)）]/.test(prompt);

  // --- 多维特征检测 ---
  const isFollowUp = detectFollowUp(prompt, history);
  const isCorrection = detectCorrection(prompt);
  const hasGoodStructure = detectGoodStructure(prompt);

  // --- 推理模式 ---
  let reasoningMode = ReasoningMode.SIMPLE;
  if (
    detectedType === TaskType.CODE ||
    detectedType === TaskType.RESEARCH ||
    (needsReflection && complexityScore >= 3)
  ) {
    reasoningMode = ReasoningMode.EXPERT;
  } else if (
    detectedType === TaskType.ANALYSIS ||
    detectedType === TaskType.PLANNING ||
    needsChainOfThought ||
    hasMultipleQuestions ||
    length > 200 ||
    complexityScore >= 2
  ) {
    reasoningMode = ReasoningMode.DEEP_THINKING;
  }

  // --- 策略选择 ---
  const strategy = selectStrategy(
    prompt,
    length,
    isFollowUp,
    isCorrection,
    hasGoodStructure
  );

  // --- 会话历史摘要 ---
  const historySummary = buildHistorySummary(history);

  return {
    taskType: detectedType,
    reasoningMode,
    strategy,
    language,
    length,
    hasCode,
    hasFormatRequest,
    hasMultipleQuestions,
    hasNumberedList,
    complexityScore,
    needsChainOfThought,
    needsReflection,
    originalPrompt: prompt,
    isFollowUp,
    isCorrection,
    hasGoodStructure,
    historySummary,
  };
};
