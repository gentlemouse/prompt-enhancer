import { describe, expect, it } from 'vitest';

import { isChatGPTPromptElementSignals } from '@content/services/site-adapters';

describe('isChatGPTPromptElementSignals', () => {
  it('accepts the visible ChatGPT composer root', () => {
    expect(
      isChatGPTPromptElementSignals({
        hostname: 'chatgpt.com',
        id: 'prompt-textarea',
        tagName: 'DIV',
        isContentEditable: true,
        role: 'textbox',
        name: null,
      })
    ).toBe(true);
  });

  it('rejects the hidden fallback textarea with the same semantic name', () => {
    expect(
      isChatGPTPromptElementSignals({
        hostname: 'chatgpt.com',
        id: null,
        tagName: 'TEXTAREA',
        isContentEditable: false,
        role: null,
        name: 'prompt-textarea',
      })
    ).toBe(false);
  });

  it('rejects lookalike nodes on non ChatGPT hosts', () => {
    expect(
      isChatGPTPromptElementSignals({
        hostname: 'example.com',
        id: 'prompt-textarea',
        tagName: 'DIV',
        isContentEditable: true,
        role: 'textbox',
        name: null,
      })
    ).toBe(false);
  });
});
