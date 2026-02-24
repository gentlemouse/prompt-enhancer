/**
 * OpenAI API 提供商适配器
 * 同时适用于 DeepSeek 和自定义 OpenAI 兼容 API
 */

import type { APICallOptions, APIProviderAdapter } from './types';
import { API_PROVIDERS } from '@shared/constants';
import { buildSystemPrompt, buildUserMessage } from '../prompt-builder';
import { withRetry, fetchWithTimeout } from '@shared/utils/retry';

/** OpenAI API 响应类型 */
interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

/**
 * 创建 OpenAI 兼容的 API 适配器
 * @param name 适配器名称
 * @param defaultEndpoint 默认端点
 */
export const createOpenAIAdapter = (
  name: string,
  defaultEndpoint: string
): APIProviderAdapter => ({
  name,

  async call(options: APICallOptions): Promise<string> {
    const { apiKey, model, analysis, endpoint } = options;
    const systemPrompt = buildSystemPrompt(analysis);
    const userMessage = buildUserMessage(analysis.originalPrompt, analysis);
    const apiEndpoint = endpoint || defaultEndpoint;

    // P1-2.6: 使用重试机制
    const response = await withRetry(
      async () => {
        const res = await fetchWithTimeout(
          apiEndpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
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
          const error = (await res.json()) as OpenAIResponse;
          throw new Error(
            error.error?.message || `API 调用失败: ${res.status}`
          );
        }

        return res;
      },
      {
        maxRetries: 3,
        onRetry: (error, attempt, delay) => {
          // 可以在这里添加日志
          void error;
          void attempt;
          void delay;
        },
      }
    );

    const data = (await response.json()) as OpenAIResponse;
    return data.choices[0].message.content;
  },
});

/** OpenAI 适配器 */
export const openaiAdapter = createOpenAIAdapter(
  'OpenAI',
  API_PROVIDERS.openai.endpoint
);

/** DeepSeek 适配器 */
export const deepseekAdapter = createOpenAIAdapter(
  'DeepSeek',
  API_PROVIDERS.deepseek.endpoint
);

/** Kimi 适配器 */
export const kimiAdapter = createOpenAIAdapter(
  'Kimi',
  API_PROVIDERS.kimi.endpoint
);

/** MiniMax 适配器 */
export const minimaxAdapter = createOpenAIAdapter(
  'MiniMax',
  API_PROVIDERS.minimax.endpoint
);

/** 通义千问适配器 */
export const qwenAdapter = createOpenAIAdapter(
  'Qwen',
  API_PROVIDERS.qwen.endpoint
);

/** 智谱 GLM 适配器 */
export const zhipuAdapter = createOpenAIAdapter(
  'Zhipu',
  API_PROVIDERS.zhipu.endpoint
);
