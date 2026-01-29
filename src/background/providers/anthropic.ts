/**
 * Anthropic API 提供商适配器
 * P0-1.3: 包含安全警告处理
 */

import type { APICallOptions, APIProviderAdapter } from './types';
import { API_PROVIDERS } from '@shared/constants';
import { buildSystemPrompt, buildUserMessage } from '../prompt-builder';
import { withRetry, fetchWithTimeout } from '@shared/utils/retry';

/** Anthropic API 响应类型 */
interface AnthropicResponse {
  content: Array<{
    text: string;
  }>;
  error?: {
    message: string;
  };
}

/**
 * Anthropic API 适配器
 * P0-1.3: 使用 anthropic-dangerous-direct-browser-access 时需要用户确认
 */
export const anthropicAdapter: APIProviderAdapter = {
  name: 'Anthropic',

  async call(options: APICallOptions): Promise<string> {
    const { apiKey, model, analysis, endpoint } = options;
    const systemPrompt = buildSystemPrompt(analysis);
    const userMessage = buildUserMessage(analysis.originalPrompt, analysis);
    const apiEndpoint = endpoint || API_PROVIDERS.anthropic.endpoint;

    // P1-2.6: 使用重试机制
    const response = await withRetry(
      async () => {
        const res = await fetchWithTimeout(
          apiEndpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              // P0-1.3: 这个头部是必需的，但需要用户确认风险
              'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
              model,
              max_tokens: 2000,
              temperature: 0.5,
              system: systemPrompt,
              messages: [{ role: 'user', content: userMessage }],
            }),
          },
          30000
        );

        if (!res.ok) {
          const error = (await res.json()) as AnthropicResponse;
          throw new Error(error.error?.message || `API 调用失败: ${res.status}`);
        }

        return res;
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

    const data = (await response.json()) as AnthropicResponse;
    return data.content[0].text;
  },
};
