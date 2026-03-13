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
        DEEPSEEK_API_KEY: 'retry-key',
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
        DEEPSEEK_API_KEY: 'retry-key',
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

  it('does not consume free quota when upstream returns 429', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }));

    const kv = new MockKVNamespace({
      'lifetime:pe_retry_user': '0',
    });

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '198.51.100.13',
          'Content-Type': 'application/json',
          'X-Device-FP': 'pe_retry_user',
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
    expect(kv.read('lifetime:pe_retry_user')).toBe('0');
  });

  it('retries upstream 429 and succeeds without extra quota charge', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'rate limited' }), {
          status: 429,
          headers: { 'Retry-After': '1' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'OK after retry' } }] }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    globalThis.fetch = fetchMock;

    const kv = new MockKVNamespace({
      'lifetime:pe_retry_success': '0',
    });

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '198.51.100.14',
          'Content-Type': 'application/json',
          'X-Device-FP': 'pe_retry_success',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
        }),
      }),
      {
        DEEPSEEK_API_KEY: 'retry-key',
        RATE_LIMITER: kv as unknown as KVNamespace,
      }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(kv.read('lifetime:pe_retry_success')).toBe('1');
  });

  it('supports key pool failover when the first key is unavailable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'invalid key' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'OK by second key' } }] }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    globalThis.fetch = fetchMock;

    const kv = new MockKVNamespace({
      'lifetime:pe_pool_user': '0',
    });

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '198.51.100.15',
          'Content-Type': 'application/json',
          'X-Device-FP': 'pe_pool_user',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
        }),
      }),
      {
        DEEPSEEK_API_KEY: 'fallback-key',
        DEEPSEEK_API_KEYS: 'bad-key,good-key',
        UPSTREAM_MAX_RETRIES: '0',
        RATE_LIMITER: kv as unknown as KVNamespace,
      }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(kv.read('lifetime:pe_pool_user')).toBe('1');
  });

  it('returns gateway busy when token bucket is exhausted', async () => {
    const kv = new MockKVNamespace({
      'lifetime:pe_busy_user': '0',
    });

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '198.51.100.16',
          'Content-Type': 'application/json',
          'X-Device-FP': 'pe_busy_user',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
        }),
      }),
      {
        DEEPSEEK_API_KEY: 'test-key',
        GATEWAY_RPM_LIMIT: '0',
        QUEUE_MAX_WAIT_MS: '1',
        QUEUE_POLL_INTERVAL_MS: '1',
        RATE_LIMITER: kv as unknown as KVNamespace,
      }
    );

    expect(response.status).toBe(503);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe('GATEWAY_BUSY');
    expect(kv.read('lifetime:pe_busy_user')).toBe('0');
  });

  it('serves dashboard HTML for monitoring page', async () => {
    const kv = new MockKVNamespace();
    const response = await worker.fetch(
      new Request('https://example.com/dashboard', { method: 'GET' }),
      {
        DEEPSEEK_API_KEY: 'test-key',
        RATE_LIMITER: kv as unknown as KVNamespace,
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('Lynx SLO Dashboard');
    expect(html).toContain('/v1/slo?minutes=');
  });

  it('returns slo summary payload', async () => {
    const kv = new MockKVNamespace();
    const response = await worker.fetch(
      new Request('https://example.com/v1/slo?minutes=1', { method: 'GET' }),
      {
        DEEPSEEK_API_KEY: 'test-key',
        RATE_LIMITER: kv as unknown as KVNamespace,
      }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      window_minutes: number;
      summary: { request_total: number; rate_429: number; rate_timeout: number };
      timeline: unknown[];
    };
    expect(body.window_minutes).toBe(1);
    expect(typeof body.summary.request_total).toBe('number');
    expect(typeof body.summary.rate_429).toBe('number');
    expect(typeof body.summary.rate_timeout).toBe('number');
    expect(Array.isArray(body.timeline)).toBe(true);
  });
});
