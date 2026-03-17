import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker, {
  GatewayCoordinator,
  QuotaIdentityCoordinator,
} from '../proxy/worker';

class MockKVNamespace {
  async get(): Promise<string | null> {
    return null;
  }

  async put(): Promise<void> {
    return;
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
      this.instances.set(
        key,
        new this.ctor(new MockDurableObjectState(), this.envFactory())
      );
    }

    const instance = this.instances.get(key)!;
    return {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
        instance.fetch(input instanceof Request ? input : new Request(input, init)),
    };
  }
}

const createEnv = () => {
  const env = {
    DEEPSEEK_API_KEY: 'test-key',
    SESSION_SIGNING_SECRET: 'test-session-secret',
    ALLOWED_EXTENSION_ORIGINS: 'chrome-extension://test-extension-id',
    RATE_LIMITER: new MockKVNamespace() as unknown as KVNamespace,
  } as Parameters<typeof worker.fetch>[1];

  Object.assign(env, {
    QUOTA_COORDINATOR: new MockDurableObjectNamespace(
      QuotaIdentityCoordinator,
      () => env
    ),
    GATEWAY_COORDINATOR: new MockDurableObjectNamespace(
      GatewayCoordinator,
      () => env
    ),
  });

  return env;
};

describe('worker anthropic relay', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ content: [{ text: 'anthropic-ok' }] }),
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

  it('proxies anthropic requests without requiring a free session token', async () => {
    const env = createEnv();
    const response = await worker.fetch(
      new Request('https://example.com/v1/byok/anthropic/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Anthropic-Key': 'sk-ant-test',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: 'system',
          messages: [{ role: 'user', content: 'user' }],
        }),
      }),
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      content: [{ text: 'anthropic-ok' }],
    });
  });
});
