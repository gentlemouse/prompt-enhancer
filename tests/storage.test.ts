import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@shared/constants';

const localStorageState: Record<string, unknown> = {};
const syncStorageState: Record<string, unknown> = {};

const readFromStore = (
  store: Record<string, unknown>,
  keyOrKeys: string | string[]
): Record<string, unknown> => {
  if (Array.isArray(keyOrKeys)) {
    return Object.fromEntries(keyOrKeys.map(key => [key, store[key]]));
  }

  return { [keyOrKeys]: store[keyOrKeys] };
};

const localGetMock = vi.fn(
  async (keyOrKeys: string | string[]) => readFromStore(localStorageState, keyOrKeys)
);
const localSetMock = vi.fn(async (items: Record<string, unknown>) => {
  Object.assign(localStorageState, items);
});
const localRemoveMock = vi.fn(async (key: string) => {
  delete localStorageState[key];
});

const syncGetMock = vi.fn(
  async (keyOrKeys: string | string[]) => readFromStore(syncStorageState, keyOrKeys)
);
const syncSetMock = vi.fn(async (items: Record<string, unknown>) => {
  Object.assign(syncStorageState, items);
});
const syncRemoveMock = vi.fn(async (keys: string[]) => {
  for (const key of keys) {
    delete syncStorageState[key];
  }
});

vi.stubGlobal('chrome', {
  runtime: {
    id: 'test-extension-id',
  },
  storage: {
    local: {
      get: localGetMock,
      set: localSetMock,
      remove: localRemoveMock,
    },
    sync: {
      get: syncGetMock,
      set: syncSetMock,
      remove: syncRemoveMock,
    },
  },
});

describe('storage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    for (const key of Object.keys(localStorageState)) {
      delete localStorageState[key];
    }

    for (const key of Object.keys(syncStorageState)) {
      delete syncStorageState[key];
    }
  });

  it('migrates legacy sync config into encrypted local storage on first read', async () => {
    syncStorageState[STORAGE_KEYS.LEGACY_API_KEY] = 'sk-legacy-key';
    syncStorageState[STORAGE_KEYS.LEGACY_PROVIDER] = 'openai';
    syncStorageState[STORAGE_KEYS.LEGACY_MODEL] = 'gpt-4o-mini';
    syncStorageState[STORAGE_KEYS.LEGACY_CUSTOM_ENDPOINT] = 'https://legacy.test/v1/chat';
    syncStorageState[STORAGE_KEYS.LEGACY_CUSTOM_MODEL] = 'legacy-model';

    const { getStorageConfig } = await import('@shared/storage');

    const config = await getStorageConfig();

    expect(config).toEqual({
      apiProvider: 'openai',
      apiKey: 'sk-legacy-key',
      model: 'gpt-4o-mini',
      customEndpoint: 'https://legacy.test/v1/chat',
      customModel: 'legacy-model',
      anthropicWarningAcknowledged: undefined,
    });

    const storedConfig = localStorageState[STORAGE_KEYS.CONFIG] as {
      encryptedApiKey: string;
    };
    expect(storedConfig.encryptedApiKey).not.toBe('sk-legacy-key');
    expect(syncRemoveMock).toHaveBeenCalledWith([
      STORAGE_KEYS.LEGACY_API_KEY,
      STORAGE_KEYS.LEGACY_PROVIDER,
      STORAGE_KEYS.LEGACY_MODEL,
      STORAGE_KEYS.LEGACY_CUSTOM_ENDPOINT,
      STORAGE_KEYS.LEGACY_CUSTOM_MODEL,
    ]);
  });

  it('falls back to openai defaults when legacy provider fields are missing', async () => {
    syncStorageState[STORAGE_KEYS.LEGACY_API_KEY] = 'sk-legacy-default';

    const { getStorageConfig } = await import('@shared/storage');

    await expect(getStorageConfig()).resolves.toEqual({
      apiProvider: 'openai',
      apiKey: 'sk-legacy-default',
      model: '',
      customEndpoint: '',
      customModel: '',
      anthropicWarningAcknowledged: undefined,
    });
  });

  it('saves API keys in encrypted form and decrypts them when reading', async () => {
    const { saveStorageConfig, getStorageConfig } = await import('@shared/storage');

    await saveStorageConfig({
      apiProvider: 'custom',
      apiKey: 'secret-token',
      model: 'custom-model',
      customEndpoint: 'https://api.example.com/v1/chat/completions',
      customModel: 'custom-model',
    });

    const storedConfig = localStorageState[STORAGE_KEYS.CONFIG] as {
      apiProvider: string;
      encryptedApiKey: string;
      model: string;
      customEndpoint: string;
      customModel: string;
    };

    expect(storedConfig.apiProvider).toBe('custom');
    expect(storedConfig.encryptedApiKey).not.toBe('secret-token');

    const config = await getStorageConfig();
    expect(config).toEqual({
      apiProvider: 'custom',
      apiKey: 'secret-token',
      model: 'custom-model',
      customEndpoint: 'https://api.example.com/v1/chat/completions',
      customModel: 'custom-model',
      anthropicWarningAcknowledged: undefined,
    });
  });

  it('falls back to plain-text compatibility when reading older local config', async () => {
    localStorageState[STORAGE_KEYS.CONFIG] = {
      apiProvider: 'openai',
      encryptedApiKey: 'plain-text-key',
      model: 'gpt-4o',
      customEndpoint: '',
      customModel: '',
    };

    const { getStorageConfig } = await import('@shared/storage');

    await expect(getStorageConfig()).resolves.toEqual({
      apiProvider: 'openai',
      apiKey: 'plain-text-key',
      model: 'gpt-4o',
      customEndpoint: '',
      customModel: '',
      anthropicWarningAcknowledged: undefined,
    });
  });

  it('returns null when no local config exists after migration attempt', async () => {
    const { getStorageConfig } = await import('@shared/storage');

    await expect(getStorageConfig()).resolves.toBeNull();
    expect(syncGetMock).toHaveBeenCalledTimes(1);
  });

  it('removes config and reports api key presence correctly', async () => {
    const { saveStorageConfig, clearStorageConfig, hasApiKey } = await import(
      '@shared/storage'
    );

    await saveStorageConfig({
      apiProvider: 'openai',
      apiKey: 'sk-present',
      model: 'gpt-4o',
      customEndpoint: '',
      customModel: '',
    });

    await expect(hasApiKey()).resolves.toBe(true);

    await clearStorageConfig();

    expect(localRemoveMock).toHaveBeenCalledWith(STORAGE_KEYS.CONFIG);
    await expect(hasApiKey()).resolves.toBe(false);
  });

  it('marks anthropic warning as acknowledged when config exists', async () => {
    localStorageState[STORAGE_KEYS.CONFIG] = {
      apiProvider: 'anthropic',
      encryptedApiKey: 'plain-text-key',
      model: 'claude-sonnet-4-6',
      customEndpoint: '',
      customModel: '',
    };

    const { acknowledgeAnthropicWarning } = await import('@shared/storage');

    await acknowledgeAnthropicWarning();

    expect(localStorageState[STORAGE_KEYS.CONFIG]).toMatchObject({
      anthropicWarningAcknowledged: true,
    });
  });

  it('does nothing when acknowledging anthropic warning without an existing config', async () => {
    const { acknowledgeAnthropicWarning } = await import('@shared/storage');

    await acknowledgeAnthropicWarning();

    expect(localSetMock).not.toHaveBeenCalled();
  });
});
