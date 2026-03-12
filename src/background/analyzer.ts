/**
 * Prompt 分析器模块
 *
 * 多维度特征检测 + 策略选择引擎
 * 根据当前输入的长度与结构特征动态选择优化策略
 */

import {
  type PromptAnalysis,
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

/** 极短直接执行型输入模式 */
const DIRECT_EXECUTION_SHORT_PATTERNS = [
  /^(你好|您好|哈喽|hello\b|hi\b|hey\b)/i,
  /^(帮我|请|请你|翻译|总结|概括|解释|介绍|分析|提取|列出|整理|改写|润色|写|生成)/,
  /^(please |translate|summari[sz]e|explain|introduce|analy[sz]e|extract|list |rewrite|polish|write|generate)/i,
  /^(what is|who is|how to|why |can you|could you|tell me)/i,
];

/**
 * 检测是否为修正/补充类指令
 */
const detectCorrection = (text: string): boolean => {
  return CORRECTION_PATTERNS.some(p => p.test(text.trim()));
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
 * 检测是否为“易被模型直接执行”的极短 prompt
 * 仅用于加强防误执行约束，不直接改变整体策略路由
 */
const detectDirectExecutionRisk = (
  prompt: string,
  taskType: TaskType
): boolean => {
  const trimmed = prompt.trim();
  if (!trimmed) return false;
  if (trimmed.length > 24) return false;

  if (/[?？]$/.test(trimmed)) return true;
  if (DIRECT_EXECUTION_SHORT_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return true;
  }

  // 极短非闲聊任务常常是可直接执行的命令句，如“翻译成英文”“写个函数”
  if (trimmed.length <= 12 && taskType !== TaskType.CHAT) {
    return true;
  }

  return false;
};

// ==========================================================
//  策略选择引擎
// ==========================================================

/**
 * 选择优化策略
 * 优先级：修正/补充 > 轻润色 > 微调锐化 > 结构化重写
 */
const selectStrategy = (
  length: number,
  isCorrection: boolean,
  hasGoodStructure: boolean
): OptimizationStrategy => {
  // 1. 修正/补充类 → 约束追加
  if (isCorrection) return OptimizationStrategy.CONSTRAINT_APPEND;

  // 2. 极短指令（<30字）→ 轻润色
  if (length < 30) return OptimizationStrategy.LIGHT_POLISH;

  // 3. 已有良好结构 → 微调锐化
  if (hasGoodStructure) return OptimizationStrategy.SHARPEN;

  // 4. 默认 → 结构化重写
  return OptimizationStrategy.STRUCTURAL_REWRITE;
};

// ==========================================================
//  主分析函数
// ==========================================================

/**
 * 分析 Prompt 并确定优化策略
 * @param prompt 用户输入的原始 Prompt
 * @returns 分析结果
 */
export const analyzePrompt = (prompt: string): PromptAnalysis => {
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
  const hasCode =
    /```|`[^`]+`|function\s|def\s|class\s|import\s|const\s|let\s|var\s/.test(
      prompt
    );
  const hasFormatRequest = /json|xml|markdown|表格|列表|格式|yaml/.test(text);
  const hasMultipleQuestions = (prompt.match(/[?？]/g) || []).length > 1;
  const hasNumberedList = /\d+[.、)）]/.test(prompt);

  // --- 多维特征检测 ---
  const isCorrection = detectCorrection(prompt);
  const hasGoodStructure = detectGoodStructure(prompt);
  const hasDirectExecutionRisk = detectDirectExecutionRisk(
    prompt,
    detectedType
  );

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
  const strategy = selectStrategy(length, isCorrection, hasGoodStructure);

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
    isCorrection,
    hasGoodStructure,
    hasDirectExecutionRisk,
  };
};
