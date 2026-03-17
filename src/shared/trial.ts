/**
 * 免费试用管理模块
 *
 * 提供试用额度的存储、查询与消费能力。
 *
 * 防白嫖策略：
 * - 数据同时存储在 chrome.storage.local 和 chrome.storage.sync
 * - sync 绑定 Google 账号，卸载重装后自动恢复已用计数
 * - 取两端的 max(usedCount) 防止回退
 */

import { STORAGE_KEYS, TRIAL_MAX_USES, API_PROVIDERS } from './constants';
import { fetchWithFreeSession } from './free-session';

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

/** 默认试用数据 */
const defaultTrialData = (): TrialData => ({
  maxUses: TRIAL_MAX_USES,
  usedCount: 0,
  installedAt: new Date().toISOString(),
  usageTimestamps: [],
});

/**
 * 获取试用数据
 * 从 local 和 sync 两端读取，取 max(usedCount) 防止通过重装回退
 */
export const getTrialData = async (): Promise<TrialData> => {
  try {
    const [localResult, syncResult] = await Promise.all([
      chrome.storage.local.get(STORAGE_KEYS.TRIAL_DATA),
      chrome.storage.sync
        .get(STORAGE_KEYS.TRIAL_DATA)
        .catch(
          () =>
            ({ [STORAGE_KEYS.TRIAL_DATA]: undefined }) as Record<
              string,
              TrialData | undefined
            >
        ),
    ]);

    const localData: TrialData =
      localResult[STORAGE_KEYS.TRIAL_DATA] || defaultTrialData();
    const syncData: TrialData | undefined = syncResult[STORAGE_KEYS.TRIAL_DATA];

    if (!syncData) {
      chrome.storage.sync
        .set({ [STORAGE_KEYS.TRIAL_DATA]: localData })
        .catch(() => {});
      return localData;
    }

    if (syncData.usedCount > localData.usedCount) {
      await chrome.storage.local.set({ [STORAGE_KEYS.TRIAL_DATA]: syncData });
      return syncData;
    }

    if (localData.usedCount > syncData.usedCount) {
      chrome.storage.sync
        .set({ [STORAGE_KEYS.TRIAL_DATA]: localData })
        .catch(() => {});
    }

    return localData;
  } catch {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TRIAL_DATA);
      return result[STORAGE_KEYS.TRIAL_DATA] || defaultTrialData();
    } catch {
      return defaultTrialData();
    }
  }
};

/**
 * 递增试用使用计数
 * 同时写入 local 和 sync
 * @returns 更新后的试用数据
 */
export const incrementTrialUsage = async (): Promise<TrialData> => {
  const data = await getTrialData();
  data.usedCount++;
  data.usageTimestamps.push(Date.now());

  if (data.usageTimestamps.length > 20) {
    data.usageTimestamps = data.usageTimestamps.slice(-20);
  }

  await Promise.all([
    chrome.storage.local.set({ [STORAGE_KEYS.TRIAL_DATA]: data }),
    chrome.storage.sync
      .set({ [STORAGE_KEYS.TRIAL_DATA]: data })
      .catch(() => {}),
  ]);
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

/**
 * 从服务端同步真实已用额度
 *
 * 解决的问题：开发者模式下卸载重装会清空 chrome.storage，
 * 导致客户端显示 0 已用。通过查询服务端 IP hash + 设备指纹
 * 的实际计数来校准本地数据。
 *
 * 调用时机：Service Worker 启动时、Popup 打开时、收到服务端额度耗尽后
 */
export const syncQuotaFromServer = async (): Promise<void> => {
  try {
    const proxyEndpoint = API_PROVIDERS.proxy.endpoint;
    const quotaUrl = proxyEndpoint.replace('/v1/enhance', '/v1/quota');
    const response = await fetchWithFreeSession(
      quotaUrl,
      {
        method: 'GET',
      },
      5000
    );

    if (!response.ok) return;

    const serverData = (await response.json()) as {
      limit: number;
      used: number;
      remaining: number;
    };

    const localData = await getTrialData();
    const nextUsedCount = Math.max(localData.usedCount, serverData.used);
    const nextMaxUses =
      serverData.limit > 0
        ? Math.max(localData.maxUses, serverData.limit)
        : localData.maxUses;

    if (
      nextUsedCount === localData.usedCount &&
      nextMaxUses === localData.maxUses
    ) {
      return;
    }

    localData.usedCount = nextUsedCount;
    localData.maxUses = nextMaxUses;

    await Promise.all([
      chrome.storage.local.set({ [STORAGE_KEYS.TRIAL_DATA]: localData }),
      chrome.storage.sync
        .set({ [STORAGE_KEYS.TRIAL_DATA]: localData })
        .catch(() => {}),
    ]);
  } catch {
    // 网络不可用时静默失败，不影响首次安装默认额度
  }
};
