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
import { showTrialExpiredPrompt } from './ui/trial-prompt';
import { onShadowHostRebuild } from './ui/shadow-host';
import { t } from '@shared/i18n';
import {
  createInputDetector,
  findEditableElement,
  isValidInput,
  getActiveInput,
  setInputValueDirect,
  getInputValue,
  type EditableElement,
} from './services/input-detector';
import { tryUndo, saveOriginalContent } from './services/enhance-handler';
import {
  initSessionMemory,
  pushHistory,
  updateLastEnhanced,
  getHistory,
} from './services/session-memory';

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

/** rAF 定位任务 ID */
let positionFrameId: number | null = null;

/** 定位兜底定时器 ID */
let positionSyncTimer: number | null = null;

/** 当前已绑定滚动监听的容器 */
let observedScrollContainers: HTMLElement[] = [];

/** 当前输入框 ResizeObserver */
let activeInputResizeObserver: {
  disconnect: () => void;
  observe: (target: Element) => void;
} | null = null;

/** 是否滚动容器 */
const isScrollableElement = (el: HTMLElement): boolean => {
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY;
  const overflowX = style.overflowX;
  const allowScroll = /(auto|scroll|overlay)/;

  return (
    (allowScroll.test(overflowY) && el.scrollHeight > el.clientHeight) ||
    (allowScroll.test(overflowX) && el.scrollWidth > el.clientWidth)
  );
};

/**
 * 收集输入框的可滚动祖先（用于监听局部滚动容器）
 */
const collectScrollableAncestors = (input: HTMLElement): HTMLElement[] => {
  const ancestors: HTMLElement[] = [];
  let current = input.parentElement;

  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    if (isScrollableElement(current)) {
      ancestors.push(current);
    }
    current = current.parentElement;
  }

  return ancestors;
};

/**
 * 清理当前输入框关联观察器
 */
const detachActiveInputObservers = (): void => {
  if (activeInputResizeObserver) {
    activeInputResizeObserver.disconnect();
    activeInputResizeObserver = null;
  }

  for (const container of observedScrollContainers) {
    container.removeEventListener('scroll', scheduleButtonPosition);
  }
  observedScrollContainers = [];
};

/**
 * 给当前输入框挂载滚动/尺寸监听
 */
const attachActiveInputObservers = (input: EditableElement): void => {
  detachActiveInputObservers();

  observedScrollContainers = collectScrollableAncestors(input);
  for (const container of observedScrollContainers) {
    container.addEventListener('scroll', scheduleButtonPosition, {
      passive: true,
    });
  }

  if (typeof window.ResizeObserver !== 'undefined') {
    activeInputResizeObserver = new window.ResizeObserver(() => {
      scheduleButtonPosition();
    });
    activeInputResizeObserver.observe(input);

    // 观察一层父容器，覆盖大多数「输入框外壳尺寸变化」场景
    if (input.parentElement) {
      activeInputResizeObserver.observe(input.parentElement);
    }
  }
};

/**
 * 兜底同步：处理无事件触发的布局漂移（动画、异步插入内容等）
 */
const startPositionSync = (): void => {
  if (positionSyncTimer !== null) return;

  positionSyncTimer = window.setInterval(() => {
    scheduleButtonPosition();
  }, 250);
};

/**
 * 停止兜底同步
 */
const stopPositionSync = (): void => {
  if (positionSyncTimer !== null) {
    window.clearInterval(positionSyncTimer);
    positionSyncTimer = null;
  }
};

/**
 * 立即更新按钮位置
 */
const updateButtonPosition = (): void => {
  if (!buttonState || !activeInput) return;

  if (!activeInput.isConnected || !isValidInput(activeInput)) {
    hideButton(buttonState.container);
    activeInput = null;
    detachActiveInputObservers();
    stopPositionSync();
    return;
  }

  positionButton(buttonState.container, activeInput);
};

/**
 * 调度按钮位置更新（rAF 合帧）
 */
function scheduleButtonPosition(): void {
  if (positionFrameId !== null) return;

  positionFrameId = window.requestAnimationFrame(() => {
    positionFrameId = null;
    updateButtonPosition();
  });
}

/**
 * 隐藏按钮并清理定位状态
 */
const hideEnhanceButton = (): void => {
  if (!buttonState) return;
  hideButton(buttonState.container);
  activeInput = null;
  detachActiveInputObservers();
  stopPositionSync();
};

/**
 * 显示按钮
 * @param target 目标输入框
 */
const showButton = (target: EditableElement): void => {
  if (!buttonState) return;

  // 如果正在流式输出，仅允许跟随当前流式输入框
  if (currentRequestId && streamingInput && target !== streamingInput) return;

  if (!target.isConnected || !isValidInput(target)) {
    hideEnhanceButton();
    return;
  }

  activeInput = target;
  attachActiveInputObservers(target);

  updateButtonPosition();
  startPositionSync();
};

/**
 * 处理流式增强请求
 * P2-3.2: 直接在输入框中流式显示
 */
