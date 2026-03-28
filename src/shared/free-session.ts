import { API_PROVIDERS, STORAGE_KEYS } from './constants';
import { getDeviceFingerprint } from './fingerprint';
import { fetchWithTimeout } from './utils/retry';

interface FreeSessionRecord {
  token?: string;
  expiresAt: number;
  origin: string;
  legacyBypass?: boolean;
}

type AbortSignalLike = globalThis.AbortSignal;

const FREE_SESSION_EXPIRY_SKEW_MS = 10_000;
const LEGACY_SESSION_CACHE_MS = 5 * 60_000;

const getExtensionOrigin = (): string => {
  const runtimeId = chrome?.runtime?.id;
  return runtimeId
    ? `chrome-extension://${runtimeId}`
    : 'chrome-extension://development';
};

const getSessionEndpoint = (): string =>
  API_PROVIDERS.proxy.endpoint.replace('/v1/enhance', '/v1/session');

const getCachedFreeSession = async (): Promise<FreeSessionRecord | null> => {
  const result = await chrome.storage.local.get(STORAGE_KEYS.FREE_SESSION);
  const record = result[STORAGE_KEYS.FREE_SESSION] as
    | FreeSessionRecord
    | undefined;

  if (!record?.expiresAt || !record.origin) {
    return null;
  }

  if (!record.legacyBypass && !record.token) {
    return null;
  }

  return record;
};

const setCachedFreeSession = async (
  record: FreeSessionRecord
): Promise<void> => {
  await chrome.storage.local.set({ [STORAGE_KEYS.FREE_SESSION]: record });
};

export const invalidateFreeSession = async (): Promise<void> => {
  const storageLocal = chrome.storage
    .local as chrome.storage.LocalStorageArea & {
    remove?: (keys: string | string[]) => Promise<void>;
  };

  if (storageLocal.remove) {
    await storageLocal.remove(STORAGE_KEYS.FREE_SESSION);
    return;
  }

  await storageLocal.set({ [STORAGE_KEYS.FREE_SESSION]: undefined });
};

const isSessionFresh = (record: FreeSessionRecord, origin: string): boolean =>
  record.origin === origin &&
  record.expiresAt - FREE_SESSION_EXPIRY_SKEW_MS > Date.now();

const isMissingSessionEndpoint = (status: number, body: string): boolean => {
  if (status !== 404) return false;

  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string };
    return parsed.error === 'Not found' || parsed.message === 'Not found';
  } catch {
    return (
      body.trim() === '{"error":"Not found"}' || body.trim() === 'Not found'
    );
  }
};

const requestFreeSession = async (): Promise<FreeSessionRecord> => {
  const origin = getExtensionOrigin();
  const fp = await getDeviceFingerprint();
  const response = await fetchWithTimeout(
    getSessionEndpoint(),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-FP': fp,
        'X-Extension-Origin': origin,
      },
      body: JSON.stringify({ origin }),
    },
    15_000
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (isMissingSessionEndpoint(response.status, errorText)) {
      const legacyRecord: FreeSessionRecord = {
        legacyBypass: true,
        expiresAt: Date.now() + LEGACY_SESSION_CACHE_MS,
        origin,
      };
      await setCachedFreeSession(legacyRecord);
      return legacyRecord;
    }

    throw new Error(errorText || `Session request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    token?: string;
    expiresAt?: number;
  };

  if (!data.token || !data.expiresAt) {
    throw new Error('Session response is missing token data');
  }

  const record: FreeSessionRecord = {
    token: data.token,
    expiresAt: data.expiresAt,
    origin,
  };
  await setCachedFreeSession(record);
  return record;
};

export const getFreeSession = async (
  forceRefresh: boolean = false
): Promise<FreeSessionRecord> => {
  const origin = getExtensionOrigin();

  if (!forceRefresh) {
    const cached = await getCachedFreeSession();
    if (cached && isSessionFresh(cached, origin)) {
      return cached;
    }
  }

  return requestFreeSession();
};

export const getFreeSessionHeaders = async (
  forceRefresh: boolean = false
): Promise<Record<string, string>> => {
  const session = await getFreeSession(forceRefresh);
  const fp = await getDeviceFingerprint();

  if (session.legacyBypass) {
    return {
      'X-Device-FP': fp,
      'X-Extension-Origin': getExtensionOrigin(),
    };
  }

  return {
    Authorization: `Bearer ${session.token}`,
    'X-Device-FP': fp,
    'X-Extension-Origin': getExtensionOrigin(),
  };
};

export const fetchWithFreeSession = async (
  url: string,
  init: RequestInit = {},
  timeout: number = 30_000,
  signal?: AbortSignalLike
): Promise<Response> => {
  const attemptRequest = async (forceRefresh: boolean): Promise<Response> => {
    const sessionHeaders = await getFreeSessionHeaders(forceRefresh);
    const headers = new globalThis.Headers(init.headers);

    for (const [key, value] of Object.entries(sessionHeaders)) {
      headers.set(key, value);
    }

    return fetchWithTimeout(
      url,
      {
        ...init,
        headers,
      },
      timeout,
      signal
    );
  };

  let response = await attemptRequest(false);
  if (response.status !== 401) {
    return response;
  }

  await invalidateFreeSession();
  response = await attemptRequest(true);
  return response;
};
