import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('anthropic provider routing', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
  });

  it('uses relay adapter by default for anthropic', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ content: [{ text: 'relay-ok' }] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const { getProviderAdapter } = await import('@background/providers');
    const { analyzePrompt } = await import('@background/analyzer');

    const adapter = getProviderAdapter('anthropic');
    const result = await adapter.call({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-6',
      prompt: 'Improve this',
      analysis: analyzePrompt('Improve this'),
      anthropicRelayEnabled: true,
    });

    expect(result).toBe('relay-ok');
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/byok/anthropic/messages');
    expect((options.headers as Record<string, string>)['X-Anthropic-Key']).toBe(
      'sk-ant-test'
    );
  });

  it('uses direct adapter when anthropic relay is disabled', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ content: [{ text: 'direct-ok' }] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const { getProviderAdapter } = await import('@background/providers');
    const { analyzePrompt } = await import('@background/analyzer');

    const adapter = getProviderAdapter('anthropic', undefined, {
      anthropicRelayEnabled: false,
    });
    const result = await adapter.call({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-6',
      prompt: 'Improve this',
      analysis: analyzePrompt('Improve this'),
      anthropicRelayEnabled: false,
    });

    expect(result).toBe('direct-ok');
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(
      (options.headers as Record<string, string>)[
        'anthropic-dangerous-direct-browser-access'
      ]
    ).toBe('true');
  });
});
