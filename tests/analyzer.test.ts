/**
 * Prompt 分析器测试
 *
 * 覆盖目标：
 * - 8 种任务类型识别
 * - 3 级推理模式判定
 * - 5 种策略选择逻辑
 * - 追问/修正/结构检测
 * - 会话历史摘要
 */

import { describe, it, expect } from 'vitest';
import { analyzePrompt } from '@background/analyzer';
import {
  TaskType,
  ReasoningMode,
  OptimizationStrategy,
  type HistoryItem,
} from '@shared/types';

describe('analyzePrompt', () => {
  // ===========================================
  //  语言检测
  // ===========================================
  describe('语言检测', () => {
    it('应识别中文', () => {
      const result = analyzePrompt('帮我写一段代码');
      expect(result.language).toBe('zh');
    });

    it('应识别英文', () => {
      const result = analyzePrompt('Write me a function');
      expect(result.language).toBe('en');
    });

    it('中英混合时应识别为中文', () => {
      const result = analyzePrompt('帮我写一个 Python script');
      expect(result.language).toBe('zh');
    });
  });

  // ===========================================
  //  任务类型检测
  // ===========================================
  describe('任务类型检测', () => {
    it('CODE：包含编程关键词', () => {
      const result = analyzePrompt('帮我写一个 Python 排序算法函数');
      expect(result.taskType).toBe(TaskType.CODE);
    });

    it('WRITING：包含写作关键词', () => {
      const result = analyzePrompt('帮我写一篇关于人工智能的文章');
      expect(result.taskType).toBe(TaskType.WRITING);
    });

    it('ANALYSIS：包含分析关键词', () => {
      const result = analyzePrompt('分析一下这个市场趋势的原因和影响');
      expect(result.taskType).toBe(TaskType.ANALYSIS);
    });

    it('EXTRACTION：包含提取关键词', () => {
      const result = analyzePrompt('从以下文本中提取关键信息并总结要点');
      expect(result.taskType).toBe(TaskType.EXTRACTION);
    });

    it('QA：包含问答关键词', () => {
      const result = analyzePrompt('什么是机器学习？请解释这个概念');
      expect(result.taskType).toBe(TaskType.QA);
    });

    it('PLANNING：包含规划关键词', () => {
      const result = analyzePrompt('设计一个系统架构方案，包含详细步骤和流程');
      expect(result.taskType).toBe(TaskType.PLANNING);
    });

    it('RESEARCH：包含研究关键词', () => {
      const result = analyzePrompt('研究一下最新的论文关于强化学习的实验');
      expect(result.taskType).toBe(TaskType.RESEARCH);
    });

    it('CHAT：无明显任务关键词', () => {
      const result = analyzePrompt('你好，今天天气怎么样');
      expect(result.taskType).toBe(TaskType.CHAT);
    });

    it('英文 CODE 识别', () => {
      const result = analyzePrompt(
        'Implement a binary search algorithm in JavaScript'
      );
      expect(result.taskType).toBe(TaskType.CODE);
    });

    it('多关键词时应选择得分最高的类型', () => {
      const result = analyzePrompt(
        '帮我写一个 Python 函数来实现算法，用于代码性能优化和调试'
      );
      expect(result.taskType).toBe(TaskType.CODE);
    });
  });

  // ===========================================
  //  推理模式判定
  // ===========================================
  describe('推理模式判定', () => {
    it('CODE 类型应为 EXPERT 模式', () => {
      const result = analyzePrompt('写一个排序算法');
      expect(result.reasoningMode).toBe(ReasoningMode.EXPERT);
    });

    it('RESEARCH 类型应为 EXPERT 模式', () => {
      const result = analyzePrompt('研究一下这篇论文的实验方法');
      expect(result.reasoningMode).toBe(ReasoningMode.EXPERT);
    });

    it('ANALYSIS 类型应为 DEEP_THINKING 模式', () => {
      const result = analyzePrompt('深入分析这个问题的原因');
      expect(result.reasoningMode).toBe(ReasoningMode.DEEP_THINKING);
    });

    it('PLANNING 类型应为 DEEP_THINKING 模式', () => {
      const result = analyzePrompt('设计一个详细的项目计划方案');
      expect(result.taskType).toBe(TaskType.PLANNING);
      expect(result.reasoningMode).toBe(ReasoningMode.DEEP_THINKING);
    });

    it('简短闲聊应为 SIMPLE 模式', () => {
      const result = analyzePrompt('你好');
      expect(result.reasoningMode).toBe(ReasoningMode.SIMPLE);
    });

    it('包含思维链信号应为 DEEP_THINKING', () => {
      const result = analyzePrompt('让我们一步一步推理这个问题');
      expect(result.reasoningMode).toBe(ReasoningMode.DEEP_THINKING);
    });

    it('多问号应触发 DEEP_THINKING', () => {
      const result = analyzePrompt('这是什么？为什么会这样？如何解决？');
      expect(result.reasoningMode).toBe(ReasoningMode.DEEP_THINKING);
    });

    it('长文本应触发 DEEP_THINKING', () => {
      const longPrompt = '这是一段'.repeat(60);
      const result = analyzePrompt(longPrompt);
      expect(result.reasoningMode).toBe(ReasoningMode.DEEP_THINKING);
    });

    it('高复杂度 + 反思信号应为 EXPERT', () => {
      const result = analyzePrompt(
        '请用最佳实践、最优方案来详细全面地设计一个健壮可靠的系统'
      );
      expect(result.reasoningMode).toBe(ReasoningMode.EXPERT);
    });
  });

  // ===========================================
  //  策略选择引擎
  // ===========================================
  describe('策略选择引擎', () => {
    it('修正指令应选择 CONSTRAINT_APPEND', () => {
      const history: HistoryItem[] = [
        { text: '写一个函数', timestamp: Date.now() - 30000 },
      ];
      const result = analyzePrompt('加上错误处理', history);
      expect(result.strategy).toBe(OptimizationStrategy.CONSTRAINT_APPEND);
      expect(result.isCorrection).toBe(true);
    });

    it('"不要"类指令应选择 CONSTRAINT_APPEND', () => {
      const result = analyzePrompt('不要使用递归');
      expect(result.strategy).toBe(OptimizationStrategy.CONSTRAINT_APPEND);
    });

    it('"替换"类指令应选择 CONSTRAINT_APPEND', () => {
      const result = analyzePrompt('替换掉原来的实现');
      expect(result.strategy).toBe(OptimizationStrategy.CONSTRAINT_APPEND);
    });

    it('追问应选择 INTENT_CLARIFY', () => {
      const history: HistoryItem[] = [
        { text: '介绍一下 React', timestamp: Date.now() - 30000 },
      ];
      const result = analyzePrompt('那 Vue 呢', history);
      expect(result.strategy).toBe(OptimizationStrategy.INTENT_CLARIFY);
      expect(result.isFollowUp).toBe(true);
    });

    it('短文本（<50字）应选择 LIGHT_POLISH', () => {
      const result = analyzePrompt('翻译成英文');
      expect(result.strategy).toBe(OptimizationStrategy.LIGHT_POLISH);
    });

    it('已有良好结构应选择 SHARPEN', () => {
      const prompt = `角色：你是一个高级前端工程师
任务：帮我审查以下代码并提出优化建议
要求：关注性能和可维护性，给出具体的代码修改方案`;
      const result = analyzePrompt(prompt);
      expect(result.strategy).toBe(OptimizationStrategy.SHARPEN);
      expect(result.hasGoodStructure).toBe(true);
    });

    it('长文本无结构应选择 STRUCTURAL_REWRITE', () => {
      const prompt =
        '我想要做一个电商网站，需要有用户注册登录功能，' +
        '商品展示列表，购物车，支付功能，还要能管理订单，' +
        '发货物流追踪也要有，请帮我做一个完整的方案';
      const result = analyzePrompt(prompt);
      expect(result.strategy).toBe(OptimizationStrategy.STRUCTURAL_REWRITE);
    });

    it('修正优先于追问', () => {
      const history: HistoryItem[] = [
        { text: '之前的内容', timestamp: Date.now() - 30000 },
      ];
      const result = analyzePrompt('添加一个新字段', history);
      expect(result.strategy).toBe(OptimizationStrategy.CONSTRAINT_APPEND);
    });
  });

  // ===========================================
  //  追问检测
  // ===========================================
  describe('追问检测', () => {
    it('无历史时不应检测为追问', () => {
      const result = analyzePrompt('那这个怎么处理');
      expect(result.isFollowUp).toBe(false);
    });

    it('以追问关键词开头且有历史应检测为追问', () => {
      const history: HistoryItem[] = [
        { text: '前面的问题', timestamp: Date.now() - 30000 },
      ];
      const result = analyzePrompt('具体怎么实现', history);
      expect(result.isFollowUp).toBe(true);
    });

    it('短文本 + 时间间隔短应检测为追问', () => {
      const history: HistoryItem[] = [
        { text: '前面的问题', timestamp: Date.now() - 60000 },
      ];
      const result = analyzePrompt('好的', history);
      expect(result.isFollowUp).toBe(true);
    });

    it('短文本 + 时间间隔长不应检测为追问', () => {
      const history: HistoryItem[] = [
        { text: '很久之前的问题', timestamp: Date.now() - 10 * 60 * 1000 },
      ];
      const result = analyzePrompt('一段全新的较长内容来确保不被判为追问');
      expect(result.isFollowUp).toBe(false);
    });

    it('英文追问关键词应被检测', () => {
      const history: HistoryItem[] = [
        { text: 'Previous question', timestamp: Date.now() - 30000 },
      ];
      const result = analyzePrompt('Can you elaborate on that?', history);
      expect(result.isFollowUp).toBe(true);
    });
  });

  // ===========================================
  //  结构检测
  // ===========================================
  describe('结构检测', () => {
    it('命中 2+ 个结构标记应判定为良好结构', () => {
      const result = analyzePrompt('角色：专家\n任务：分析数据\n这是详细的长文本内容需要超过50字符');
      expect(result.hasGoodStructure).toBe(true);
    });

    it('仅 1 个结构标记不应判定为良好结构', () => {
      const result = analyzePrompt('角色：专家\n然后帮我做一些事情');
      expect(result.hasGoodStructure).toBe(false);
    });

    it('英文结构标记应被检测', () => {
      const result = analyzePrompt(
        'Role: Expert developer\nTask: Review code\nConstraints: Follow best practices and ensure quality output'
      );
      expect(result.hasGoodStructure).toBe(true);
    });

    it('"You are" + "Task:" 应触发结构检测', () => {
      const result = analyzePrompt(
        'You are an AI assistant.\nTask: Help me with something important and complex'
      );
      expect(result.hasGoodStructure).toBe(true);
    });
  });

  // ===========================================
  //  特征检测
  // ===========================================
  describe('特征检测', () => {
    it('应检测代码块', () => {
      const result = analyzePrompt('解释这段代码 ```const x = 1;```');
      expect(result.hasCode).toBe(true);
    });

    it('应检测格式请求', () => {
      const result = analyzePrompt('把结果输出为 json 格式');
      expect(result.hasFormatRequest).toBe(true);
    });

    it('应检测多问题', () => {
      const result = analyzePrompt('这是什么？为什么这样？怎么解决？');
      expect(result.hasMultipleQuestions).toBe(true);
    });

    it('应检测编号列表', () => {
      const result = analyzePrompt('1. 第一步\n2. 第二步');
      expect(result.hasNumberedList).toBe(true);
    });

    it('应记录原始 prompt', () => {
      const original = '测试 prompt';
      const result = analyzePrompt(original);
      expect(result.originalPrompt).toBe(original);
    });

    it('应记录文本长度', () => {
      const text = '这是测试';
      const result = analyzePrompt(text);
      expect(result.length).toBe(text.length);
    });
  });

  // ===========================================
  //  会话历史摘要
  // ===========================================
  describe('会话历史摘要', () => {
    it('无历史时应返回 undefined', () => {
      const result = analyzePrompt('测试');
      expect(result.historySummary).toBeUndefined();
    });

    it('有历史时应生成摘要', () => {
      const history: HistoryItem[] = [
        { text: '第一轮问题', timestamp: Date.now() - 60000 },
        { text: '第二轮问题', timestamp: Date.now() - 30000 },
      ];
      const result = analyzePrompt('第三轮问题', history);
      expect(result.historySummary).toContain('[第1轮]');
      expect(result.historySummary).toContain('[第2轮]');
    });

    it('长文本应被截断', () => {
      const longText = 'a'.repeat(200);
      const history: HistoryItem[] = [
        { text: longText, timestamp: Date.now() - 30000 },
      ];
      const result = analyzePrompt('追问', history);
      expect(result.historySummary).toContain('...');
    });

    it('超过 3 条历史只取最近 3 条', () => {
      const history: HistoryItem[] = [
        { text: '第一条', timestamp: Date.now() - 120000 },
        { text: '第二条', timestamp: Date.now() - 90000 },
        { text: '第三条', timestamp: Date.now() - 60000 },
        { text: '第四条', timestamp: Date.now() - 30000 },
      ];
      const result = analyzePrompt('追问', history);
      expect(result.historySummary).not.toContain('第一条');
      expect(result.historySummary).toContain('第四条');
    });
  });

  // ===========================================
  //  复杂度评估
  // ===========================================
  describe('复杂度评估', () => {
    it('简单文本应低复杂度', () => {
      const result = analyzePrompt('你好');
      expect(result.complexityScore).toBe(0);
    });

    it('包含复杂度信号应提高分数', () => {
      const result = analyzePrompt('请详细全面深入地分析这个问题');
      expect(result.complexityScore).toBeGreaterThan(0);
    });

    it('包含思维链信号应设置 needsChainOfThought', () => {
      const result = analyzePrompt('让我们一步一步推理论证');
      expect(result.needsChainOfThought).toBe(true);
    });

    it('包含反思信号应设置 needsReflection', () => {
      const result = analyzePrompt('给出最佳最优的高质量方案');
      expect(result.needsReflection).toBe(true);
    });
  });
});
