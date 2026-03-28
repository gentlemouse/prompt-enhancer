import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = {
  onMessage: [] as Array<
    (
      request: Record<string, unknown>,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ) => boolean
  >,
  onInstalled: [] as Array<() => void>,
  onStorageChanged: [] as Array<
    (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => void
  >,
  onContextMenuClicked: [] as Array<
    (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void
  >,
  onCommand: [] as Array<(command: string, tab?: chrome.tabs.Tab) => void>,
  onActionClicked: [] as Array<(tab: chrome.tabs.Tab) => void>,
};

const addListener = <T extends (...args: never[]) => void>(
  bucket: T[]
): ((callback: T) => void) => {
  return callback => {
    bucket.push(callback);
  };
};

const tabsGetMock = vi.fn();
const tabsSendMessageMock = vi.fn();
const permissionsContainsMock = vi.fn();
const permissionsRequestMock = vi.fn();
const insertCssMock = vi.fn();
const executeScriptMock = vi.fn();
const contextMenusCreateMock = vi.fn();
const runtimeGetManifestMock = vi.fn();
const storageLocalGetMock = vi.fn();
const storageLocalSetMock = vi.fn();
const i18nMessages: Record<string, string> = {
  contextMenuEnhance: 'Enhance Prompt',
  errorMissingPrompt: 'Missing prompt parameter',
  errorMissingRequestId: 'Missing request ID parameter',
  errorMissingTabId: 'Cannot get tab ID',
  errorMissingRequestTabId: 'Missing tab ID parameter',
  errorMissingOrigin: 'Missing origin parameter',
  errorUnknownAction: 'Unknown action type',
  statusUnknownError: 'Unknown error',
};

const localStorageState: Record<string, unknown> = {};

const enhancePromptMock = vi.fn();
const enhancePromptStreamingMock = vi.fn();
const cancelEnhancePromptStreamingMock = vi.fn();
const updateTrialBadgeMock = vi.fn();
const syncQuotaFromServerMock = vi.fn();
const getTrialDataMock = vi.fn();
const getStorageConfigMock = vi.fn();

vi.mock('@background/enhancer', () => ({
  cancelEnhancePromptStreaming: cancelEnhancePromptStreamingMock,
  enhancePrompt: enhancePromptMock,
  enhancePromptStreaming: enhancePromptStreamingMock,
  updateTrialBadge: updateTrialBadgeMock,
}));

vi.mock('@shared/trial', () => ({
  getTrialData: getTrialDataMock,
  syncQuotaFromServer: syncQuotaFromServerMock,
}));

vi.mock('@shared/storage', () => ({
  getStorageConfig: getStorageConfigMock,
}));

vi.stubGlobal('chrome', {
  runtime: {
    onMessage: {
      addListener: addListener(listeners.onMessage),
    },
    onInstalled: {
      addListener: addListener(listeners.onInstalled),
    },
    getManifest: runtimeGetManifestMock,
  },
  storage: {
    local: {
      get: storageLocalGetMock,
      set: storageLocalSetMock,
    },
    onChanged: {
      addListener: addListener(listeners.onStorageChanged),
    },
  },
  tabs: {
    get: tabsGetMock,
    sendMessage: tabsSendMessageMock,
  },
  permissions: {
    contains: permissionsContainsMock,
    request: permissionsRequestMock,
  },
  scripting: {
    insertCSS: insertCssMock,
    executeScript: executeScriptMock,
  },
  contextMenus: {
    create: contextMenusCreateMock,
    onClicked: {
      addListener: addListener(listeners.onContextMenuClicked),
    },
  },
  commands: {
    onCommand: {
      addListener: addListener(listeners.onCommand),
    },
  },
  action: {
    onClicked: {
      addListener: addListener(listeners.onActionClicked),
    },
  },
  i18n: {
    getMessage: vi.fn((key: string) => i18nMessages[key] || key),
  },
});

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const loadBackground = async (): Promise<void> => {
  vi.resetModules();
  await import('@background/index');
  await flushMicrotasks();
};

const sendRuntimeMessage = async (
  request: Record<string, unknown>,
  sender: chrome.runtime.MessageSender = {}
): Promise<unknown> => {
  const handler = listeners.onMessage[0];
  return new Promise(resolve => {
    expect(handler(request, sender, resolve)).toBe(true);
  });
};

describe('background index', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    listeners.onMessage.length = 0;
    listeners.onInstalled.length = 0;
    listeners.onStorageChanged.length = 0;
    listeners.onContextMenuClicked.length = 0;
    listeners.onCommand.length = 0;
    listeners.onActionClicked.length = 0;

    for (const key of Object.keys(localStorageState)) {
      delete localStorageState[key];
    }

    tabsGetMock.mockResolvedValue({ id: 1, url: 'https://example.com/chat' });
    permissionsContainsMock.mockResolvedValue(true);
    permissionsRequestMock.mockResolvedValue(true);
    insertCssMock.mockResolvedValue(undefined);
    executeScriptMock.mockResolvedValue(undefined);
    runtimeGetManifestMock.mockReturnValue({
      content_scripts: [
        {
          js: ['content-script.js'],
          css: ['content-style.css'],
        },
      ],
    });
    storageLocalGetMock.mockImplementation(async (key: string) => ({
      [key]: localStorageState[key],
    }));
    storageLocalSetMock.mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(localStorageState, items);
    });
    enhancePromptMock.mockResolvedValue('enhanced prompt');
    enhancePromptStreamingMock.mockResolvedValue(undefined);
    cancelEnhancePromptStreamingMock.mockReturnValue(undefined);
    updateTrialBadgeMock.mockResolvedValue(undefined);
    syncQuotaFromServerMock.mockResolvedValue(undefined);
    getTrialDataMock.mockResolvedValue({ maxUses: 10, usedCount: 2 });
    getStorageConfigMock.mockResolvedValue(null);
  });

  it('syncs quota and updates badge on startup', async () => {
    await loadBackground();

    expect(syncQuotaFromServerMock).toHaveBeenCalledTimes(1);
    expect(updateTrialBadgeMock).toHaveBeenCalledTimes(1);
    expect(listeners.onMessage).toHaveLength(1);
  });

  it('injects content script files declared in the manifest', async () => {
    await loadBackground();

    await expect(
      sendRuntimeMessage({ action: 'injectContentScript', tabId: 7 })
    ).resolves.toEqual({ success: true });

    expect(tabsGetMock).toHaveBeenCalledWith(7);
    expect(insertCssMock).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['content-style.css'],
    });
    expect(executeScriptMock).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['content-script.js'],
    });
  });

  it('returns permission and trial status responses through the message bridge', async () => {
    await loadBackground();

    await expect(
      sendRuntimeMessage({
        action: 'checkPermission',
        origin: 'https://example.com',
      })
    ).resolves.toEqual({ success: true, hasPermission: true });

    getStorageConfigMock.mockResolvedValueOnce({
      apiProvider: 'openai',
      apiKey: 'sk-configured',
      model: 'gpt-4o-mini',
      customEndpoint: '',
      customModel: '',
    });

    await expect(sendRuntimeMessage({ action: 'getTrialStatus' })).resolves.toEqual({
      success: true,
      trialState: 'API_CONFIGURED',
      trialRemaining: 10,
      trialTotal: 10,
    });

    getStorageConfigMock.mockResolvedValueOnce({
      apiProvider: 'proxy',
      apiKey: 'proxy-mode',
      model: 'deepseek-chat',
      customEndpoint: '',
      customModel: '',
    });

    await expect(sendRuntimeMessage({ action: 'getTrialStatus' })).resolves.toEqual({
      success: true,
      trialState: 'TRIAL_ACTIVE',
      trialRemaining: 8,
      trialTotal: 10,
    });

    expect(permissionsContainsMock).toHaveBeenCalledWith({
      origins: ['https://example.com/*'],
    });
  });

  it('handles prompt, provider, onboarding, and unknown message branches', async () => {
    await loadBackground();

    await expect(sendRuntimeMessage({ action: 'enhancePrompt' })).resolves.toEqual({
      success: false,
      error: 'Missing prompt parameter',
    });

    await expect(
      sendRuntimeMessage({ action: 'enhancePrompt', prompt: 'draft' })
    ).resolves.toEqual({ success: true, enhanced: 'enhanced prompt' });

    enhancePromptMock.mockRejectedValueOnce(new Error('provider down'));
    await expect(
      sendRuntimeMessage({ action: 'enhancePrompt', prompt: 'draft again' })
    ).resolves.toEqual({ success: false, error: 'provider down' });

    await expect(sendRuntimeMessage({ action: 'getProviders' })).resolves.toMatchObject({
      success: true,
    });

    await expect(sendRuntimeMessage({ action: 'checkOnboarding' })).resolves.toEqual({
      success: true,
      needsOnboarding: true,
    });

    await expect(sendRuntimeMessage({ action: 'completeOnboarding' })).resolves.toEqual({
      success: true,
    });
    expect(localStorageState['prompt_enhancer_onboarding_complete']).toBe(true);

    await expect(
      sendRuntimeMessage({ action: 'unknownAction' })
    ).resolves.toEqual({ success: false, error: 'Unknown action type' });
  });

  it('passes sender tab into streaming enhancement requests', async () => {
    await loadBackground();

    await expect(
      sendRuntimeMessage(
        {
          action: 'enhancePromptStreaming',
          prompt: 'rewrite this',
          requestId: 'req-1',
        },
        { tab: { id: 99 } as chrome.tabs.Tab }
      )
    ).resolves.toEqual({ success: true });

    expect(enhancePromptStreamingMock).toHaveBeenCalledWith(
      'rewrite this',
      99,
      'req-1'
    );

    await expect(
      sendRuntimeMessage({ action: 'enhancePromptStreaming' })
    ).resolves.toEqual({ success: false, error: 'Missing prompt parameter' });

    await expect(
      sendRuntimeMessage({ action: 'enhancePromptStreaming', prompt: 'retry me' })
    ).resolves.toEqual({ success: false, error: 'Cannot get tab ID' });
  });

  it('cancels streaming enhancement requests by request id', async () => {
    await loadBackground();

    await expect(
      sendRuntimeMessage({
        action: 'cancelEnhancePromptStreaming',
        requestId: 'req-2',
      })
    ).resolves.toEqual({ success: true });

    expect(cancelEnhancePromptStreamingMock).toHaveBeenCalledWith('req-2');

    await expect(
      sendRuntimeMessage({ action: 'cancelEnhancePromptStreaming' })
    ).resolves.toEqual({
      success: false,
      error: 'Missing request ID parameter',
    });
  });

  it('creates the context menu and refreshes quota state on install', async () => {
    await loadBackground();
    syncQuotaFromServerMock.mockClear();
    updateTrialBadgeMock.mockClear();

    listeners.onInstalled[0]();
    await flushMicrotasks();

    expect(contextMenusCreateMock).toHaveBeenCalledWith({
      id: 'enhancePrompt',
      title: 'Enhance Prompt',
      contexts: ['selection'],
    });
    expect(syncQuotaFromServerMock).toHaveBeenCalledTimes(1);
    expect(updateTrialBadgeMock).toHaveBeenCalledTimes(1);
  });

  it('handles restricted injections and forwards runtime-triggered tab events', async () => {
    await loadBackground();

    await expect(
      sendRuntimeMessage({ action: 'injectContentScript' })
    ).resolves.toEqual({ success: false, error: 'Missing tab ID parameter' });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    runtimeGetManifestMock.mockReturnValueOnce({});
    tabsGetMock.mockResolvedValueOnce({ id: 6, url: 'https://example.com/chat' });
    await expect(
      sendRuntimeMessage({ action: 'injectContentScript', tabId: 6 })
    ).resolves.toEqual({ success: false });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    tabsGetMock.mockResolvedValueOnce({ id: 8, url: 'chrome://settings' });
    await expect(
      sendRuntimeMessage({ action: 'injectContentScript', tabId: 8 })
    ).resolves.toEqual({ success: false });

    tabsGetMock.mockResolvedValueOnce({ id: 9, url: 'https://example.com/chat' });
    listeners.onContextMenuClicked[0](
      { menuItemId: 'enhancePrompt', selectionText: 'hello' } as chrome.contextMenus.OnClickData,
      { id: 9 } as chrome.tabs.Tab
    );
    expect(tabsSendMessageMock).toHaveBeenCalledWith(9, {
      action: 'enhanceSelection',
      text: 'hello',
    });

    tabsGetMock.mockResolvedValueOnce({ id: 11, url: 'https://example.com/chat' });
    await listeners.onCommand[0]('enhance_prompt', { id: 11 } as chrome.tabs.Tab);
    expect(tabsSendMessageMock).toHaveBeenCalledWith(11, {
      action: 'triggerEnhance',
    });

    tabsGetMock.mockResolvedValueOnce({ id: 12, url: 'https://example.com/chat' });
    await listeners.onActionClicked[0]({ id: 12 } as chrome.tabs.Tab);
    expect(tabsGetMock).toHaveBeenCalledWith(12);
  });

  it('updates badge on storage changes and reports live trial state without an api key', async () => {
    await loadBackground();
    updateTrialBadgeMock.mockClear();

    listeners.onStorageChanged[0](
      {
        prompt_enhancer_config: {
          oldValue: undefined,
          newValue: { apiKey: 'changed' },
        },
      },
      'local'
    );
    expect(updateTrialBadgeMock).toHaveBeenCalledTimes(1);

    getTrialDataMock.mockResolvedValueOnce({ maxUses: 10, usedCount: 10 });
    await expect(sendRuntimeMessage({ action: 'getTrialStatus' })).resolves.toEqual({
      success: true,
      trialState: 'TRIAL_EXPIRED',
      trialRemaining: 0,
      trialTotal: 10,
    });

    await expect(sendRuntimeMessage({ action: 'checkPermission' })).resolves.toEqual({
      success: false,
      error: 'Missing origin parameter',
    });

    await expect(sendRuntimeMessage({ action: 'requestPermission' })).resolves.toEqual({
      success: false,
      error: 'Missing origin parameter',
    });

    permissionsRequestMock.mockResolvedValueOnce(false);
    await expect(
      sendRuntimeMessage({
        action: 'requestPermission',
        origin: 'https://example.com',
      })
    ).resolves.toEqual({ success: false, hasPermission: false });
  });
});