const handleStreamingEnhance = async (
  input: EditableElement
): Promise<void> => {
  if (!buttonState) return;

  // 如果已经在流式输出中，忽略
  if (currentRequestId) {
    showToast(t('toastProcessing'));
    return;
  }

  const originalText = getInputValue(input);
  if (!originalText.trim()) {
    showToast(t('toastEmpty'));
    return;
  }

  // 保存原始内容用于撤回
  saveOriginalContent(input, originalText);

  // 记录到会话历史
  pushHistory(originalText);

  // 生成请求 ID
  currentRequestId = Date.now().toString();
  streamingInput = input;
  streamingText = '';

  // 设置按钮流式状态
  setButtonStreaming(buttonState, true);

  // 清空输入框，准备接收流式内容（静默写入，不创建 undo 记录）
  setInputValueDirect(input, '');
  scheduleButtonPosition();
  showToast(t('toastEnhancing'));

  // 发送流式请求（附带会话历史）
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'enhancePromptStreaming',
      prompt: originalText,
      tabId: 0,
      requestId: currentRequestId,
      history: getHistory(),
    });

    if (!response?.success) {
      setInputValueDirect(input, originalText);
      if (response?.error === 'TRIAL_EXPIRED') {
        showTrialExpiredPrompt();
      } else {
        showToast('✗ ' + (response?.error || t('toastRequestFailed')));
      }
      resetStreamingState();
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : t('statusUnknownError');
    setInputValueDirect(input, originalText);
    if (errorMessage.includes('TRIAL_EXPIRED')) {
      showTrialExpiredPrompt();
    } else if (errorMessage.includes('Extension context invalidated')) {
      showToast(t('toastRefreshPage'));
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
  scheduleButtonPosition();
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
 * 根据剩余试用次数展示分级 Toast 提示
 */
const showTrialToast = (
  remaining: number,
  total: number,
  isMac: boolean
): void => {
  const undoKey = isMac ? '⌘Z' : 'Ctrl+Z';
  const doneBase = `✓ ${t('popupUndo')} ${undoKey}`;

  if (remaining > 5) {
    showToast({
      message: `${doneBase}  ·  ${t('trialRemaining', String(remaining), String(total))}`,
      duration: 3000,
    });
  } else if (remaining > 3) {
    showToast({
      message: `${doneBase}  ·  ${t('trialRemaining', String(remaining), String(total))}`,
      duration: 4000,
    });
  } else if (remaining > 0) {
    showToast({
      message: `⚠ ${t('trialLow', String(remaining))}  (${undoKey})`,
      duration: 5000,
    });
  } else {
    showToast({
      message: `✓ ${t('trialExpired')}`,
      duration: 4000,
    });
  }
};

/**
 * 初始化
 */
const init = (): void => {
  // 初始化会话记忆
  initSessionMemory();

  // 创建按钮
  buttonState = createEnhanceButton(handleButtonClick);
  buttonState.container.style.display = 'none';

  // 注册 Shadow Host 重建回调
  // 当 SPA 路由切换导致 Shadow Host 被移除后重建时，重新创建按钮
  onShadowHostRebuild(() => {
    buttonState = createEnhanceButton(handleButtonClick);
    buttonState.container.style.display = 'none';
    // 如果之前有活跃输入框，立即重新显示按钮
    if (activeInput && isValidInput(activeInput)) {
      showButton(activeInput);
    }
  });

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
      hideEnhanceButton();
    },
  });

  // 全局布局变更监听：窗口尺寸/文档滚动/移动端视口变化
  window.addEventListener('resize', scheduleButtonPosition, { passive: true });
  document.addEventListener('scroll', scheduleButtonPosition, true);
  window.visualViewport?.addEventListener('resize', scheduleButtonPosition, {
    passive: true,
  });
  window.visualViewport?.addEventListener('scroll', scheduleButtonPosition, {
    passive: true,
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
        showToast(t('toastStopped'));
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
          showToast(t('toastClickInput'));
        }
      }
    },
    true
  );

  // 监听来自 background 的流式消息
  chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
    // 流式数据块 - 静默写入输入框（不创建 undo 记录）
    if (
      req.action === 'streamChunk' &&
      req.requestId === currentRequestId &&
      streamingInput
    ) {
      streamingText += req.chunk;
      setInputValueDirect(streamingInput, streamingText);
      scheduleButtonPosition();
      sendResponse({ success: true });
      return;
    }

    // 流式完成
    if (req.action === 'streamEnd' && req.requestId === currentRequestId) {
      if (streamingText) {
        updateLastEnhanced(streamingText);
      }

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const remaining = req.trialRemaining as number | undefined;
      const total = req.trialTotal as number | undefined;

      if (remaining !== undefined && total !== undefined) {
        showTrialToast(remaining, total, isMac);
      } else {
        showToast(t(isMac ? 'toastDoneMac' : 'toastDone'));
      }

      resetStreamingState();
      sendResponse({ success: true });
      return;
    }

    // 流式错误
    if (req.action === 'streamError' && req.requestId === currentRequestId) {
      // 如果已有部分内容，保留它
      if (streamingText) {
        showToast(t('toastPartialKept'));
      } else if (streamingInput) {
        // 没有内容时，尝试恢复原始内容
        tryUndo(streamingInput);
        showToast('✗ ' + (req.error || t('statusUnknownError')));
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

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
} else {
  init();
}
