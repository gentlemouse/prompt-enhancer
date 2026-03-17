import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker, {
  GatewayCoordinator,
  QuotaIdentityCoordinator,
} from '../proxy/worker';

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

class MockDurableObjectState {
  private readonly store = new Map<string, unknown>();

  storage = {
    get: async <T = unknown>(key: string): Promise<T | undefined> =>
      this.store.get(key) as T | undefined,
    put: async <T = unknown>(key: string, value: T): Promise<void> => {
      this.store.set(key, value);
    },
  };
}

type DurableObjectConstructor = new (
  state: MockDurableObjectState,
  env: Parameters<typeof worker.fetch>[1]
) => { fetch(request: Request): Promise<Response> };

class MockDurableObjectNamespace {
  private readonly instances = new Map<string, { fetch(request: Request): Promise<Response> }>();

  constructor(
    private readonly ctor: DurableObjectConstructor,
    private readonly envFactory: () => Parameters<typeof worker.fetch>[1]
  ) {}

  idFromName(name: string): string {
    return name;
  }

  get(id: unknown): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> } {
    const key = String(id);
    if (!this.instances.has(key)) {
      const state = new MockDurableObjectState();
      this.instances.set(key, new this.ctor(state, this.envFactory()));
    }

    const instance = this.instances.get(key)!;
    return {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        return instance.fetch(request);
      },
    };
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

const EXTENSION_ORIGIN = 'chrome-extension://test-extension-id';
const SESSION_SIGNING_SECRET = 'test-session-secret';

const createEnv = (
  overrides: Record<string, string | KVNamespace | MockDurableObjectNamespace> = {}
) => {
  const env = {
    DEEPSEEK_API_KEY: 'test-key',
    SESSION_SIGNING_SECRET,
    ALLOWED_EXTENSION_ORIGINS: EXTENSION_ORIGIN,
    RATE_LIMITER: new MockKVNamespace() as unknown as KVNamespace,
  } as Parameters<typeof worker.fetch>[1];

  const quotaNamespace =
    (overrides['QUOTA_COORDINATOR'] as MockDurableObjectNamespace | undefined) ||
    new MockDurableObjectNamespace(QuotaIdentityCoordinator, () => env);
  const gatewayNamespace =
    (overrides['GATEWAY_COORDINATOR'] as MockDurableObjectNamespace | undefined) ||
    new MockDurableObjectNamespace(GatewayCoordinator, () => env);

  Object.assign(env, {
    QUOTA_COORDINATOR: quotaNamespace,
    GATEWAY_COORDINATOR: gatewayNamespace,
    ...overrides,
  });

  return env;
};

const issueSession = async (
  env: Parameters<typeof worker.fetch>[1],
  fingerprint: string
): Promise<string> => {
  const response = await worker.fetch(
    new Request('https://example.com/v1/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-FP': fingerprint,
        'X-Extension-Origin': EXTENSION_ORIGIN,
      },
      body: JSON.stringify({ origin: EXTENSION_ORIGIN }),
    }),
    env
  );

  expect(response.status).toBe(200);
  const body = (await response.json()) as { token: string };
  return body.token;
};

