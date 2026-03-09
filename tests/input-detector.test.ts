import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLocation = { hostname: 'chatgpt.com' };

vi.stubGlobal('window', { location: mockLocation });

const { isAIChatSite, shouldAcceptContentEditableForNonAISite } =
  await import('@content/services/input-detector');

describe('input-detector isAIChatSite', () => {
  beforeEach(() => {
    mockLocation.hostname = 'chatgpt.com';
  });

  it('accepts exact whitelisted host', () => {
    mockLocation.hostname = 'chatgpt.com';
    expect(isAIChatSite()).toBe(true);
  });

  it('accepts subdomain of whitelisted host', () => {
    mockLocation.hostname = 'foo.chatgpt.com';
    expect(isAIChatSite()).toBe(true);
  });

  it('rejects suffix spoofing host', () => {
    mockLocation.hostname = 'chatgpt.com.evil.com';
    expect(isAIChatSite()).toBe(false);
  });

  it('rejects contains-only spoofing host', () => {
    mockLocation.hostname = 'evilchatgpt.com';
    expect(isAIChatSite()).toBe(false);
  });
});

describe('shouldAcceptContentEditableForNonAISite', () => {
  it('rejects document-like editors with only structural signals', () => {
    expect(
      shouldAcceptContentEditableForNonAISite({
        hasTextboxRole: true,
        hasRichEditor: true,
        hasTextHint: false,
        hasChatContainer: false,
        hasSendControl: false,
      })
    ).toBe(false);
  });

  it('accepts editor with prompt hint plus textbox semantics', () => {
    expect(
      shouldAcceptContentEditableForNonAISite({
        hasTextboxRole: true,
        hasRichEditor: false,
        hasTextHint: true,
        hasChatContainer: false,
        hasSendControl: false,
      })
    ).toBe(true);
  });

  it('accepts rich editor with nearby send control', () => {
    expect(
      shouldAcceptContentEditableForNonAISite({
        hasTextboxRole: false,
        hasRichEditor: true,
        hasTextHint: false,
        hasChatContainer: false,
        hasSendControl: true,
      })
    ).toBe(true);
  });

  it('rejects chat-like container without explicit input intent', () => {
    expect(
      shouldAcceptContentEditableForNonAISite({
        hasTextboxRole: true,
        hasRichEditor: false,
        hasTextHint: false,
        hasChatContainer: true,
        hasSendControl: false,
      })
    ).toBe(false);
  });
});
