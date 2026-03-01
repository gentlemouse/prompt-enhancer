import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLocation = { hostname: 'chatgpt.com' };

vi.stubGlobal('window', { location: mockLocation });

const { isAIChatSite } = await import('@content/services/input-detector');

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
