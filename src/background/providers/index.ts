/**
 * API 提供商适配器索引
 */

import type { APIProvider, PromptAnalysis } from '@shared/types';
import type { APIProviderAdapter, APICallOptions } from './types';
import {
  openaiAdapter,
  deepseekAdapter,
  geminiAdapter,
  kimiAdapter,
  minimaxAdapter,
  qwenAdapter,
  zhipuAdapter,
  createOpenAIAdapter,
} from './openai';
import { anthropicDirectAdapter, anthropicRelayAdapter } from './anthropic';
import {
  streamOpenAI,
  streamAnthropic,
  type StreamCallback,
} from './streaming';
import { API_PROVIDERS } from '@shared/constants';
import { getDeviceFingerprint } from '@shared/fingerprint';
import {
  fetchWithFreeSession,
  getFreeSessionHeaders,
} from '@shared/free-session';
import {
  normalizeProxyError,
  normalizeProxyNetworkError,
} from '@shared/quota-errors';
import { buildSystemPrompt, buildUserMessage } from '../prompt-builder';
import { withRetry } from '@shared/utils/retry';

export type { APICallOptions, APIProviderAdapter, StreamCallback };

/** OpenAI 格式响应 */
interface ProxyResponse {
  choices: Array<{ message: { content: string } }>;
  error?: { message: string };
}

/**
 * 代理模式适配器
 * 在请求中附带设备指纹，用于服务端限额
 */
const proxyAdapter: APIProviderAdapter = {
  name: 'Proxy',

  async call(options: APICallOptions): Promise<string> {
    const { model, analysis } = options;
    const systemPrompt = buildSystemPrompt(analysis);
    const userMessage = buildUserMessage(analysis.originalPrompt, analysis);
    const fp = await getDeviceFingerprint();

    let response: Response;
    try {
      response = await withRetry(
        async () => {
          const res = await fetchWithFreeSession(
            API_PROVIDERS.proxy.endpoint,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Device-FP': fp,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userMessage },
                ],
                temperature: 0.5,
                max_tokens: 2000,
              }),
            },
            30000
          );

          if (!res.ok) {
            const errorText = await res.text();
            throw normalizeProxyError(res.status, errorText);
          }
          return res;
        },
        { maxRetries: 2 }
      );
    } catch (error) {
      throw normalizeProxyNetworkError(error);
    }

    const data = (await response.json()) as ProxyResponse;
    return data.choices[0].message.content;
  },
};

/** 提供商适配器映射 */
const adapters: Record<Exclude<APIProvider, 'custom'>, APIProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicRelayAdapter,
  deepseek: deepseekAdapter,
  gemini: geminiAdapter,
  kimi: kimiAdapter,
  minimax: minimaxAdapter,
  qwen: qwenAdapter,
  zhipu: zhipuAdapter,
  proxy: proxyAdapter,
};

/**
 * 获取 API 提供商适配器
 * @param provider 提供商类型
 * @param customEndpoint 自定义端点（仅用于 custom 类型）
 */
export const getProviderAdapter = (
  provider: APIProvider,
  customEndpoint?: string,
  options?: {
    anthropicRelayEnabled?: boolean;
  }
): APIProviderAdapter => {
  if (provider === 'custom' && customEndpoint) {
    return createOpenAIAdapter('openai', 'Custom', customEndpoint);
  }

  if (provider === 'anthropic') {
    return options?.anthropicRelayEnabled === false
      ? anthropicDirectAdapter
      : anthropicRelayAdapter;
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
export const streamingCall = async (
  options: StreamingCallOptions
): Promise<void> => {
  const {
    provider,
    apiKey,
    model,
    analysis,
    customEndpoint,
    onChunk,
    onError,
  } = options;

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
  } else if (provider === 'proxy') {
    const fp = await getDeviceFingerprint();
    const sessionHeaders = await getFreeSessionHeaders();
    await streamOpenAI({
      provider: provider as Exclude<
        APIProvider,
        'anthropic' | 'proxy' | 'custom'
      >,
      apiKey,
      model,
      analysis,
      endpoint,
      onChunk,
      onError,
      extraHeaders: {
        Authorization: sessionHeaders.Authorization,
        'X-Device-FP': fp,
        'X-Extension-Origin': sessionHeaders['X-Extension-Origin'],
      },
      errorTransformer: normalizeProxyError,
    });
  } else {
    await streamOpenAI({
      provider: provider as Exclude<
        APIProvider,
        'anthropic' | 'proxy' | 'custom'
      >,
      apiKey,
      model,
      analysis,
      endpoint,
      onChunk,
      onError,
    });
  }
};
