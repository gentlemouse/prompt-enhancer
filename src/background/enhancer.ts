/**
 * Prompt 增强服务
 * 协调分析、构建和 API 调用
 */

import { analyzePrompt } from './analyzer';
import { getProviderAdapter, streamingCall } from './providers';
import { getStorageConfig } from '@shared/storage';
import { API_PROVIDERS } from '@shared/constants';
import { trackEnhanceEvent } from '@shared/analytics';
import { isTrialExpired, incrementTrialUsage } from '@shared/trial';
import type { APIProvider, HistoryItem } from '@shared/types';

/**
 * 更新扩展图标上的试用额度 Badge
 */
export const updateTrialBadge = async (): Promise<void> => {
  try {
    const config = await getStorageConfig();
    if (config?.apiKey) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    const { getTrialRemaining } = await import('@shared/trial');
    const remaining = await getTrialRemaining();

    if (remaining <= 0) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
    } else if (remaining <= 3) {
      chrome.action.setBadgeText({ text: String(remaining) });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    } else {
      chrome.action.setBadgeText({ text: String(remaining) });
      chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    }
  } catch {
    // Badge 更新失败不影响主流程
  }
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

  if (!config?.apiKey) {
    if (await isTrialExpired()) {
      throw new Error('TRIAL_EXPIRED');
    }
    return { config: PROXY_FALLBACK, model: PROXY_FALLBACK.model, isProxyMode: true };
  }

  const provider = config.apiProvider || 'openai';
  const model =
    config.model ||
    (provider === 'custom'
      ? config.customModel
      : API_PROVIDERS[provider as Exclude<APIProvider, 'custom' | 'proxy'>]?.defaultModel);

  if (!model) {
    throw new Error(chrome.i18n.getMessage('errorConfigModel'));
  }

  return { config, model, isProxyMode: false };
};

/**
 * 增强 Prompt（非流式）
 * @param originalPrompt 原始 Prompt
 * @param history 会话历史
 * @returns 增强后的 Prompt
 */
export const enhancePrompt = async (
  originalPrompt: string,
  history: HistoryItem[] = []
): Promise<string> => {
  const { config, model, isProxyMode } = await getConfigAndModel();
  const provider = config.apiProvider || 'openai';

  const analysis = analyzePrompt(originalPrompt, history);
  const adapter = getProviderAdapter(provider, config.customEndpoint);

  try {
    const result = await adapter.call({
      apiKey: config.apiKey,
      model,
      prompt: originalPrompt,
      analysis,
      endpoint: provider === 'custom' ? config.customEndpoint : undefined,
    });

    trackEnhanceEvent({
      strategy: analysis.strategy,
      taskType: analysis.taskType,
      siteDomain: 'background',
      success: true,
      isFollowUp: analysis.isFollowUp,
    });

    if (isProxyMode) {
      await incrementTrialUsage();
      updateTrialBadge();
    }

    return result;
  } catch (error) {
    trackEnhanceEvent({
      strategy: analysis.strategy,
      taskType: analysis.taskType,
      siteDomain: 'background',
      success: false,
      isFollowUp: analysis.isFollowUp,
    });
    throw error;
  }
};

/**
 * 增强 Prompt（流式）
 * @param originalPrompt 原始 Prompt
 * @param tabId 标签页 ID
 * @param requestId 请求 ID
 * @param history 会话历史
 */
export const enhancePromptStreaming = async (
  originalPrompt: string,
  tabId: number,
  requestId: string,
  history: HistoryItem[] = []
): Promise<void> => {
  try {
    const { config, model, isProxyMode } = await getConfigAndModel();
    const provider = config.apiProvider || 'openai';

    const analysis = analyzePrompt(originalPrompt, history);

    await streamingCall({
      provider,
      apiKey: config.apiKey,
      model,
      analysis,
      customEndpoint: config.customEndpoint,
      onChunk: async (chunk, done) => {
        if (done) {
          trackEnhanceEvent({
            strategy: analysis.strategy,
            taskType: analysis.taskType,
            siteDomain: 'streaming',
            success: true,
            isFollowUp: analysis.isFollowUp,
          });

          if (isProxyMode) {
            const trialData = await incrementTrialUsage();
            const remaining = trialData.maxUses - trialData.usedCount;
            updateTrialBadge();
            chrome.tabs.sendMessage(tabId, {
              action: 'streamEnd',
              requestId,
              trialRemaining: remaining,
              trialTotal: trialData.maxUses,
            });
          } else {
            chrome.tabs.sendMessage(tabId, {
              action: 'streamEnd',
              requestId,
            });
          }
        } else {
          chrome.tabs.sendMessage(tabId, {
            action: 'streamChunk',
            requestId,
            chunk,
          });
        }
      },
      onError: error => {
        trackEnhanceEvent({
          strategy: analysis.strategy,
          taskType: analysis.taskType,
          siteDomain: 'streaming',
          success: false,
          isFollowUp: analysis.isFollowUp,
        });
        chrome.tabs.sendMessage(tabId, {
          action: 'streamError',
          requestId,
          error: error.message,
        });
      },
    });
  } catch (error) {
    chrome.tabs.sendMessage(tabId, {
      action: 'streamError',
      requestId,
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
};
