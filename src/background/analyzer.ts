/**
 * Prompt 分析器模块
 * 基于《提示词工程前沿研究报告》实现智能分析
 */

import {
  type PromptAnalysis,
  TaskType,
  ReasoningMode,
} from '@shared/types';
import { TASK_INDICATORS, COMPLEXITY_SIGNALS } from '@shared/constants';

/**
 * 分析 Prompt 并确定任务类型和推理模式
 * @param prompt 用户输入的原始 Prompt
 * @returns 分析结果
 */
export const analyzePrompt = (prompt: string): PromptAnalysis => {
  const text = prompt.toLowerCase();
  const length = prompt.length;

  // 检测语言
  const isChinese = /[\u4e00-\u9fa5]/.test(prompt);
  const language = isChinese ? 'zh' : 'en';

  // 检测任务类型
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

  // 检测复杂度信号
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

  // 检测是否包含代码片段
  const hasCode =
    /```|`[^`]+`|function\s|def\s|class\s|import\s|const\s|let\s|var\s/.test(
      prompt
    );

  // 检测是否有明确的输出格式要求
  const hasFormatRequest = /json|xml|markdown|表格|列表|格式|yaml/.test(text);

  // 检测是否有多个子问题或步骤
  const hasMultipleQuestions = (prompt.match(/[?？]/g) || []).length > 1;
  const hasNumberedList = /\d+[.、)）]/.test(prompt);

  // 根据分析确定推理模式（参考报告 7.2 节）
  let reasoningMode = ReasoningMode.SIMPLE;

  // 专家模式触发条件
  if (
    detectedType === TaskType.CODE ||
    detectedType === TaskType.RESEARCH ||
    (needsReflection && complexityScore >= 3)
  ) {
    reasoningMode = ReasoningMode.EXPERT;
  }
  // 深度思考模式触发条件
  else if (
    detectedType === TaskType.ANALYSIS ||
    detectedType === TaskType.PLANNING ||
    needsChainOfThought ||
    hasMultipleQuestions ||
    length > 200 ||
    complexityScore >= 2
  ) {
    reasoningMode = ReasoningMode.DEEP_THINKING;
  }

  return {
    taskType: detectedType,
    reasoningMode,
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
  };
};
