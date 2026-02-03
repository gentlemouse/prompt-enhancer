/**
 * Content Script 入口
 * 负责在页面上注入增强按钮和处理用户交互
 * P2-3.2: 支持流式输出（直接在输入框中显示）
 * P2-3.3: 使用 Shadow DOM 封装
 */

import {
  createEnhanceButton,
  positionButton,
  hideButton,
  setButtonStreaming,
  type ButtonState,
} from './ui/button';
import { showToast } from './ui/toast';
import {
  createInputDetector,
  findEditableElement,
  isValidInput,
  getActiveInput,
  setInputValue,
  getInputValue,
  type EditableElement,
} from './services/input-detector';
import { tryUndo, saveOriginalContent } from './services/enhance-handler';

/** 获取图标 URL */
const ICON_URL = chrome.runtime.getURL('icons/icon24.png');

/** 当前活跃的输入框 */
let activeInput: EditableElement | null = null;

/** 按钮状态 */
let buttonState: ButtonState | null = null;

/** 当前流式请求 ID */
let currentRequestId: string | null = null;

/** 当前流式输入框 */
let streamingInput: EditableElement | null = null;

/** 流式累积文本 */
let streamingText = '';

/** 用于标识元素的数据属性 */
const ELEMENT_ID_ATTR = 'data-prompt-enhancer-id';
let nextElementId = 1;

/**
 * 获取或创建元素的唯一标识
 */
const getElementId = (el: HTMLElement): string => {
  let id = el.getAttribute(ELEMENT_ID_ATTR);
  if (!id) {
    id = `pe-${nextElementId++}`;
    el.setAttribute(ELEMENT_ID_ATTR, id);
  }
  return id;
};

/** 已定位的输入框 ID */
let positionedInputId: string | null = null;

/**
 * 显示按钮
 * @param target 目标输入框
 */
const showButton = (target: EditableElement): void => {
  if (!buttonState) return;

  // 如果正在流式输出，不处理
  if (currentRequestId) return;

  activeInput = target;

  // 使用元素 ID 比较，而不是引用比较
  // 这样即使 DOM 更新导致元素引用变化，只要是同一个 DOM 节点就不会重新定位
  const targetId = getElementId(target as HTMLElement);
  if (targetId !== positionedInputId) {
    positionButton(buttonState.container, target);
    positionedInputId = targetId;
  }

  buttonState.container.style.display = 'flex';
};

/**
 * 处理流式增强请求
 * P2-3.2: 直接在输入框中流式显示
 */
const handleStreamingEnhance = async (input: EditableElement): Promise<void> => {
  if (!buttonState) return;

  // 如果已经在流式输出中，忽略
  if (currentRequestId) {
    showToast('正在处理中...');
    return;
  }

  const originalText = getInputValue(input);
  if (!originalText.trim()) {
    showToast('输入框为空');
    return;
  }

  // 保存原始内容用于撤回
  saveOriginalContent(input, originalText);

  // 生成请求 ID
  currentRequestId = Date.now().toString();
  streamingInput = input;
  streamingText = '';

  // 设置按钮流式状态
  setButtonStreaming(buttonState, true);

  // 清空输入框，准备接收流式内容
  setInputValue(input, '');
  showToast('润色中...');

  // 发送流式请求
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'enhancePromptStreaming',
      prompt: originalText,
      tabId: 0, // background 会从 sender.tab.id 获取
      requestId: currentRequestId,
    });

    if (!response?.success) {
      // 恢复原始内容
      setInputValue(input, originalText);
      showToast('✗ ' + (response?.error || '请求失败'));
      resetStreamingState();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    // 恢复原始内容
    setInputValue(input, originalText);
    if (errorMessage.includes('Extension context invalidated')) {
      showToast('扩展已更新，请刷新页面');
    } else {
      showToast('✗ ' + errorMessage);
    }
    resetStreamingState();
  }
};

/**
 * 重置流式状态
 */
