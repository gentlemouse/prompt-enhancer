/**
 * Prompt 增强服务
 * 协调分析、构建和 API 调用
 */

import { analyzePrompt } from './analyzer';
import { getProviderAdapter, streamingCall } from './providers';
import { getStorageConfig } from '@shared/storage';
import { API_PROVIDERS } from '@shared/constants';
import type { APIProvider, HistoryItem } from '@shared/types';

/**
 * 获取配置和模型
 */
const getConfigAndModel = async (): Promise<{
  config: NonNullable<Awaited<ReturnType<typeof getStorageConfig>>>;
  model: string;
}> => {
  const config = await getStorageConfig();

  if (!config?.apiKey) {
    throw new Error('请先在插件设置中配置 API Key');
  }

  const provider = config.apiProvider || 'openai';
  const model =
    config.model ||
    (provider === 'custom'
      ? config.customModel
      : API_PROVIDERS[provider as Exclude<APIProvider, 'custom'>]?.defaultModel);

  if (!model) {
    throw new Error('请配置模型名称');
  }

  return { config, model };
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
  const { config, model } = await getConfigAndModel();
  const provider = config.apiProvider || 'openai';

  // 分析 Prompt（传入会话历史）
  const analysis = analyzePrompt(originalPrompt, history);

  // 获取适配器并调用
  const adapter = getProviderAdapter(provider, config.customEndpoint);

  return adapter.call({
    apiKey: config.apiKey,
    model,
    prompt: originalPrompt,
    analysis,
    endpoint: provider === 'custom' ? config.customEndpoint : undefined,
  });
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
    const { config, model } = await getConfigAndModel();
    const provider = config.apiProvider || 'openai';

    // 分析 Prompt（传入会话历史）
    const analysis = analyzePrompt(originalPrompt, history);

    // 流式调用
    await streamingCall({
      provider,
      apiKey: config.apiKey,
      model,
      analysis,
      customEndpoint: config.customEndpoint,
      onChunk: (chunk, done) => {
        if (done) {
          chrome.tabs.sendMessage(tabId, {
            action: 'streamEnd',
            requestId,
          });
        } else {
          chrome.tabs.sendMessage(tabId, {
            action: 'streamChunk',
            requestId,
            chunk,
          });
        }
      },
      onError: error => {
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
