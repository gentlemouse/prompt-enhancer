/**
 * Background Service Worker 入口
 * 处理扩展的后台逻辑
 */

import { enhancePrompt, enhancePromptStreaming } from './enhancer';
import { API_PROVIDERS } from '@shared/constants';
import type { ExtensionMessage, MessageResponse } from '@shared/types';

/**
 * 动态注入 Content Script
 * P0-1.1: 按需注入而非全站默认注入
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

    // 注入 CSS
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['src/content/styles.css'],
    });

    // 注入 JS
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/index.ts'],
    });

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
            return { success: false, error: '缺少 prompt 参数' };
          }
          try {
            const enhanced = await enhancePrompt(request.prompt);
            return { success: true, enhanced };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : '未知错误',
            };
          }
        }

        case 'enhancePromptStreaming': {
          if (!request.prompt) {
            return { success: false, error: '缺少 prompt 参数' };
          }
          // 从 sender 获取 tab ID
          const tabId = sender.tab?.id || request.tabId;
          if (!tabId) {
            return { success: false, error: '无法获取 tab ID' };
          }
          // 流式处理在单独的函数中进行
          enhancePromptStreaming(
            request.prompt,
            tabId,
            request.requestId || Date.now().toString()
          );
          return { success: true };
        }

        case 'getProviders': {
          return { success: true, providers: API_PROVIDERS };
        }

        case 'injectContentScript': {
          if (!request.tabId) {
            return { success: false, error: '缺少 tabId 参数' };
          }
          const injected = await injectContentScript(request.tabId);
          return { success: injected };
        }

        case 'checkPermission': {
          if (!request.origin) {
            return { success: false, error: '缺少 origin 参数' };
          }
          const hasPermission = await checkHostPermission(request.origin);
          return { success: true, hasPermission };
        }

        case 'requestPermission': {
          if (!request.origin) {
            return { success: false, error: '缺少 origin 参数' };
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

        default:
          return { success: false, error: '未知的操作类型' };
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
    title: '✨ 润色选中的 Prompt',
    contexts: ['selection'],
  });
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
