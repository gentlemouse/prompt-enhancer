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
  collapseButton,
  expandButton,
  showOnboarding,
  hideOnboarding,
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

/** Hover 后延迟收起定时器 */
let hoverCollapseTimer: number | null = null;
const HOVER_COLLAPSE_DELAY_MS = 100;

/** 是否已完成引导 */
let hasSeenOnboarding = false;
let onboardingStateLoaded = false;

/** 输入事件监听器（用于动态绑定/解绑） */
let activeInputListener: ((e: Event) => void) | null = null;
let typingListenerInput: EditableElement | null = null;

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
    detachTypingListener();
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
  detachTypingListener();
  clearHoverCollapseTimer();
  activeInput = null;
  detachActiveInputObservers();
  stopPositionSync();
};

/**
 * 清理 hover 收起定时器
 */
const clearHoverCollapseTimer = (): void => {
  if (hoverCollapseTimer !== null) {
    window.clearTimeout(hoverCollapseTimer);
    hoverCollapseTimer = null;
  }
};

/**
 * 解绑打字监听
 */
const detachTypingListener = (): void => {
  if (activeInputListener && typingListenerInput) {
    typingListenerInput.removeEventListener('input', activeInputListener);
  }
  activeInputListener = null;
  typingListenerInput = null;
};

/**
 * 处理用户输入事件 — 维持小星星态
 */
const handleTypingEvent = (): void => {
  if (!buttonState || currentRequestId) return;

  // 用户输入时维持小星星态
  collapseButton(buttonState);
};

/**
 * 在非生成状态下按 idle 规则收起
 */
const collapseButtonForIdle = (): void => {
  if (!buttonState || currentRequestId) return;
  if (!onboardingStateLoaded || !hasSeenOnboarding) return;
  if (!activeInput || !isValidInput(activeInput)) return;

  const isHoveringButton =
    buttonState.button.matches(':hover') ||
    !!buttonState.onboardingEl?.matches(':hover');
  if (isHoveringButton) return;

  collapseButton(buttonState);
};

/**
 * 延迟收起，避免鼠标边缘抖动导致闪烁
 */
const scheduleCollapseButtonForIdle = (): void => {
  clearHoverCollapseTimer();
  hoverCollapseTimer = window.setTimeout(() => {
    hoverCollapseTimer = null;
    collapseButtonForIdle();
  }, HOVER_COLLAPSE_DELAY_MS);
};

/**
 * 绑定按钮交互状态机：
 * idle(小星星) -> hover(完整图标) -> leave(延迟收回)
 */
const bindButtonInteractions = (state: ButtonState): void => {
  state.button.addEventListener('pointerenter', () => {
    clearHoverCollapseTimer();
    if (currentRequestId) return;
    if (!onboardingStateLoaded || !hasSeenOnboarding) return;
    expandButton(state);
  });

  state.button.addEventListener('pointerleave', () => {
    if (currentRequestId) return;
    if (!onboardingStateLoaded || !hasSeenOnboarding) return;
    scheduleCollapseButtonForIdle();
  });

  state.button.addEventListener('focus', () => {
    clearHoverCollapseTimer();
    if (currentRequestId) return;
    if (!onboardingStateLoaded || !hasSeenOnboarding) return;
    expandButton(state);
  });

  state.button.addEventListener('blur', () => {
    if (currentRequestId) return;
    if (!onboardingStateLoaded || !hasSeenOnboarding) return;
    scheduleCollapseButtonForIdle();
  });
};

/**
 * 为当前输入框绑定打字监听
 */
const attachTypingListener = (input: EditableElement): void => {
  if (activeInputListener && typingListenerInput === input) return;
  detachTypingListener();
  activeInputListener = handleTypingEvent;
  typingListenerInput = input;
  input.addEventListener('input', activeInputListener);
};

/**
 * 标记引导完成
 */
const markOnboardingSeen = (): void => {
  if (hasSeenOnboarding) return;
  hasSeenOnboarding = true;
  onboardingStateLoaded = true;
  if (buttonState) {
    hideOnboarding(buttonState);
  }
  try {
    chrome.storage.local.set({ prompt_enhancer_onboarding_seen: true });
  } catch {
    // 忽略存储错误
  }

  if (activeInput && isValidInput(activeInput)) {
    attachTypingListener(activeInput);
    collapseButtonForIdle();
  }
};

/**
 * Shadow DOM 内是否有增强器焦点
 */
const isEnhancerFocused = (): boolean => {
  if (!buttonState) return false;

  const root = buttonState.button.getRootNode();
  if (!(root instanceof ShadowRoot)) return false;
  const focused = root.activeElement;
  if (!focused) return false;

  if (focused === buttonState.button) return true;
  return !!(
    buttonState.onboardingEl && buttonState.onboardingEl.contains(focused)
  );
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
  clearHoverCollapseTimer();

  // 默认先走小星星态，避免状态加载前出现展开闪烁
  if (!currentRequestId) {
    collapseButton(buttonState);
  }

  // 首次使用：在状态加载完成后再决定是否显示引导，避免旧用户闪现
  if (onboardingStateLoaded && !hasSeenOnboarding) {
    expandButton(buttonState);
    showOnboarding(buttonState, markOnboardingSeen);
    detachTypingListener();
  }

  // 绑定打字监听（仅在引导完成后才会自动收起）
  if (onboardingStateLoaded && hasSeenOnboarding) {
    attachTypingListener(target);
    collapseButton(buttonState);
  }

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

  // 首次增强 → 标记引导完成
  markOnboardingSeen();

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
  collapseButtonForIdle();
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
  bindButtonInteractions(buttonState);
  buttonState.container.style.display = 'none';

  // 注册 Shadow Host 重建回调
  // 当 SPA 路由切换导致 Shadow Host 被移除后重建时，重新创建按钮
  onShadowHostRebuild(() => {
    buttonState = createEnhanceButton(handleButtonClick);
    bindButtonInteractions(buttonState);
    buttonState.container.style.display = 'none';
    // 如果之前有活跃输入框，立即重新显示按钮
    if (activeInput && isValidInput(activeInput)) {
      showButton(activeInput);
    }
  });

  // 从 storage 读取引导状态
  try {
    chrome.storage.local.get(
      'prompt_enhancer_onboarding_seen',
      (result: { [key: string]: unknown }) => {
        hasSeenOnboarding = !!result.prompt_enhancer_onboarding_seen;
        onboardingStateLoaded = true;

        if (!buttonState || !activeInput || !isValidInput(activeInput)) return;

        if (hasSeenOnboarding) {
          hideOnboarding(buttonState);
          attachTypingListener(activeInput);
          collapseButton(buttonState);
          return;
        }

        expandButton(buttonState);
        showOnboarding(buttonState, markOnboardingSeen);
      }
    );
  } catch {
    // 忽略存储错误
    onboardingStateLoaded = true;
  }

  // 创建输入框检测器
  createInputDetector({
    onFocus: target => {
      showButton(target);
    },
    onBlur: () => {
      const isHoveringButton =
        !!buttonState?.button.matches(':hover') ||
        !!buttonState?.onboardingEl?.matches(':hover');
      const isFocusInsideEnhancer = isEnhancerFocused();

      // 检查焦点是否在按钮上或正在流式输出
      if (isHoveringButton || isFocusInsideEnhancer || currentRequestId) {
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
