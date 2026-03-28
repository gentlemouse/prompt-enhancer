import { describe, expect, it, vi } from 'vitest';
import {
  OptimizationStrategy,
  ReasoningMode,
  TaskType,
  type PromptAnalysis,
} from '@shared/types';

const fetchWithTimeoutMock = vi.fn();

vi.mock('@shared/utils/retry', () => ({
  fetchWithTimeout: fetchWithTimeoutMock,
  isAbortError: (error: unknown) =>
    error instanceof DOMException
      ? error.name === 'AbortError'
      : error instanceof Error
        ? error.name === 'AbortError' ||
          error.message.toLowerCase().includes('aborted')
        : false,
}));

const baseAnalysis: PromptAnalysis = {
  taskType: TaskType.WRITING,
  reasoningMode: ReasoningMode.SIMPLE,
  strategy: OptimizationStrategy.LIGHT_POLISH,
  language: 'en',
  length: 12,
  hasCode: false,
  hasFormatRequest: false,
  hasMultipleQuestions: false,
  hasNumberedList: false,
  complexityScore: 1,
  needsChainOfThought: false,
  needsReflection: false,
  originalPrompt: 'hello world',
  isCorrection: false,
  hasGoodStructure: false,
  hasDirectExecutionRisk: false,
};

describe('streamOpenAI abort handling', () => {
  it('stops quietly when the request is aborted mid-stream', async () => {
    const { streamOpenAI } = await import('@background/providers/streaming');
    const controller = new AbortController();
    const onChunk = vi.fn(async (chunk: string, done: boolean) => {
      if (chunk === 'hello' && !done) {
        controller.abort();
      }
    });
    const onError = vi.fn();
    const encoder = new TextEncoder();
    let readCount = 0;

    fetchWithTimeoutMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        'content-type': 'text/event-stream',
      }),
      body: {
        getReader: () => ({
          read: async () => {
            if (readCount === 0) {
              readCount += 1;
              return {
                done: false,
                value: encoder.encode(
                  'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'
                ),
              };
            }

            if (controller.signal.aborted) {
              throw new DOMException('Aborted', 'AbortError');
            }

            return {
              done: true,
              value: undefined,
            };
          },
        }),
      },
    } as Response);

    await streamOpenAI({
      apiKey: 'sk-test',
      model: 'gpt-test',
      analysis: baseAnalysis,
      endpoint: 'https://example.com/v1/chat/completions',
      signal: controller.signal,
      onChunk,
      onError,
    });

    expect(fetchWithTimeoutMock).toHaveBeenCalledWith(
      'https://example.com/v1/chat/completions',
      expect.any(Object),
      60000,
      controller.signal
    );
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith('hello', false);
    expect(onError).not.toHaveBeenCalled();
  });
});
