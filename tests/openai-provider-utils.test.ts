import { describe, expect, it } from 'vitest';
import {
  buildOpenAICompatibleBody,
  MINIMAX_DOMESTIC_ENDPOINT,
  MINIMAX_GLOBAL_ENDPOINT,
} from '@background/providers/openai';

describe('openai provider utils', () => {
  it('disables thinking for zhipu requests', () => {
    const body = buildOpenAICompatibleBody('zhipu', {
      model: 'glm-5',
      systemPrompt: 'system',
      userMessage: 'user',
    });

    expect(body).toMatchObject({
      model: 'glm-5',
      thinking: { type: 'disabled' },
    });
  });

  it('keeps standard body shape for other providers', () => {
    const body = buildOpenAICompatibleBody('openai', {
      model: 'gpt-4o-mini',
      systemPrompt: 'system',
      userMessage: 'user',
      stream: true,
    });

    expect(body).toMatchObject({
      model: 'gpt-4o-mini',
      stream: true,
    });
    expect(body).not.toHaveProperty('thinking');
  });

  it('exposes distinct minimax domestic and global endpoints', () => {
    expect(MINIMAX_DOMESTIC_ENDPOINT).not.toBe(MINIMAX_GLOBAL_ENDPOINT);
    expect(MINIMAX_DOMESTIC_ENDPOINT).toContain('api.minimaxi.com');
    expect(MINIMAX_GLOBAL_ENDPOINT).toContain('api.minimax.io');
  });
});
