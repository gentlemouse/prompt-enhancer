/**
 * Prompt 增强服务
 * 协调分析、构建和 API 调用
 */

import { analyzePrompt } from './analyzer';
import { getProviderAdapter, streamingCall } from './providers';
import { getStorageConfig } from '@shared/storage';
import { API_PROVIDERS } from '@shared/constants';
import { trackEnhanceEvent } from '@shared/analytics';
import { normalizeAnthropicModel } from '@shared/provider-models';
import {
  isTrialExpired,
  incrementTrialUsage,
  syncQuotaFromServer,
} from '@shared/trial';
import { TRIAL_EXPIRED_ERROR, getQuotaBlockReason } from '@shared/quota-errors';
import { isByokConfigured } from '@shared/mode';
import type { APIProvider } from '@shared/types';

/**
 * 安全发送消息到 content script
 * content script 丢失/页面切换时，消息发送失败不应中断后台流程
 */
const safeSendToTab = async (
  tabId: number,
  message: Record<string, unknown>
): Promise<void> => {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // 忽略发送失败（可能是页面已刷新或脚本已卸载）
  }
};

/**
 * 更新扩展图标上的试用额度 Badge
 * 当前已禁用 — 试用信息仅在 Popup 设置界面展示
 */
export const updateTrialBadge = async (): Promise<void> => {
  chrome.action.setBadgeText({ text: '' });
};

/**
 * 代理模式收到服务端额度耗尽后，立即回写本地额度状态。
 */
const syncQuotaAfterProxyFailure = async (
  isProxyMode: boolean,
  error: unknown
): Promise<void> => {
  if (!isProxyMode || getQuotaBlockReason(error) !== 'free_quota_exhausted') {
    return;
  }

  await syncQuotaFromServer();
  await updateTrialBadge();
};

/**
 * 代理模式的回退配置
 * 用户未配置 API Key 时，自动使用免费代理
 */
const PROXY_FALLBACK = {
  apiProvider: 'proxy' as APIProvider,
  apiKey: 'proxy-mode',
  model: API_PROVIDERS.proxy.defaultModel,
  customEndpoint: API_PROVIDERS.proxy.endpoint,
  customModel: '',
};

/**
 * 获取配置和模型
 * 未配置 API Key 时自动降级到代理模式，并检查试用额度
 */
const getConfigAndModel = async (): Promise<{
  config: NonNullable<Awaited<ReturnType<typeof getStorageConfig>>>;
  model: string;
  isProxyMode: boolean;
}> => {
  const config = await getStorageConfig();

  if (!isByokConfigured(config)) {
    if (await isTrialExpired()) {
      throw new Error(TRIAL_EXPIRED_ERROR);
    }
    return {
      config: PROXY_FALLBACK,
      model: PROXY_FALLBACK.model,
      isProxyMode: true,
    };
  }

  const provider = config.apiProvider || 'openai';
  const model =
    config.model ||
    (provider === 'custom'
      ? config.customModel
      : API_PROVIDERS[provider as Exclude<APIProvider, 'custom' | 'proxy'>]
          ?.defaultModel);

  if (!model) {
    throw new Error(chrome.i18n.getMessage('errorConfigModel'));
  }

  return {
    config,
    model: provider === 'anthropic' ? normalizeAnthropicModel(model) : model,
    isProxyMode: false,
  };
};

/**
 * 增强 Prompt（非流式）
 * @param originalPrompt 原始 Prompt
 * @returns 增强后的 Prompt
 */
export const enhancePrompt = async (
  originalPrompt: string
): Promise<string> => {
  const { config, model, isProxyMode } = await getConfigAndModel();
  const provider = config.apiProvider || 'openai';

  const analysis = analyzePrompt(originalPrompt);
  const adapter = getProviderAdapter(provider, config.customEndpoint, {
    anthropicRelayEnabled: config.anthropicRelayEnabled,
  });

  try {
    const result = await adapter.call({
      apiKey: config.apiKey,
      model,
      prompt: originalPrompt,
      analysis,
      endpoint: provider === 'custom' ? config.customEndpoint : undefined,
      anthropicRelayEnabled: config.anthropicRelayEnabled,
    });

    trackEnhanceEvent({
      strategy: analysis.strategy,
      taskType: analysis.taskType,
      siteDomain: 'background',
      success: true,
    });

    if (isProxyMode) {
      await incrementTrialUsage();
      updateTrialBadge();
    }

    return result;
  } catch (error) {
    await syncQuotaAfterProxyFailure(isProxyMode, error);
    trackEnhanceEvent({
      strategy: analysis.strategy,
      taskType: analysis.taskType,
      siteDomain: 'background',
      success: false,
    });
    throw error;
  }
};

/**
 * 增强 Prompt（流式）
 * @param originalPrompt 原始 Prompt
 * @param tabId 标签页 ID
 * @param requestId 请求 ID
 */
export const enhancePromptStreaming = async (
  originalPrompt: string,
  tabId: number,
  requestId: string
): Promise<void> => {
  try {
    const { config, model, isProxyMode } = await getConfigAndModel();
    const provider = config.apiProvider || 'openai';

    const analysis = analyzePrompt(originalPrompt);
    let receivedContent = false;

    await streamingCall({
      provider,
      apiKey: config.apiKey,
      model,
      analysis,
      customEndpoint: config.customEndpoint,
      onChunk: async (chunk, done) => {
        if (done) {
          void trackEnhanceEvent({
            strategy: analysis.strategy,
            taskType: analysis.taskType,
            siteDomain: 'streaming',
            success: receivedContent,
          });

          const endMessage: Record<string, unknown> = {
            action: 'streamEnd',
            requestId,
          };

          if (isProxyMode && receivedContent) {
            try {
              const trialData = await incrementTrialUsage();
              endMessage.trialRemaining =
                trialData.maxUses - trialData.usedCount;
              endMessage.trialTotal = trialData.maxUses;
              void updateTrialBadge();
            } catch {
              // 额度写入失败不应阻塞用户结果展示
            }
          }

          await safeSendToTab(tabId, endMessage);
        } else {
          receivedContent = true;
          await safeSendToTab(tabId, {
            action: 'streamChunk',
            requestId,
            chunk,
          });
        }
      },
      onError: error => {
        void syncQuotaAfterProxyFailure(isProxyMode, error);
        void trackEnhanceEvent({
          strategy: analysis.strategy,
          taskType: analysis.taskType,
          siteDomain: 'streaming',
          success: false,
        });
        void safeSendToTab(tabId, {
          action: 'streamError',
          requestId,
          error: error.message,
        });
      },
    });
  } catch (error) {
    void safeSendToTab(tabId, {
      action: 'streamError',
      requestId,
      error:
        error instanceof Error
          ? error.message
          : chrome.i18n.getMessage('statusUnknownError') || 'Unknown error',
    });
  }
};
