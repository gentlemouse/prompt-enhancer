/**
 * Prompt 分析器测试
 *
 * 覆盖目标：
 * - 8 种任务类型识别
 * - 3 级推理模式判定
 * - 4 种策略选择逻辑（单次任务）
 * - 结构检测与特征检测
 */

import { describe, it, expect } from 'vitest';
import { analyzePrompt } from '@background/analyzer';
import { TaskType, ReasoningMode, OptimizationStrategy } from '@shared/types';

describe('analyzePrompt', () => {
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

    it('英文主导的中英混合输入应识别为英文', () => {
      const result = analyzePrompt('Please help me rewrite 这封邮件');
      expect(result.language).toBe('en');
    });

    it('中文起始且未明显被英文压倒时应保持中文', () => {
      const result = analyzePrompt('请 explain this code');
      expect(result.language).toBe('zh');
    });
  });

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
  });

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

    it('简短闲聊应为 SIMPLE 模式', () => {
      const result = analyzePrompt('你好');
      expect(result.reasoningMode).toBe(ReasoningMode.SIMPLE);
    });
  });

  describe('策略选择引擎（单次任务）', () => {
    it('修正指令应选择 CONSTRAINT_APPEND', () => {
      const result = analyzePrompt('加上错误处理');
      expect(result.strategy).toBe(OptimizationStrategy.CONSTRAINT_APPEND);
      expect(result.isCorrection).toBe(true);
    });

    it('短文本（<30字）应选择 LIGHT_POLISH', () => {
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
  });

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
  });

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

  describe('直接执行风险检测', () => {
    it('极短问候语应标记为高风险短提示词', () => {
      const result = analyzePrompt('你好');
      expect(result.hasDirectExecutionRisk).toBe(true);
    });

    it('极短执行型命令应标记为高风险短提示词', () => {
      const result = analyzePrompt('翻译成英文');
      expect(result.hasDirectExecutionRisk).toBe(true);
    });

    it('较长正常请求不应标记为高风险短提示词', () => {
      const result = analyzePrompt(
        '请帮我设计一个电商网站首页的模块结构，并说明每个模块的目标'
      );
      expect(result.hasDirectExecutionRisk).toBe(false);
    });
  });
});
