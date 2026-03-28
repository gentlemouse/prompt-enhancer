import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OptimizationStrategy,
  ReasoningMode,
  TaskType,
  type PromptAnalysis,
} from '@shared/types';

const analyzePromptMock = vi.fn();
const streamingCallMock = vi.fn();
const getStorageConfigMock = vi.fn();
const trackEnhanceEventMock = vi.fn();
const syncQuotaFromServerMock = vi.fn();
const incrementTrialUsageMock = vi.fn();
const isTrialExpiredMock = vi.fn();

vi.mock('@background/analyzer', () => ({
  analyzePrompt: analyzePromptMock,
}));

vi.mock('@background/providers', () => ({
  getProviderAdapter: vi.fn(),
  streamingCall: streamingCallMock,
}));

vi.mock('@shared/storage', () => ({
  getStorageConfig: getStorageConfigMock,
}));

vi.mock('@shared/analytics', () => ({
  trackEnhanceEvent: trackEnhanceEventMock,
}));

vi.mock('@shared/provider-models', () => ({
  normalizeAnthropicModel: (model: string) => model,
}));

vi.mock('@shared/trial', () => ({
  isTrialExpired: isTrialExpiredMock,
  incrementTrialUsage: incrementTrialUsageMock,
  syncQuotaFromServer: syncQuotaFromServerMock,
}));

vi.mock('@shared/mode', () => ({
  isByokConfigured: () => true,
}));

const analysis: PromptAnalysis = {
  taskType: TaskType.WRITING,
  reasoningMode: ReasoningMode.SIMPLE,
  strategy: OptimizationStrategy.LIGHT_POLISH,
  language: 'en',
  length: 10,
  hasCode: false,
  hasFormatRequest: false,
  hasMultipleQuestions: false,
  hasNumberedList: false,
  complexityScore: 1,
  needsChainOfThought: false,
  needsReflection: false,
  originalPrompt: 'draft',
  isCorrection: false,
  hasGoodStructure: false,
  hasDirectExecutionRisk: false,
};

const tabsSendMessageMock = vi.fn();

const waitForStreamingCall = async (): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (streamingCallMock.mock.calls.length > 0) {
      return;
    }
    await Promise.resolve();
  }

  throw new Error('streamingCall was not invoked');
};

vi.stubGlobal('chrome', {
  tabs: {
    sendMessage: tabsSendMessageMock,
  },
  action: {
    setBadgeText: vi.fn(),
  },
  i18n: {
    getMessage: vi.fn((key: string) => key),
  },
});

describe('enhancePromptStreaming cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyzePromptMock.mockReturnValue(analysis);
    getStorageConfigMock.mockResolvedValue({
      apiProvider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-test',
      customEndpoint: '',
      customModel: '',
      anthropicRelayEnabled: true,
    });
    isTrialExpiredMock.mockResolvedValue(false);
    incrementTrialUsageMock.mockResolvedValue({ maxUses: 10, usedCount: 1 });
    syncQuotaFromServerMock.mockResolvedValue(undefined);
  });

  it('aborts an active streaming request without emitting stream errors', async () => {
    const { cancelEnhancePromptStreaming, enhancePromptStreaming } = await import(
      '@background/enhancer'
    );

    streamingCallMock.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise<void>(resolve => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        })
    );

    const request = enhancePromptStreaming('draft', 8, 'req-abort');
    await waitForStreamingCall();

    cancelEnhancePromptStreaming('req-abort');
    await request;

    expect(streamingCallMock).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    expect(
      (streamingCallMock.mock.calls[0][0] as { signal: AbortSignal }).signal
        .aborted
    ).toBe(true);
    expect(tabsSendMessageMock).not.toHaveBeenCalled();

    cancelEnhancePromptStreaming('req-abort');
  });

  it('still forwards ordinary streaming failures to the content script', async () => {
    const { enhancePromptStreaming } = await import('@background/enhancer');

    streamingCallMock.mockRejectedValueOnce(new Error('provider down'));

    await enhancePromptStreaming('draft', 11, 'req-error');

    expect(tabsSendMessageMock).toHaveBeenCalledWith(11, {
      action: 'streamError',
      requestId: 'req-error',
      error: 'provider down',
    });
  });
});
