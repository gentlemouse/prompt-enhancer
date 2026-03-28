import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@shared/constants';

const localStorageState: Record<string, unknown> = {};
const syncStorageState: Record<string, unknown> = {
  prompt_enhancer_device_fp: 'pe_cached_device_fp',
};

const getFromStore = (
  store: Record<string, unknown>,
  key: string
): Record<string, unknown> => ({
  [key]: store[key],
});

vi.stubGlobal('chrome', {
  runtime: {
    id: 'test-extension-id',
  },
  storage: {
    local: {
      get: vi.fn(async (key: string) => getFromStore(localStorageState, key)),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(localStorageState, items);
      }),
      remove: vi.fn(async (key: string) => {
        delete localStorageState[key];
      }),
    },
    sync: {
      get: vi.fn(async (key: string) => getFromStore(syncStorageState, key)),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(syncStorageState, items);
      }),
    },
  },
});

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { getFreeSession, fetchWithFreeSession } = await import(
  '@shared/free-session'
);

describe('free session', () => {
  beforeEach(() => {
    for (const key of Object.keys(localStorageState)) {
      delete localStorageState[key];
    }
    fetchMock.mockReset();
  });

  it('caches a fresh session and reuses it before expiry', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          token: 'session-token-1',
          expiresAt: Date.now() + 60_000,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const first = await getFreeSession();
    const second = await getFreeSession();

    expect(first.token).toBe('session-token-1');
    expect(second.token).toBe('session-token-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorageState[STORAGE_KEYS.FREE_SESSION]).toMatchObject({
      token: 'session-token-1',
    });
  });

  it('refreshes the session when the cached token is expired', async () => {
    localStorageState[STORAGE_KEYS.FREE_SESSION] = {
      token: 'expired-token',
      expiresAt: Date.now() - 1,
      origin: 'chrome-extension://test-extension-id',
    };

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          token: 'session-token-2',
          expiresAt: Date.now() + 60_000,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const session = await getFreeSession();
    expect(session.token).toBe('session-token-2');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once with a new session when a protected request returns 401', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: 'session-token-3',
            expiresAt: Date.now() + 60_000,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'expired' }), { status: 401 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: 'session-token-4',
            expiresAt: Date.now() + 60_000,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const response = await fetchWithFreeSession('https://example.com/v1/quota', {
      method: 'GET',
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(localStorageState[STORAGE_KEYS.FREE_SESSION]).toMatchObject({
      token: 'session-token-4',
    });
  });

  it('falls back to legacy proxy mode when the session endpoint is not deployed', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const response = await fetchWithFreeSession('https://example.com/v1/enhance', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requestInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-Device-FP')).toBe('pe_cached_device_fp');
    expect(localStorageState[STORAGE_KEYS.FREE_SESSION]).toMatchObject({
      legacyBypass: true,
    });
  });
});
