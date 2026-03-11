import { beforeEach, describe, expect, it, vi } from 'vitest';

const localStorageState: Record<string, unknown> = {};
const syncStorageState: Record<string, unknown> = {
  prompt_enhancer_device_fp: 'pe_test_device_fp',
};

const getFromStore = (
  store: Record<string, unknown>,
  key: string
): Record<string, unknown> => ({
  [key]: store[key],
});

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => getFromStore(localStorageState, key)),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(localStorageState, items);
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

const { getTrialRemaining, isTrialExpired, syncQuotaFromServer, getTrialData } =
  await import('@shared/trial');

describe('trial quota sync', () => {
  beforeEach(() => {
    for (const key of Object.keys(localStorageState)) {
      delete localStorageState[key];
    }
    for (const key of Object.keys(syncStorageState)) {
      if (key !== 'prompt_enhancer_device_fp') {
        delete syncStorageState[key];
      }
    }
    fetchMock.mockReset();
  });

  it('keeps the default 10 free uses for a fresh install without forcing server sync', async () => {
    expect(await getTrialRemaining()).toBe(10);
    expect(await isTrialExpired()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adopts a higher server usage count when syncing quota', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ limit: 10, used: 6, remaining: 4 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await syncQuotaFromServer();

    const trialData = await getTrialData();
    expect(trialData.usedCount).toBe(6);
    expect(trialData.maxUses).toBe(10);
  });

  it('does not overwrite newer local data with a smaller server snapshot', async () => {
    localStorageState.prompt_enhancer_trial = {
      maxUses: 10,
      usedCount: 4,
      installedAt: new Date().toISOString(),
      usageTimestamps: [],
    };

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ limit: 5, used: 1, remaining: 4 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await syncQuotaFromServer();

    const trialData = await getTrialData();
    expect(trialData.usedCount).toBe(4);
    expect(trialData.maxUses).toBe(10);
  });

  it('keeps fresh-install quota intact when quota sync fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await syncQuotaFromServer();

    const trialData = await getTrialData();
    expect(trialData.usedCount).toBe(0);
    expect(trialData.maxUses).toBe(10);
  });
});
