/**
 * OpenAI API 提供商适配器
 * 同时适用于 DeepSeek 和自定义 OpenAI 兼容 API
 */

import type { APICallOptions, APIProviderAdapter } from './types';
import { API_PROVIDERS } from '@shared/constants';
import type { APIProvider } from '@shared/types';
import { buildSystemPrompt, buildUserMessage } from '../prompt-builder';
import { withRetry, fetchWithTimeout } from '@shared/utils/retry';

/** OpenAI API 响应类型 */
interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      reasoning_content?: string;
    };
  }>;
  error?: {
    message: string;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

export type OpenAICompatibleProvider = Exclude<
  APIProvider,
  'anthropic' | 'proxy' | 'custom'
>;

export const MINIMAX_DOMESTIC_ENDPOINT =
  'https://api.minimaxi.com/v1/chat/completions';
export const MINIMAX_GLOBAL_ENDPOINT =
  'https://api.minimax.io/v1/chat/completions';

class EndpointFallbackError extends Error {
  constructor(
    message: string,
    readonly fallbackEndpoint: string
  ) {
    super(message);
    this.name = 'EndpointFallbackError';
  }
}

const parseJSONSafely = (text: string): OpenAIResponse | null => {
  try {
    return JSON.parse(text) as OpenAIResponse;
  } catch {
    return null;
  }
};

const extractOpenAICompatibleError = (
  status: number,
  payload: OpenAIResponse | null,
  fallbackText: string
): string | null => {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  if (payload?.base_resp?.status_code && payload.base_resp.status_code !== 0) {
    return payload.base_resp.status_msg || `API 调用失败: ${status}`;
  }

  if (status >= 400) {
    return fallbackText || `API 调用失败: ${status}`;
  }

  return null;
};

const shouldFallbackMinimaxEndpoint = (
  endpoint: string,
  errorMessage: string
): boolean => {
  if (endpoint !== MINIMAX_DOMESTIC_ENDPOINT) {
    return false;
  }

  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('invalid api key') ||
    normalized.includes('authorized_error') ||
    normalized.includes('2049')
  );
};

export const buildOpenAICompatibleBody = (
  provider: OpenAICompatibleProvider,
  {
    model,
    systemPrompt,
    userMessage,
    stream = false,
  }: {
    model: string;
    systemPrompt: string;
    userMessage: string;
    stream?: boolean;
  }
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.5,
    max_tokens: 2000,
    ...(stream ? { stream: true } : {}),
  };

  if (provider === 'zhipu') {
    body.thinking = { type: 'disabled' };
  }

  return body;
};

const getEndpointCandidates = (
  provider: OpenAICompatibleProvider,
  endpoint: string
): string[] => {
  if (provider === 'minimax' && endpoint === MINIMAX_DOMESTIC_ENDPOINT) {
    return [MINIMAX_DOMESTIC_ENDPOINT, MINIMAX_GLOBAL_ENDPOINT];
  }

  return [endpoint];
};

export const extractOpenAICompatibleContent = (
  payload: OpenAIResponse
): string => payload.choices[0]?.message?.content || '';

/**
 * 创建 OpenAI 兼容的 API 适配器
 * @param provider 提供商标识
 * @param name 适配器名称
 * @param defaultEndpoint 默认端点
 */
export const createOpenAIAdapter = (
  provider: OpenAICompatibleProvider,
  name: string,
  defaultEndpoint: string
): APIProviderAdapter => ({
  name,

  async call(options: APICallOptions): Promise<string> {
    const { apiKey, model, analysis, endpoint } = options;
    const systemPrompt = buildSystemPrompt(analysis);
    const userMessage = buildUserMessage(analysis.originalPrompt, analysis);
    const apiEndpoint = endpoint || defaultEndpoint;
    const requestBody = buildOpenAICompatibleBody(provider, {
      model,
      systemPrompt,
      userMessage,
    });

    let lastError: Error | null = null;

    for (const candidateEndpoint of getEndpointCandidates(
      provider,
      apiEndpoint
    )) {
      try {
        const data = await withRetry(
          async () => {
            const res = await fetchWithTimeout(
              candidateEndpoint,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(requestBody),
              },
              30000
            );

            const responseText = await res.text();
            const payload = parseJSONSafely(responseText);
            const errorMessage = extractOpenAICompatibleError(
              res.status,
              payload,
              responseText
            );

            if (errorMessage) {
              if (
                provider === 'minimax' &&
                shouldFallbackMinimaxEndpoint(candidateEndpoint, errorMessage)
              ) {
                throw new EndpointFallbackError(
                  errorMessage,
                  MINIMAX_GLOBAL_ENDPOINT
                );
              }

              throw new Error(errorMessage);
            }

            if (!payload) {
              throw new Error('API 返回了无效的 JSON');
            }

            return payload;
          },
          {
            maxRetries: 3,
            onRetry: (error, attempt, delay) => {
              void error;
              void attempt;
              void delay;
            },
          }
        );

        return extractOpenAICompatibleContent(data);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (
          lastError instanceof EndpointFallbackError &&
          lastError.fallbackEndpoint === MINIMAX_GLOBAL_ENDPOINT
        ) {
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error('API 调用失败');
  },
});

/** OpenAI 适配器 */
export const openaiAdapter = createOpenAIAdapter(
  'openai',
  'OpenAI',
  API_PROVIDERS.openai.endpoint
);

/** DeepSeek 适配器 */
export const deepseekAdapter = createOpenAIAdapter(
  'deepseek',
  'DeepSeek',
  API_PROVIDERS.deepseek.endpoint
);

/** Google Gemini 适配器 */
export const geminiAdapter = createOpenAIAdapter(
  'gemini',
  'Gemini',
  API_PROVIDERS.gemini.endpoint
);

/** Kimi 适配器 */
export const kimiAdapter = createOpenAIAdapter(
  'kimi',
  'Kimi',
  API_PROVIDERS.kimi.endpoint
);

/** MiniMax 适配器 */
export const minimaxAdapter = createOpenAIAdapter(
  'minimax',
  'MiniMax',
  API_PROVIDERS.minimax.endpoint
);

/** 通义千问适配器 */
export const qwenAdapter = createOpenAIAdapter(
  'qwen',
  'Qwen',
  API_PROVIDERS.qwen.endpoint
);

/** 智谱 GLM 适配器 */
export const zhipuAdapter = createOpenAIAdapter(
  'zhipu',
  'Zhipu',
  API_PROVIDERS.zhipu.endpoint
);
