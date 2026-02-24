/**
 * Background Service Worker 入口
 * 处理扩展的后台逻辑
 */

import {
  enhancePrompt,
  enhancePromptStreaming,
  updateTrialBadge,
} from './enhancer';
import { API_PROVIDERS, TRIAL_MAX_USES } from '@shared/constants';
import { getTrialData, syncQuotaFromServer } from '@shared/trial';
import { getStorageConfig } from '@shared/storage';
import type {
  ExtensionMessage,
  MessageResponse,
  TrialState,
} from '@shared/types';

/** 颜色方案存储键 */
const COLOR_SCHEME_KEY = 'prompt_enhancer_color_scheme';

/**
 * 暗色模式图标切换
 * 同时保存状态到 storage，以便 Service Worker 重启时恢复
 */
const setIconForColorScheme = (isDark: boolean): void => {
  const iconPath = isDark ? 'icons/dark' : 'icons';
  chrome.action.setIcon({
    path: {
      '16': `${iconPath}/icon16.png`,
      '48': `${iconPath}/icon48.png`,
      '128': `${iconPath}/icon128.png`,
    },
  });
  // 保存状态
  chrome.storage.local.set({ [COLOR_SCHEME_KEY]: isDark });
};

/**
 * 初始化颜色方案
 * 从 storage 读取上次保存的状态
 */
const initColorScheme = async (): Promise<void> => {
  const result = await chrome.storage.local.get(COLOR_SCHEME_KEY);
  if (result[COLOR_SCHEME_KEY] !== undefined) {
    setIconForColorScheme(result[COLOR_SCHEME_KEY]);
  }
};

// Service Worker 启动时初始化
initColorScheme();
syncQuotaFromServer().then(() => updateTrialBadge());

/**
 * 动态注入 Content Script
 * P0-1.1: 按需注入而非全站默认注入
 * 从 manifest 读取实际的 content_scripts 文件路径，兼容 Vite/CRXJS 构建后的哈希文件名
 */
const injectContentScript = async (tabId: number): Promise<boolean> => {
  try {
    // 检查是否有权限
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return false;

    // 跳过 chrome:// 等特殊页面
    if (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:')
    ) {
      return false;
    }

    // 从 manifest 读取实际的 content script 文件路径
    const manifest = chrome.runtime.getManifest();
    const contentScriptEntry = manifest.content_scripts?.[0];

    if (!contentScriptEntry) {
      // 扩展运行时缺失 content_scripts 时需保留警告便于排查
      // eslint-disable-next-line no-console -- 有意保留的运行时诊断信息
      console.warn('[Prompt Enhancer] No content_scripts found in manifest');
      return false;
    }

    // 注入 CSS
    if (contentScriptEntry.css && contentScriptEntry.css.length > 0) {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: contentScriptEntry.css,
      });
    }

    // 注入 JS
    if (contentScriptEntry.js && contentScriptEntry.js.length > 0) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: contentScriptEntry.js,
      });
    }

    return true;
  } catch {
    // 可能没有权限，这是预期的
    return false;
  }
};

/**
 * 检查是否有主机权限
 */
const checkHostPermission = async (origin: string): Promise<boolean> => {
  try {
    const hasPermission = await chrome.permissions.contains({
      origins: [origin + '/*'],
    });
    return hasPermission;
  } catch {
    return false;
  }
};

/**
 * 请求主机权限
 */
const requestHostPermission = async (origin: string): Promise<boolean> => {
  try {
    const granted = await chrome.permissions.request({
      origins: [origin + '/*'],
    });
    return granted;
  } catch {
    return false;
  }
};

/** Onboarding 状态键 */
const ONBOARDING_KEY = 'prompt_enhancer_onboarding_complete';

/**
 * 检查是否需要 Onboarding
 */
const checkOnboarding = async (): Promise<boolean> => {
  const result = await chrome.storage.local.get(ONBOARDING_KEY);
  return !result[ONBOARDING_KEY];
};

/**
 * 完成 Onboarding
 */
const completeOnboarding = async (): Promise<void> => {
  await chrome.storage.local.set({ [ONBOARDING_KEY]: true });
};

/**
 * 消息监听器
 */
