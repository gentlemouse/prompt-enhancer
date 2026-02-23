/**
 * 免费试用管理模块
 *
 * 提供试用额度的存储、查询与消费能力。
 * 数据存储在 chrome.storage.local，仅在代理模式下计数。
 */

import { STORAGE_KEYS, TRIAL_MAX_USES } from './constants';

/** 试用状态枚举 */
export type TrialState = 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED' | 'API_CONFIGURED';

/** 试用数据接口 */
export interface TrialData {
  /** 最大免费次数 */
  maxUses: number;
  /** 已使用次数 */
  usedCount: number;
  /** 首次安装时间 */
  installedAt: string;
  /** 每次使用的时间戳（用于防滥用） */
  usageTimestamps: number[];
}

/**
 * 获取试用数据
 */
export const getTrialData = async (): Promise<TrialData> => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TRIAL_DATA);
    return (
      result[STORAGE_KEYS.TRIAL_DATA] || {
        maxUses: TRIAL_MAX_USES,
        usedCount: 0,
        installedAt: new Date().toISOString(),
        usageTimestamps: [],
      }
    );
  } catch {
    return {
      maxUses: TRIAL_MAX_USES,
      usedCount: 0,
      installedAt: new Date().toISOString(),
      usageTimestamps: [],
    };
  }
};

/**
 * 递增试用使用计数
 * @returns 更新后的试用数据
 */
export const incrementTrialUsage = async (): Promise<TrialData> => {
  const data = await getTrialData();
  data.usedCount++;
  data.usageTimestamps.push(Date.now());

  // 只保留最近 20 条时间戳，避免数据膨胀
  if (data.usageTimestamps.length > 20) {
    data.usageTimestamps = data.usageTimestamps.slice(-20);
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.TRIAL_DATA]: data });
  return data;
};

/**
 * 获取剩余试用次数
 */
export const getTrialRemaining = async (): Promise<number> => {
  const data = await getTrialData();
  return Math.max(0, data.maxUses - data.usedCount);
};

/**
 * 检查试用是否已过期
 */
export const isTrialExpired = async (): Promise<boolean> => {
  const data = await getTrialData();
  return data.usedCount >= data.maxUses;
};
