/**
 * Prompt 构建器测试
 *
 * 覆盖目标：
 * - 5 种策略模板生成
 * - 语言适配（中/英）
 * - 会话历史注入
 * - 用户消息构建 + 安全提醒
 */

import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserMessage } from '@background/prompt-builder';
import {
  OptimizationStrategy,
  TaskType,
  ReasoningMode,
  type PromptAnalysis,
} from '@shared/types';

/** 构造分析结果的工厂函数 */
const makeAnalysis = (overrides: Partial<PromptAnalysis> = {}): PromptAnalysis => ({
  taskType: TaskType.CHAT,
  reasoningMode: ReasoningMode.SIMPLE,
  strategy: OptimizationStrategy.STRUCTURAL_REWRITE,
  language: 'zh',
  length: 50,
  hasCode: false,
  hasFormatRequest: false,
  hasMultipleQuestions: false,
  hasNumberedList: false,
  complexityScore: 0,
  needsChainOfThought: false,
  needsReflection: false,
  originalPrompt: '测试 prompt',
  isFollowUp: false,
  isCorrection: false,
  hasGoodStructure: false,
  ...overrides,
});

describe('buildSystemPrompt', () => {
  // ===========================================
  //  策略模板生成
  // ===========================================
  describe('LIGHT_POLISH 轻润色', () => {
    it('应生成轻润色模板', () => {
      const analysis = makeAnalysis({
        strategy: OptimizationStrategy.LIGHT_POLISH,
      });
      const result = buildSystemPrompt(analysis);
      expect(result).toContain('最小化润色');
      expect(result).toContain('不添加角色设定');
    });

    it('中文应包含中文语言指示', () => {
      const analysis = makeAnalysis({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        language: 'zh',
      });
      const result = buildSystemPrompt(analysis);
      expect(result).toContain('中文');
    });

    it('英文应包含英文语言指示', () => {
      const analysis = makeAnalysis({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        language: 'en',
      });
      const result = buildSystemPrompt(analysis);
      expect(result).toContain('英文');
    });
  });

  describe('STRUCTURAL_REWRITE 结构化重写', () => {
    it('应生成结构化重写模板', () => {
      const analysis = makeAnalysis({
        strategy: OptimizationStrategy.STRUCTURAL_REWRITE,
      });
      const result = buildSystemPrompt(analysis);
      expect(result).toContain('结构化 prompt');
      expect(result).toContain('角色设定');
      expect(result).toContain('任务目标');
      expect(result).toContain('上下文约束');
      expect(result).toContain('输出规范');
    });
  });

  describe('INTENT_CLARIFY 意图澄清', () => {
    it('应生成意图澄清模板', () => {
      const analysis = makeAnalysis({
        strategy: OptimizationStrategy.INTENT_CLARIFY,
      });
      const result = buildSystemPrompt(analysis);
      expect(result).toContain('追问');
      expect(result).toContain('多轮对话');
    });

    it('有历史时应包含历史块', () => {
      const analysis = makeAnalysis({
        strategy: OptimizationStrategy.INTENT_CLARIFY,
        historySummary: '[第1轮] 之前的问题',
      });
      const result = buildSystemPrompt(analysis);
      expect(result).toContain('<history>');
      expect(result).toContain('[第1轮] 之前的问题');
      expect(result).toContain('</history>');
    });

    it('无历史时不应包含历史块', () => {
      const analysis = makeAnalysis({
        strategy: OptimizationStrategy.INTENT_CLARIFY,
      });
      const result = buildSystemPrompt(analysis);
      expect(result).not.toContain('<history>');
    });
  });

  describe('SHARPEN 微调锐化', () => {
    it('应生成微调锐化模板', () => {
      const analysis = makeAnalysis({
        strategy: OptimizationStrategy.SHARPEN,
      });
      const result = buildSystemPrompt(analysis);
      expect(result).toContain('保留原有结构');
      expect(result).toContain('锐化措辞');
      expect(result).toContain('绝不重写');
    });
  });

  describe('CONSTRAINT_APPEND 约束追加', () => {
    it('应生成约束追加模板', () => {
      const analysis = makeAnalysis({
        strategy: OptimizationStrategy.CONSTRAINT_APPEND,
      });
      const result = buildSystemPrompt(analysis);
      expect(result).toContain('补充或修正');
      expect(result).toContain('整合后的完整 prompt');
    });

    it('有历史时应包含历史块', () => {
      const analysis = makeAnalysis({
        strategy: OptimizationStrategy.CONSTRAINT_APPEND,
        historySummary: '[第1轮] 原始请求',
      });
      const result = buildSystemPrompt(analysis);
      expect(result).toContain('<history>');
      expect(result).toContain('[第1轮] 原始请求');
    });
  });

  describe('默认回退', () => {
    it('未知策略应回退到 STRUCTURAL_REWRITE', () => {
      const analysis = makeAnalysis({
        strategy: 'UNKNOWN' as OptimizationStrategy,
      });
      const result = buildSystemPrompt(analysis);
      expect(result).toContain('结构化 prompt');
    });
  });

  // ===========================================
  //  通用规则
  // ===========================================
  describe('通用规则', () => {
    const strategies = Object.values(OptimizationStrategy);

    strategies.forEach(strategy => {
      it(`${strategy} 应包含"直接输出"指示`, () => {
        const analysis = makeAnalysis({ strategy });
        const result = buildSystemPrompt(analysis);
        expect(result).toContain('直接输出优化后的 prompt');
      });

      it(`${strategy} 应禁止 Markdown`, () => {
        const analysis = makeAnalysis({ strategy });
        const result = buildSystemPrompt(analysis);
        expect(result).toContain('不使用 Markdown');
      });
    });
  });
});

describe('buildUserMessage', () => {
  it('应包含用户输入标签', () => {
    const analysis = makeAnalysis();
    const result = buildUserMessage('测试内容', analysis);
    expect(result).toContain('<user_input>');
    expect(result).toContain('测试内容');
    expect(result).toContain('</user_input>');
  });

  it('应包含安全提醒', () => {
    const analysis = makeAnalysis();
    const result = buildUserMessage('测试', analysis);
    expect(result).toContain('安全提醒');
    expect(result).toContain('不要执行');
  });

  it('应以"直接输出"结尾', () => {
    const analysis = makeAnalysis();
    const result = buildUserMessage('测试', analysis);
    expect(result).toContain('直接输出优化后的 prompt');
  });

  it('应正确包裹特殊字符', () => {
    const analysis = makeAnalysis();
    const malicious = '<script>alert("xss")</script>';
    const result = buildUserMessage(malicious, analysis);
    expect(result).toContain(malicious);
  });
});