chrome.runtime.onMessage.addListener(
  (
    request: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    const handleMessage = async (): Promise<MessageResponse> => {
      switch (request.action) {
        case 'enhancePrompt': {
          if (!request.prompt) {
            return { success: false, error: 'Missing prompt parameter' };
          }
          try {
            const enhanced = await enhancePrompt(request.prompt);
            return { success: true, enhanced };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }

        case 'enhancePromptStreaming': {
          if (!request.prompt) {
            return { success: false, error: 'Missing prompt parameter' };
          }
          // 从 sender 获取 tab ID
          const tabId = sender.tab?.id || request.tabId;
          if (!tabId) {
            return { success: false, error: 'Cannot get tab ID' };
          }
          // 流式处理（传递会话历史）
          enhancePromptStreaming(
            request.prompt,
            tabId,
            request.requestId || Date.now().toString(),
            ((request as unknown as Record<string, unknown>)
              .history as import('@shared/types').HistoryItem[]) || []
          );
          return { success: true };
        }

        case 'getProviders': {
          return { success: true, providers: API_PROVIDERS };
        }

        case 'injectContentScript': {
          if (!request.tabId) {
            return { success: false, error: 'Missing tabId parameter' };
          }
          const injected = await injectContentScript(request.tabId);
          return { success: injected };
        }

        case 'checkPermission': {
          if (!request.origin) {
            return { success: false, error: 'Missing origin parameter' };
          }
          const hasPermission = await checkHostPermission(request.origin);
          return { success: true, hasPermission };
        }

        case 'requestPermission': {
          if (!request.origin) {
            return { success: false, error: 'Missing origin parameter' };
          }
          const granted = await requestHostPermission(request.origin);
          return { success: granted, hasPermission: granted };
        }

        // P2-3.8: Onboarding 相关
        case 'checkOnboarding': {
          const needsOnboarding = await checkOnboarding();
          return { success: true, needsOnboarding };
        }

        case 'completeOnboarding': {
          await completeOnboarding();
          return { success: true };
        }

        case 'getTrialStatus': {
          const config = await getStorageConfig();
          if (config?.apiKey) {
            return {
              success: true,
              trialState: 'API_CONFIGURED' as TrialState,
              trialRemaining: TRIAL_MAX_USES,
              trialTotal: TRIAL_MAX_USES,
            };
          }
          await syncQuotaFromServer();
          const trialData = await getTrialData();
          const remaining = Math.max(
            0,
            trialData.maxUses - trialData.usedCount
          );
          const state: TrialState =
            remaining > 0 ? 'TRIAL_ACTIVE' : 'TRIAL_EXPIRED';
          return {
            success: true,
            trialState: state,
            trialRemaining: remaining,
            trialTotal: trialData.maxUses,
          };
        }

        // 暗色模式切换
        case 'colorSchemeChange': {
          setIconForColorScheme(request.isDark === true);
          return { success: true };
        }

        default:
          return { success: false, error: 'Unknown action type' };
      }
    };

    handleMessage().then(sendResponse);
    return true; // 保持消息通道开放
  }
);

/**
 * 右键菜单
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'enhancePrompt',
    title: chrome.i18n.getMessage('contextMenuEnhance'),
    contexts: ['selection'],
  });
  syncQuotaFromServer().then(() => updateTrialBadge());
});

/** 监听存储变化 — 用户保存 API Key 后立即清除 Badge */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['prompt_enhancer_config']) {
    updateTrialBadge();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'enhancePrompt' && info.selectionText && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'enhanceSelection',
      text: info.selectionText,
    });
  }
});

/**
 * 快捷键处理
 */
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'enhance_prompt' && tab?.id) {
    // 尝试注入脚本（如果还没注入的话）
    await injectContentScript(tab.id);

    // 发送快捷键触发消息
    chrome.tabs.sendMessage(tab.id, {
      action: 'triggerEnhance',
    });
  }
});

/**
 * 扩展图标点击时尝试注入脚本
 * P0-1.1: 用户主动触发时才注入
 */
chrome.action.onClicked.addListener(async tab => {
  if (tab.id) {
    await injectContentScript(tab.id);
  }
});
