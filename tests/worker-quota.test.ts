import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../proxy/worker';

type KVValue = string | null;

class MockKVNamespace {
  private readonly store = new Map<string, string>();

  constructor(initialValues: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initialValues)) {
      this.store.set(key, value);
    }
  }

  async get(key: string): Promise<KVValue> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  read(key: string): string | null {
    return this.store.get(key) ?? null;
  }
}

const hashIdentifier = async (identifier: string): Promise<string> => {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(identifier + '-prompt-enhancer-salt')
  );

  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
};

describe('proxy worker quota identity', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'OK' } }] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns fingerprint usage for quota checks instead of polluted IP usage', async () => {
    const ipKey = `lifetime:${await hashIdentifier('198.51.100.10')}`;
    const kv = new MockKVNamespace({
      [ipKey]: '10',
      'lifetime:pe_fresh_device': '0',
    });

    const response = await worker.fetch(
      new Request('https://example.com/v1/quota', {
        method: 'GET',
        headers: {
          'CF-Connecting-IP': '198.51.100.10',
          'X-Device-FP': 'pe_fresh_device',
        },
      }),
      {
        DEEPSEEK_API_KEY: 'test-key',
        RATE_LIMITER: kv as unknown as KVNamespace,
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      limit: 10,
      used: 0,
      remaining: 10,
    });
  });

  it('allows a new fingerprint on an exhausted shared IP', async () => {
    const ipKey = `lifetime:${await hashIdentifier('198.51.100.11')}`;
    const kv = new MockKVNamespace({
      [ipKey]: '10',
      'lifetime:pe_brand_new': '0',
    });

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '198.51.100.11',
          'Content-Type': 'application/json',
          'X-Device-FP': 'pe_brand_new',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
        }),
      }),
      {
        DEEPSEEK_API_KEY: 'test-key',
        RATE_LIMITER: kv as unknown as KVNamespace,
      }
    );

    expect(response.status).toBe(200);
    expect(kv.read('lifetime:pe_brand_new')).toBe('1');
    expect(kv.read(ipKey)).toBe('10');
  });

  it('still blocks exhausted requests that have no valid fingerprint fallback', async () => {
    const ipKey = `lifetime:${await hashIdentifier('198.51.100.12')}`;
    const kv = new MockKVNamespace({
      [ipKey]: '10',
    });

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '198.51.100.12',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
        }),
      }),
      {
        DEEPSEEK_API_KEY: 'test-key',
        RATE_LIMITER: kv as unknown as KVNamespace,
      }
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      used: 10,
    });
  });
});
