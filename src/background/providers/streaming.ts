/**
 * 流式响应处理模块
 * P2-3.2: 实现 SSE 流式输出
 */

import type { PromptAnalysis } from '@shared/types';
import { buildSystemPrompt, buildUserMessage } from '../prompt-builder';
import { fetchWithTimeout } from '@shared/utils/retry';

/** 流式回调函数类型 */
export type StreamCallback = (chunk: string, done: boolean) => void;

/** 流式调用选项 */
export interface StreamingOptions {
  apiKey: string;
  model: string;
  analysis: PromptAnalysis;
  endpoint: string;
  onChunk: StreamCallback;
  onError: (error: Error) => void;
}

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
 * OpenAI 兼容的流式调用
 */
export const streamOpenAI = async (options: StreamingOptions): Promise<void> => {
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
          stream: true,
        }),
      },
      60000
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API 调用失败: ${response.status}`);
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
        const content = parseSSELine(line.trim());
        if (content) {
          onChunk(content, false);
        }
      }
    }

    // 处理剩余缓冲区
    if (buffer.trim()) {
      const content = parseSSELine(buffer.trim());
      if (content) {
        onChunk(content, false);
      }
    }

    onChunk('', true);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};

/**
 * Anthropic 流式调用
 */
export const streamAnthropic = async (options: StreamingOptions): Promise<void> => {
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
      throw new Error(error.error?.message || `API 调用失败: ${response.status}`);
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
              onChunk(json.delta.text, false);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    onChunk('', true);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};
