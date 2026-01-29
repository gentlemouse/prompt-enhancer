/**
 * API 提供商适配器索引
 */

import type { APIProvider, PromptAnalysis } from '@shared/types';
import type { APIProviderAdapter, APICallOptions } from './types';
import { openaiAdapter, deepseekAdapter, createOpenAIAdapter } from './openai';
import { anthropicAdapter } from './anthropic';
import { streamOpenAI, streamAnthropic, type StreamCallback } from './streaming';
import { API_PROVIDERS } from '@shared/constants';

export type { APICallOptions, APIProviderAdapter, StreamCallback };

/** 提供商适配器映射 */
const adapters: Record<Exclude<APIProvider, 'custom'>, APIProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  deepseek: deepseekAdapter,
};

/**
 * 获取 API 提供商适配器
 * @param provider 提供商类型
 * @param customEndpoint 自定义端点（仅用于 custom 类型）
 */
export const getProviderAdapter = (
  provider: APIProvider,
  customEndpoint?: string
): APIProviderAdapter => {
  if (provider === 'custom' && customEndpoint) {
    return createOpenAIAdapter('Custom', customEndpoint);
  }

  return adapters[provider as Exclude<APIProvider, 'custom'>] || openaiAdapter;
};

/** 流式调用选项 */
export interface StreamingCallOptions {
  provider: APIProvider;
  apiKey: string;
  model: string;
  analysis: PromptAnalysis;
  customEndpoint?: string;
  onChunk: StreamCallback;
  onError: (error: Error) => void;
}

/**
 * 执行流式 API 调用
 * P2-3.2: 支持流式输出
 */
export const streamingCall = async (options: StreamingCallOptions): Promise<void> => {
  const { provider, apiKey, model, analysis, customEndpoint, onChunk, onError } = options;

  const endpoint =
    provider === 'custom'
      ? customEndpoint || ''
      : API_PROVIDERS[provider as Exclude<APIProvider, 'custom'>].endpoint;

  if (provider === 'anthropic') {
    await streamAnthropic({
      apiKey,
      model,
      analysis,
      endpoint,
      onChunk,
      onError,
    });
  } else {
    // OpenAI, DeepSeek, Custom 都使用 OpenAI 兼容格式
    await streamOpenAI({
      apiKey,
      model,
      analysis,
      endpoint,
      onChunk,
      onError,
    });
  }
};
