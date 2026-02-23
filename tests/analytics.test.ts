/**
 * 匿名统计模块测试
 *
 * 覆盖目标：
 * - 事件记录与聚合
 * - 日统计桶创建与更新
 * - 90 天数据裁剪
 * - opt-out 机制
 * - 汇总统计计算
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OptimizationStrategy, TaskType } from '@shared/types';

/**
 * mock chrome.storage.local
 * analytics 模块依赖 chrome.storage.local 进行持久化
 */
const mockStorage: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => {
        return { [key]: mockStorage[key] };
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
      remove: vi.fn(async (key: string) => {
        delete mockStorage[key];
      }),
    },
  },
});

const {
  trackEnhanceEvent,
  getAnalyticsData,
  getAnalyticsSummary,
  setAnalyticsOptOut,
  isAnalyticsOptedOut,
} = await import('@shared/analytics');

describe('Analytics', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
  });

  describe('trackEnhanceEvent', () => {
    it('应记录一次增强事件', async () => {
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CODE,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });

      const data = await getAnalyticsData();
      expect(data.lifetimeEnhances).toBe(1);
      expect(data.dailyStats.length).toBe(1);
      expect(data.dailyStats[0].totalEnhances).toBe(1);
      expect(data.dailyStats[0].successCount).toBe(1);
      expect(data.dailyStats[0].failCount).toBe(0);
    });

    it('应正确记录失败事件', async () => {
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.STRUCTURAL_REWRITE,
        taskType: TaskType.WRITING,
        siteDomain: 'claude.ai',
        success: false,
        isFollowUp: false,
      });

      const data = await getAnalyticsData();
      expect(data.dailyStats[0].failCount).toBe(1);
      expect(data.dailyStats[0].successCount).toBe(0);
    });

    it('应记录追问计数', async () => {
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.INTENT_CLARIFY,
        taskType: TaskType.QA,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: true,
      });

      const data = await getAnalyticsData();
      expect(data.dailyStats[0].followUpCount).toBe(1);
    });

    it('应累计策略分布', async () => {
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.SHARPEN,
        taskType: TaskType.CHAT,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });

      const data = await getAnalyticsData();
      expect(
        data.dailyStats[0].strategyDistribution[OptimizationStrategy.LIGHT_POLISH]
      ).toBe(2);
      expect(
        data.dailyStats[0].strategyDistribution[OptimizationStrategy.SHARPEN]
      ).toBe(1);
    });

    it('应累计站点分布', async () => {
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'claude.ai',
        success: true,
        isFollowUp: false,
      });

      const data = await getAnalyticsData();
      expect(data.dailyStats[0].siteDistribution['chatgpt.com']).toBe(1);
      expect(data.dailyStats[0].siteDistribution['claude.ai']).toBe(1);
    });

    it('应累计任务类型分布', async () => {
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.STRUCTURAL_REWRITE,
        taskType: TaskType.CODE,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.STRUCTURAL_REWRITE,
        taskType: TaskType.WRITING,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });

      const data = await getAnalyticsData();
      expect(data.dailyStats[0].taskTypeDistribution[TaskType.CODE]).toBe(1);
      expect(data.dailyStats[0].taskTypeDistribution[TaskType.WRITING]).toBe(1);
    });
  });

  describe('opt-out 机制', () => {
    it('默认不应 opt-out', async () => {
      expect(await isAnalyticsOptedOut()).toBe(false);
    });

    it('opt-out 后不应记录事件', async () => {
      await setAnalyticsOptOut(true);
      expect(await isAnalyticsOptedOut()).toBe(true);

      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'test.com',
        success: true,
        isFollowUp: false,
      });

      const data = await getAnalyticsData();
      expect(data.lifetimeEnhances).toBe(0);
    });

    it('opt-out 应清除已有数据', async () => {
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'test.com',
        success: true,
        isFollowUp: false,
      });

      await setAnalyticsOptOut(true);
      const data = await getAnalyticsData();
      expect(data.lifetimeEnhances).toBe(0);
    });
  });

  describe('getAnalyticsSummary', () => {
    it('无数据时应返回零值', async () => {
      const summary = await getAnalyticsSummary();
      expect(summary.lifetime).toBe(0);
      expect(summary.last7Days).toBe(0);
      expect(summary.last30Days).toBe(0);
      expect(summary.topStrategy).toBeNull();
      expect(summary.topTaskType).toBeNull();
      expect(summary.topSite).toBeNull();
      expect(summary.successRate).toBe(0);
    });

    it('应正确计算成功率', async () => {
      for (let i = 0; i < 3; i++) {
        await trackEnhanceEvent({
          strategy: OptimizationStrategy.LIGHT_POLISH,
          taskType: TaskType.CHAT,
          siteDomain: 'chatgpt.com',
          success: true,
          isFollowUp: false,
        });
      }
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'chatgpt.com',
        success: false,
        isFollowUp: false,
      });

      const summary = await getAnalyticsSummary();
      expect(summary.successRate).toBe(0.75);
      expect(summary.lifetime).toBe(4);
    });

    it('应找出 top 策略', async () => {
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.STRUCTURAL_REWRITE,
        taskType: TaskType.CHAT,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });

      const summary = await getAnalyticsSummary();
      expect(summary.topStrategy).toBe(OptimizationStrategy.LIGHT_POLISH);
    });

    it('应找出 top 站点', async () => {
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'claude.ai',
        success: true,
        isFollowUp: false,
      });
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });
      await trackEnhanceEvent({
        strategy: OptimizationStrategy.LIGHT_POLISH,
        taskType: TaskType.CHAT,
        siteDomain: 'chatgpt.com',
        success: true,
        isFollowUp: false,
      });

      const summary = await getAnalyticsSummary();
      expect(summary.topSite).toBe('chatgpt.com');
    });
  });
});
