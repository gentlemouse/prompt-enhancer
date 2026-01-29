/**
 * 存储服务模块
 * P0-1.2: 安全的存储管理
 * - 使用 chrome.storage.local（不同步到云端）
 * - API Key 加密存储
 * - 自动迁移旧数据
 */

import type { StorageConfig, LegacyStorageConfig, APIProvider } from './types';
import { STORAGE_KEYS } from './constants';
import { encryptApiKey, decryptApiKey, isEncryptedFormat } from './utils/crypto';

/**
 * 从旧的 sync 存储迁移到新的 local 存储
 * P0-1.2: 数据迁移
 */
const migrateLegacyStorage = async (): Promise<void> => {
  try {
    // 检查是否有旧数据
    const legacyData = (await chrome.storage.sync.get([
      STORAGE_KEYS.LEGACY_API_KEY,
      STORAGE_KEYS.LEGACY_PROVIDER,
      STORAGE_KEYS.LEGACY_MODEL,
      STORAGE_KEYS.LEGACY_CUSTOM_ENDPOINT,
      STORAGE_KEYS.LEGACY_CUSTOM_MODEL,
    ])) as LegacyStorageConfig;

    // 如果存在旧的 API Key，进行迁移
    if (legacyData.apiKey) {
      const newConfig: StorageConfig = {
        apiProvider: (legacyData.apiProvider as APIProvider) || 'openai',
        encryptedApiKey: encryptApiKey(legacyData.apiKey),
        model: legacyData.model || '',
        customEndpoint: legacyData.customEndpoint || '',
        customModel: legacyData.customModel || '',
      };

      // 保存到 local 存储
      await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: newConfig });

      // 清除旧的 sync 存储中的敏感数据
      await chrome.storage.sync.remove([
        STORAGE_KEYS.LEGACY_API_KEY,
        STORAGE_KEYS.LEGACY_PROVIDER,
        STORAGE_KEYS.LEGACY_MODEL,
        STORAGE_KEYS.LEGACY_CUSTOM_ENDPOINT,
        STORAGE_KEYS.LEGACY_CUSTOM_MODEL,
      ]);
    }
  } catch {
    // 迁移失败不影响正常使用
  }
};

/**
 * 获取存储配置
 * @returns 存储配置（API Key 已解密）
 */
export const getStorageConfig = async (): Promise<{
  apiProvider: APIProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
  customModel: string;
  anthropicWarningAcknowledged?: boolean;
} | null> => {
  // 先尝试迁移旧数据
  await migrateLegacyStorage();

  // 从 local 存储读取
  const result = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
  const config = result[STORAGE_KEYS.CONFIG] as StorageConfig | undefined;

  if (!config || !config.encryptedApiKey) {
    return null;
  }

  // 解密 API Key
  let apiKey = config.encryptedApiKey;
  if (isEncryptedFormat(config.encryptedApiKey)) {
    apiKey = decryptApiKey(config.encryptedApiKey);
  }

  return {
    apiProvider: config.apiProvider,
    apiKey,
    model: config.model,
    customEndpoint: config.customEndpoint,
    customModel: config.customModel,
    anthropicWarningAcknowledged: config.anthropicWarningAcknowledged,
  };
};

/**
 * 保存存储配置
 * @param config 要保存的配置
 */
export const saveStorageConfig = async (config: {
  apiProvider: APIProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
  customModel: string;
  anthropicWarningAcknowledged?: boolean;
}): Promise<void> => {
  const storageConfig: StorageConfig = {
    apiProvider: config.apiProvider,
    encryptedApiKey: encryptApiKey(config.apiKey),
    model: config.model,
    customEndpoint: config.customEndpoint,
    customModel: config.customModel,
    anthropicWarningAcknowledged: config.anthropicWarningAcknowledged,
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: storageConfig });
};

/**
 * 清除所有存储的配置
 */
export const clearStorageConfig = async (): Promise<void> => {
  await chrome.storage.local.remove(STORAGE_KEYS.CONFIG);
};

/**
 * 检查是否已配置 API Key
 */
export const hasApiKey = async (): Promise<boolean> => {
  const config = await getStorageConfig();
  return !!config?.apiKey;
};

/**
 * 更新 Anthropic 安全警告确认状态
 */
export const acknowledgeAnthropicWarning = async (): Promise<void> => {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
  const config = result[STORAGE_KEYS.CONFIG] as StorageConfig | undefined;

  if (config) {
    config.anthropicWarningAcknowledged = true;
    await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });
  }
};
