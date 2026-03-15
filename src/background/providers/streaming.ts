/**
 * 流式响应处理模块
 * P2-3.2: 实现 SSE 流式输出
 */

import type { PromptAnalysis } from '@shared/types';
import { buildSystemPrompt, buildUserMessage } from '../prompt-builder';
import { fetchWithTimeout } from '@shared/utils/retry';
import {
  buildOpenAICompatibleBody,
  extractOpenAICompatibleContent,
  MINIMAX_DOMESTIC_ENDPOINT,
  MINIMAX_GLOBAL_ENDPOINT,
  type OpenAICompatibleProvider,
} from './openai';

/** 流式回调函数类型 */
export type StreamCallback = (
  chunk: string,
  done: boolean
) => void | Promise<void>;

/** 流式调用选项 */
export interface StreamingOptions {
  apiKey: string;
  model: string;
  analysis: PromptAnalysis;
  endpoint: string;
  provider?: OpenAICompatibleProvider;
  onChunk: StreamCallback;
  onError: (error: Error) => void | Promise<void>;
  /** 附加请求头（代理模式用于传递设备指纹） */
  extraHeaders?: Record<string, string>;
  /** 允许 provider 按需归一化错误 */
  errorTransformer?: (status: number, body: string) => Error;
}

/**
 * 安全触发错误回调
 */
const notifyError = async (
  onError: (error: Error) => void | Promise<void>,
  error: Error
): Promise<void> => {
  try {
    await onError(error);
  } catch {
    // 忽略 onError 内部异常，避免二次报错
  }
};

/**
 * 解析 SSE 数据行
 */
const parseSSELine = (line: string): string | null => {
  if (line.startsWith('data: ')) {
    const data = line.slice(6);
    if (data === '[DONE]') return null;
    try {
      const json = JSON.parse(data);
      // OpenAI 格式
      if (json.choices?.[0]?.delta?.content) {
        return json.choices[0].delta.content;
      }
      // Anthropic 格式
      if (json.type === 'content_block_delta' && json.delta?.text) {
        return json.delta.text;
      }
    } catch {
      // 忽略解析错误
    }
  }
  return null;
};

/**
 * 尝试从非流式 JSON 响应中提取内容
 * 代理等后端可能忽略 stream 参数，返回标准 OpenAI JSON
 */
const extractFromJSONResponse = (text: string): string | null => {
  try {
    const json = JSON.parse(text);
    const content = extractOpenAICompatibleContent(json);
    if (typeof content === 'string' && content.length > 0) {
      return content;
    }
  } catch {
    // 不是合法 JSON，忽略
  }
  return null;
};

/**
 * OpenAI 兼容的流式调用
 * 兼容非流式响应（代理模式可能返回标准 JSON）
 */
export const streamOpenAI = async (
  options: StreamingOptions
): Promise<void> => {
  const {
    apiKey,
    model,
    analysis,
    endpoint,
    provider,
    onChunk,
    onError,
    extraHeaders,
    errorTransformer,
  } = options;
  const systemPrompt = buildSystemPrompt(analysis);
  const userMessage = buildUserMessage(analysis.originalPrompt, analysis);

  try {
    const requestBody = provider
      ? buildOpenAICompatibleBody(provider, {
          model,
          systemPrompt,
          userMessage,
          stream: true,
        })
      : {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.5,
          max_tokens: 2000,
          stream: true,
        };

    const endpointCandidates =
      provider === 'minimax' && endpoint === MINIMAX_DOMESTIC_ENDPOINT
        ? [MINIMAX_DOMESTIC_ENDPOINT, MINIMAX_GLOBAL_ENDPOINT]
        : [endpoint];

    let response: Response | null = null;
    let responseError: Error | null = null;

    for (const candidateEndpoint of endpointCandidates) {
      const res = await fetchWithTimeout(
        candidateEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...extraHeaders,
          },
          body: JSON.stringify(requestBody),
        },
        60000
      );

      if (!res.ok) {
        const errorText = await res.text();
        const shouldFallback =
          provider === 'minimax' &&
          candidateEndpoint === MINIMAX_DOMESTIC_ENDPOINT &&
          /invalid api key|authorized_error|2049/i.test(errorText);

        if (shouldFallback) {
          continue;
        }

        responseError = errorTransformer
          ? errorTransformer(res.status, errorText)
          : new Error(errorText || `API 调用失败: ${res.status}`);
        break;
      }

      response = res;
      break;
    }

    if (responseError) {
      throw responseError;
    }

    if (!response) {
      throw new Error('API 调用失败');
    }

    const contentType = response.headers.get('content-type') || '';
    const isSSE = contentType.includes('text/event-stream');

    if (!isSSE) {
      const text = await response.text();
      const content = extractFromJSONResponse(text);
      if (content) {
        await onChunk(content, false);
        await onChunk('', true);
      } else {
        await notifyError(onError, new Error('API 返回了空内容'));
      }
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let hasContent = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const content = parseSSELine(line.trim());
        if (content) {
          hasContent = true;
          await onChunk(content, false);
        }
      }
    }

    if (buffer.trim()) {
      const content = parseSSELine(buffer.trim());
      if (content) {
        hasContent = true;
        await onChunk(content, false);
      }
    }

    if (hasContent) {
      await onChunk('', true);
    } else {
      await notifyError(onError, new Error('API 未返回任何内容'));
    }
  } catch (error) {
    await notifyError(
      onError,
      error instanceof Error ? error : new Error(String(error))
    );
  }
};

/**
 * Anthropic 流式调用
 */
export const streamAnthropic = async (
  options: StreamingOptions
): Promise<void> => {
  const { apiKey, model, analysis, endpoint, onChunk, onError } = options;
  const systemPrompt = buildSystemPrompt(analysis);
  const userMessage = buildUserMessage(analysis.originalPrompt, analysis);

  try {
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          temperature: 0.5,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
          stream: true,
        }),
      },
      60000
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error?.message || `API 调用失败: ${response.status}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            if (json.type === 'content_block_delta' && json.delta?.text) {
              await onChunk(json.delta.text, false);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    await onChunk('', true);
  } catch (error) {
    await notifyError(
      onError,
      error instanceof Error ? error : new Error(String(error))
    );
  }
};
