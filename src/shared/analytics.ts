/**
 * 匿名行为统计模块
 *
 * 隐私设计原则：
 * - 仅采集行为计数，不采集任何 prompt 内容
 * - 所有数据存储在本地 chrome.storage.local
 * - 用户可随时 opt-out
 * - 按日聚合，支持后续对接外部分析服务
 */

import type { OptimizationStrategy, TaskType } from './types';

/** 统计存储键 */
const ANALYTICS_KEY = 'prompt_enhancer_analytics';
const ANALYTICS_OPT_OUT_KEY = 'prompt_enhancer_analytics_opt_out';

/** 单次增强事件 */
export interface EnhanceEvent {
  /** 优化策略 */
  strategy: OptimizationStrategy;
  /** 任务类型 */
  taskType: TaskType;
  /** 目标站点域名（仅域名，不含路径） */
  siteDomain: string;
  /** 是否成功 */
  success: boolean;
}

/** 日聚合数据 */
export interface DailyStats {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 总增强次数 */
  totalEnhances: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failCount: number;
  /** 策略使用分布 */
  strategyDistribution: Record<string, number>;
  /** 任务类型分布 */
  taskTypeDistribution: Record<string, number>;
  /** 站点使用分布 */
  siteDistribution: Record<string, number>;
}

/** 聚合统计数据 */
export interface AnalyticsData {
  /** 按日聚合 */
  dailyStats: DailyStats[];
  /** 首次使用日期 */
  firstUsedDate: string;
  /** 总增强次数（历史累计） */
  lifetimeEnhances: number;
}

/**
 * 获取当前日期字符串
 * @returns YYYY-MM-DD 格式
 */
const getTodayKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * 创建空的日统计
 * @param date 日期字符串
 */
const createEmptyDailyStats = (date: string): DailyStats => ({
  date,
  totalEnhances: 0,
  successCount: 0,
  failCount: 0,
  strategyDistribution: {},
  taskTypeDistribution: {},
  siteDistribution: {},
});

/**
 * 检查用户是否 opt-out
 */
export const isAnalyticsOptedOut = async (): Promise<boolean> => {
  try {
    const result = await chrome.storage.local.get(ANALYTICS_OPT_OUT_KEY);
    return result[ANALYTICS_OPT_OUT_KEY] === true;
  } catch {
    return false;
  }
};

/**
 * 设置 opt-out 状态
 * @param optOut 是否禁用统计
 */
export const setAnalyticsOptOut = async (optOut: boolean): Promise<void> => {
  await chrome.storage.local.set({ [ANALYTICS_OPT_OUT_KEY]: optOut });
  if (optOut) {
    await chrome.storage.local.remove(ANALYTICS_KEY);
  }
};

/**
 * 获取当前统计数据
 */
export const getAnalyticsData = async (): Promise<AnalyticsData> => {
  try {
    const result = await chrome.storage.local.get(ANALYTICS_KEY);
    return (
      result[ANALYTICS_KEY] || {
        dailyStats: [],
        firstUsedDate: getTodayKey(),
        lifetimeEnhances: 0,
      }
    );
  } catch {
    return {
      dailyStats: [],
      firstUsedDate: getTodayKey(),
      lifetimeEnhances: 0,
    };
  }
};

/**
 * 记录一次增强事件
 * @param event 增强事件
 */
export const trackEnhanceEvent = async (event: EnhanceEvent): Promise<void> => {
  if (await isAnalyticsOptedOut()) return;

  try {
    const data = await getAnalyticsData();
    const today = getTodayKey();

    let todayStats = data.dailyStats.find(d => d.date === today);
    if (!todayStats) {
      todayStats = createEmptyDailyStats(today);
      data.dailyStats.push(todayStats);
    }

    todayStats.totalEnhances++;
    data.lifetimeEnhances++;

    if (event.success) {
      todayStats.successCount++;
    } else {
      todayStats.failCount++;
    }

    todayStats.strategyDistribution[event.strategy] =
      (todayStats.strategyDistribution[event.strategy] || 0) + 1;

    todayStats.taskTypeDistribution[event.taskType] =
      (todayStats.taskTypeDistribution[event.taskType] || 0) + 1;

    todayStats.siteDistribution[event.siteDomain] =
      (todayStats.siteDistribution[event.siteDomain] || 0) + 1;

    // 只保留最近 90 天数据，控制存储大小
    if (data.dailyStats.length > 90) {
      data.dailyStats = data.dailyStats.slice(-90);
    }

    if (!data.firstUsedDate) {
      data.firstUsedDate = today;
    }

    await chrome.storage.local.set({ [ANALYTICS_KEY]: data });
  } catch {
    // 统计失败不影响主流程
  }
};

/**
 * 获取汇总统计（供 popup 页面展示或对外上报）
 */
export const getAnalyticsSummary = async (): Promise<{
  lifetime: number;
  last7Days: number;
  last30Days: number;
  topStrategy: string | null;
  topTaskType: string | null;
  topSite: string | null;
  successRate: number;
}> => {
  const data = await getAnalyticsData();
  const today = new Date();

  let last7 = 0;
  let last30 = 0;
  const strategyTotals: Record<string, number> = {};
  const taskTypeTotals: Record<string, number> = {};
  const siteTotals: Record<string, number> = {};
  let totalSuccess = 0;
  let totalAll = 0;

  for (const day of data.dailyStats) {
    const dayDate = new Date(day.date);
    const diffDays = Math.floor(
      (today.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 7) last7 += day.totalEnhances;
    if (diffDays < 30) last30 += day.totalEnhances;

    totalSuccess += day.successCount;
    totalAll += day.totalEnhances;

    for (const [k, v] of Object.entries(day.strategyDistribution)) {
      strategyTotals[k] = (strategyTotals[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(day.taskTypeDistribution)) {
      taskTypeTotals[k] = (taskTypeTotals[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(day.siteDistribution)) {
      siteTotals[k] = (siteTotals[k] || 0) + v;
    }
  }

  const topOf = (obj: Record<string, number>): string | null => {
    const entries = Object.entries(obj);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  };

  return {
    lifetime: data.lifetimeEnhances,
    last7Days: last7,
    last30Days: last30,
    topStrategy: topOf(strategyTotals),
    topTaskType: topOf(taskTypeTotals),
    topSite: topOf(siteTotals),
    successRate: totalAll > 0 ? totalSuccess / totalAll : 0,
  };
};
