import { describe, expect, it } from 'vitest';
import { normalizeAnthropicModel } from '@shared/provider-models';

describe('normalizeAnthropicModel', () => {
  it('maps legacy Anthropic aliases to the current selector aliases', () => {
    expect(normalizeAnthropicModel('claude-opus-4-1')).toBe('claude-opus-4-6');
    expect(normalizeAnthropicModel('claude-opus-4-0')).toBe('claude-opus-4-6');
    expect(normalizeAnthropicModel('claude-sonnet-4-0')).toBe(
      'claude-sonnet-4-6'
    );
    expect(normalizeAnthropicModel('claude-3-5-haiku-latest')).toBe(
      'claude-haiku-4-5'
    );
  });

  it('keeps current Anthropic aliases unchanged', () => {
    expect(normalizeAnthropicModel('claude-opus-4-6')).toBe('claude-opus-4-6');
    expect(normalizeAnthropicModel('claude-sonnet-4-6')).toBe(
      'claude-sonnet-4-6'
    );
    expect(normalizeAnthropicModel('claude-haiku-4-5')).toBe(
      'claude-haiku-4-5'
    );
  });

  it('falls back to the current default model for unknown Anthropic aliases', () => {
    expect(normalizeAnthropicModel('claude-unknown-preview')).toBe(
      'claude-sonnet-4-6'
    );
  });
});