const authHeaders = (
  token: string,
  fingerprint: string,
  extraHeaders: Record<string, string> = {}
): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  'X-Device-FP': fingerprint,
  'X-Extension-Origin': EXTENSION_ORIGIN,
  ...extraHeaders,
});

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

  it('rejects free quota checks without a session token', async () => {
    const env = createEnv();
    const response = await worker.fetch(
      new Request('https://example.com/v1/quota', {
        method: 'GET',
        headers: {
          'X-Device-FP': 'pe_missing_session',
          'X-Extension-Origin': EXTENSION_ORIGIN,
        },
      }),
      env
    );

    expect(response.status).toBe(401);
  });

  it('rejects requests when the device fingerprint does not match the session', async () => {
    const env = createEnv();
    const token = await issueSession(env, 'pe_session_owner');

    const response = await worker.fetch(
      new Request('https://example.com/v1/quota', {
        method: 'GET',
        headers: authHeaders(token, 'pe_other_device'),
      }),
      env
    );

    expect(response.status).toBe(401);
  });

  it('returns fingerprint usage for quota checks instead of polluted IP usage', async () => {
    const ipKey = `lifetime:${await hashIdentifier('198.51.100.10')}`;
    const kv = new MockKVNamespace({
      [ipKey]: '10',
      'lifetime:pe_fresh_device': '0',
    });
    const env = createEnv({
      DEEPSEEK_API_KEY: 'retry-key',
      RATE_LIMITER: kv as unknown as KVNamespace,
    });
    const token = await issueSession(env, 'pe_fresh_device');

    const response = await worker.fetch(
      new Request('https://example.com/v1/quota', {
        method: 'GET',
        headers: authHeaders(token, 'pe_fresh_device', {
          'CF-Connecting-IP': '198.51.100.10',
        }),
      }),
      env
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
    const env = createEnv({
      DEEPSEEK_API_KEY: 'retry-key',
      RATE_LIMITER: kv as unknown as KVNamespace,
    });
    const token = await issueSession(env, 'pe_brand_new');

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: authHeaders(token, 'pe_brand_new', {
          'CF-Connecting-IP': '198.51.100.11',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
        }),
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(kv.read('lifetime:pe_brand_new')).toBe('1');
    expect(kv.read(ipKey)).toBe('10');
  });

  it('blocks exhausted requests when the fingerprint quota is already consumed', async () => {
    const kv = new MockKVNamespace({
      'lifetime:pe_exhausted_user': '10',
    });
    const env = createEnv({
      DEEPSEEK_API_KEY: 'test-key',
      RATE_LIMITER: kv as unknown as KVNamespace,
    });
    const token = await issueSession(env, 'pe_exhausted_user');

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: authHeaders(token, 'pe_exhausted_user', {
          'CF-Connecting-IP': '198.51.100.12',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
        }),
      }),
      env
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
    const env = createEnv({
      DEEPSEEK_API_KEY: 'test-key',
      RATE_LIMITER: kv as unknown as KVNamespace,
    });
    const token = await issueSession(env, 'pe_retry_user');

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: authHeaders(token, 'pe_retry_user', {
          'CF-Connecting-IP': '198.51.100.13',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
        }),
      }),
      env
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
    const env = createEnv({
      DEEPSEEK_API_KEY: 'retry-key',
      RATE_LIMITER: kv as unknown as KVNamespace,
    });
    const token = await issueSession(env, 'pe_retry_success');

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: authHeaders(token, 'pe_retry_success', {
          'CF-Connecting-IP': '198.51.100.14',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
        }),
      }),
      env
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
    const env = createEnv({
      DEEPSEEK_API_KEY: 'fallback-key',
      DEEPSEEK_API_KEYS: 'bad-key,good-key',
      UPSTREAM_MAX_RETRIES: '0',
      RATE_LIMITER: kv as unknown as KVNamespace,
    });
    const token = await issueSession(env, 'pe_pool_user');

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: authHeaders(token, 'pe_pool_user', {
          'CF-Connecting-IP': '198.51.100.15',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
        }),
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(kv.read('lifetime:pe_pool_user')).toBe('1');
  });

  it('prevents concurrent requests from overspending the last free quota slot', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>(resolve => {
          setTimeout(() => {
            resolve(
              new Response(
                JSON.stringify({ choices: [{ message: { content: 'OK slow' } }] }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }
              )
            );
          }, 30);
        })
    );
    globalThis.fetch = fetchMock;

    const kv = new MockKVNamespace({
      'lifetime:pe_last_slot_user': '9',
    });
    const env = createEnv({
      DEEPSEEK_API_KEY: 'test-key',
      LIFETIME_LIMIT: '10',
      RATE_LIMITER: kv as unknown as KVNamespace,
    });
    const token = await issueSession(env, 'pe_last_slot_user');

    const makeRequest = () =>
      worker.fetch(
        new Request('https://example.com/v1/enhance', {
          method: 'POST',
          headers: authHeaders(token, 'pe_last_slot_user', {
            'CF-Connecting-IP': '198.51.100.17',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'Say OK' }],
            stream: false,
          }),
        }),
        env
      );

    const [first, second] = await Promise.all([makeRequest(), makeRequest()]);
    const statuses = [first.status, second.status].sort((a, b) => a - b);

    expect(statuses).toEqual([200, 429]);
    expect(kv.read('lifetime:pe_last_slot_user')).toBe('10');
  });

  it('returns gateway busy when token bucket is exhausted', async () => {
    const kv = new MockKVNamespace({
      'lifetime:pe_busy_user': '0',
    });
    const env = createEnv({
      DEEPSEEK_API_KEY: 'test-key',
      GATEWAY_RPM_LIMIT: '0',
      QUEUE_MAX_WAIT_MS: '1',
      QUEUE_POLL_INTERVAL_MS: '1',
      RATE_LIMITER: kv as unknown as KVNamespace,
    });
    const token = await issueSession(env, 'pe_busy_user');

    const response = await worker.fetch(
      new Request('https://example.com/v1/enhance', {
        method: 'POST',
        headers: authHeaders(token, 'pe_busy_user', {
          'CF-Connecting-IP': '198.51.100.16',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
        }),
      }),
      env
    );

    expect(response.status).toBe(503);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe('GATEWAY_BUSY');
    expect(kv.read('lifetime:pe_busy_user')).toBe('0');
  });

  it('serves dashboard HTML for monitoring page', async () => {
    const kv = new MockKVNamespace();
    const env = createEnv({
      DEEPSEEK_API_KEY: 'test-key',
      OPS_DASHBOARD_TOKEN: 'ops-secret',
      RATE_LIMITER: kv as unknown as KVNamespace,
    });
    const unauthorized = await worker.fetch(
      new Request('https://example.com/dashboard', { method: 'GET' }),
      env
    );

    expect(unauthorized.status).toBe(401);

    const response = await worker.fetch(
      new Request('https://example.com/dashboard?token=ops-secret', {
        method: 'GET',
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(response.headers.get('Set-Cookie')).toContain('lynx_ops_session=ops-secret');
    const html = await response.text();
    expect(html).toContain('Lynx SLO Dashboard');
    expect(html).toContain('/v1/slo?minutes=');
  });

  it('returns slo summary payload', async () => {
    const kv = new MockKVNamespace();
    const env = createEnv({
      DEEPSEEK_API_KEY: 'test-key',
      OPS_DASHBOARD_TOKEN: 'ops-secret',
      RATE_LIMITER: kv as unknown as KVNamespace,
    });
    const unauthorized = await worker.fetch(
      new Request('https://example.com/v1/slo?minutes=1', { method: 'GET' }),
      env
    );

    expect(unauthorized.status).toBe(401);

    const response = await worker.fetch(
      new Request('https://example.com/v1/slo?minutes=1', {
        method: 'GET',
        headers: {
          Cookie: 'lynx_ops_session=ops-secret',
        },
      }),
      env
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