const resetStreamingState = (): void => {
  if (buttonState) {
    setButtonStreaming(buttonState, false);
  }
  currentRequestId = null;
  streamingInput = null;
  streamingText = '';
};

/**
 * 处理点击按钮
 */
const handleButtonClick = (): void => {
  if (activeInput) {
    handleStreamingEnhance(activeInput);
  }
};

/**
 * 初始化
 */
const init = (): void => {
  // 创建按钮
  buttonState = createEnhanceButton(ICON_URL, handleButtonClick);
  buttonState.container.style.display = 'none';

  // 创建输入框检测器
  createInputDetector({
    onFocus: target => {
      showButton(target);
    },
    onBlur: () => {
      // 检查焦点是否在按钮上或正在流式输出
      if (buttonState?.container.matches(':hover') || currentRequestId) {
        return;
      }
      if (buttonState) {
        hideButton(buttonState.container);
      }
    },
  });

  // 窗口大小变化时更新位置
  window.addEventListener('resize', () => {
    if (activeInput && buttonState && buttonState.container.style.display !== 'none') {
      // 窗口大小变化时强制重新定位
      positionButton(buttonState.container, activeInput);
    }
  });

  // 快捷键处理
  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl+Z / Cmd+Z 撤回
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const focused = document.activeElement;
        const target = findEditableElement(focused);
        if (target && isValidInput(target)) {
          if (tryUndo(target)) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }

      // Escape 取消流式输出
      if (e.key === 'Escape' && currentRequestId) {
        e.preventDefault();
        // 取消流式，但保留已生成的内容
        showToast('已停止生成');
        resetStreamingState();
        return;
      }

      // Cmd/Ctrl+Shift+E 润色
      if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        e.stopPropagation();

        let target = activeInput;
        if (!target || !isValidInput(target)) {
          target = getActiveInput();
          if (target) activeInput = target;
        }

        if (target) {
          handleStreamingEnhance(target);
        } else {
          showToast('请先点击输入框');
        }
      }
    },
    true
  );

  // 监听来自 background 的流式消息
  chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
    // 流式数据块 - 直接更新输入框
    if (req.action === 'streamChunk' && req.requestId === currentRequestId && streamingInput) {
      streamingText += req.chunk;
      setInputValue(streamingInput, streamingText);
      sendResponse({ success: true });
      return;
    }

    // 流式完成
    if (req.action === 'streamEnd' && req.requestId === currentRequestId) {
      showToast('✓ 完成 (Ctrl+Z 可撤回)');
      resetStreamingState();
      sendResponse({ success: true });
      return;
    }

    // 流式错误
    if (req.action === 'streamError' && req.requestId === currentRequestId) {
      // 如果已有部分内容，保留它
      if (streamingText) {
        showToast('⚠ 生成中断，已保留部分内容');
      } else if (streamingInput) {
        // 没有内容时，尝试恢复原始内容
        tryUndo(streamingInput);
        showToast('✗ ' + (req.error || '未知错误'));
      }
      resetStreamingState();
      sendResponse({ success: true });
      return;
    }

    // 触发增强（快捷键或右键菜单）
    if (req.action === 'enhanceSelection' || req.action === 'triggerEnhance') {
      const target = getActiveInput();
      if (target) {
        activeInput = target;
        handleStreamingEnhance(target);
      }
      sendResponse({ success: true });
      return;
    }
  });
};

/**
 * 检测并通知颜色方案变化
 * 用于切换工具栏图标的暗色/亮色版本
 */
const setupColorSchemeDetection = (): void => {
  const notifyColorScheme = (isDark: boolean): void => {
    chrome.runtime.sendMessage({ action: 'colorSchemeChange', isDark }).catch(() => {
      // 忽略错误（扩展可能已重新加载）
    });
  };

  // 检测当前颜色方案
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  notifyColorScheme(mediaQuery.matches);

  // 监听颜色方案变化
  mediaQuery.addEventListener('change', e => {
    notifyColorScheme(e.matches);
  });
};

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    setupColorSchemeDetection();
  });
} else {
  init();
  setupColorSchemeDetection();
}
