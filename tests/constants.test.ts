import { describe, expect, it } from 'vitest';
import { API_PROVIDERS } from '@shared/constants';

describe('API_PROVIDERS', () => {
  it('keeps current OpenAI chat-completions models in the selector', () => {
    expect(API_PROVIDERS.openai.defaultModel).toBe('gpt-5.2-chat-latest');
    expect(API_PROVIDERS.openai.models).toEqual([
      'gpt-5.4',
      'gpt-5.4-mini',
      'gpt-5.4-nano',
      'gpt-5.2',
      'gpt-5.2-pro',
      'gpt-5.2-chat-latest',
      'gpt-5-pro',
      'gpt-5-mini',
      'gpt-5-nano',
      'o3',
      'o3-mini',
      'o4-mini',
      'o1',
      'o1-pro',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
    ]);
  });

  it('uses current official Gemini OpenAI-compatible models', () => {
    expect(API_PROVIDERS.gemini.defaultModel).toBe('gemini-2.5-flash');
    expect(API_PROVIDERS.gemini.models).toEqual([
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-3.1-pro',
      'gemini-3.1-pro-preview',
    ]);
  });

  it('uses Moonshot official endpoint and documented Kimi models', () => {
    expect(API_PROVIDERS.kimi.endpoint).toBe(
      'https://api.moonshot.cn/v1/chat/completions'
    );
    expect(API_PROVIDERS.kimi.defaultModel).toBe('moonshot-v1-auto');
    expect(API_PROVIDERS.kimi.models).toEqual([
      'moonshot-v1-auto',
      'moonshot-v1-128k',
      'moonshot-v1-32k',
      'moonshot-v1-8k',
      'kimi-latest',
      'kimi-k2-0905-preview',
      'kimi-k2-turbo-preview',
      'kimi-thinking-preview',
    ]);
  });

  it('keeps MiniMax model IDs aligned with current M2 series', () => {
    expect(API_PROVIDERS.minimax.endpoint).toBe(
      'https://api.minimaxi.com/v1/chat/completions'
    );
    expect(API_PROVIDERS.minimax.defaultModel).toBe('MiniMax-M2.5');
    expect(API_PROVIDERS.minimax.models).toEqual([
      'MiniMax-M2.5',
      'MiniMax-M2.5-highspeed',
      'MiniMax-M2.1',
      'MiniMax-M2.1-highspeed',
      'MiniMax-M2',
    ]);
  });

  it('exposes current Qwen and GLM text model IDs', () => {
    expect(API_PROVIDERS.qwen.defaultModel).toBe('qwen3-max');
    expect(API_PROVIDERS.qwen.models).toEqual([
      'qwen3-max',
      'qwen3-max-2026-01-23',
      'qwen3.5-plus',
      'qwen3.5-flash',
      'qwen3-coder-plus',
      'qwen3-coder-flash',
      'qwen3-coder-next',
    ]);

    expect(API_PROVIDERS.zhipu.defaultModel).toBe('glm-5');
    expect(API_PROVIDERS.zhipu.models).toEqual([
      'glm-5',
      'glm-4.7',
      'glm-4.7-flash',
      'glm-4.5',
      'glm-4.5-flash',
      'glm-4.5-air',
      'glm-4.5-airx',
    ]);
  });

  it('only keeps current Anthropic aliases in the selector', () => {
    expect(API_PROVIDERS.anthropic.defaultModel).toBe('claude-sonnet-4-0');
    expect(API_PROVIDERS.anthropic.models).toEqual([
      'claude-opus-4-1',
      'claude-opus-4-0',
      'claude-sonnet-4-0',
      'claude-3-5-haiku-latest',
    ]);
  });
});
