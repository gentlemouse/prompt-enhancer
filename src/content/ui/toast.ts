/**
 * Toast 通知组件
 * P2-3.3: 使用 Shadow DOM 封装
 */

import { getShadowHost } from './shadow-host';

/** Toast 配置 */
interface ToastConfig {
  /** 消息内容 */
  message: string;
  /** 持续时间（毫秒） */
  duration?: number;
  /** 类型 */
  type?: 'info' | 'success' | 'error';
  /** 锚点元素（可选，未传时尝试使用当前焦点输入框） */
  anchor?: HTMLElement | null;
  /** 锚点矩形（可选，用于同一流程内固定位置） */
  anchorRect?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  } | null;
  /** 位置策略 */
  placement?: 'auto' | 'top-center';
}

/** Toast 类名 */
const TOAST_CLASS = 'prompt-enhancer-toast';

/** 当前 Toast 元素 */
let currentToast: HTMLElement | null = null;

const TOAST_EDGE_PADDING = 12;
const TOAST_ANCHOR_GAP = 10;
const TOAST_TOP_OFFSET = 16;

/**
 * 判断元素是否可见
 */
const isVisibleElement = (el: HTMLElement): boolean => {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const opacity = Number.parseFloat(style.opacity || '1');
  if (!Number.isNaN(opacity) && opacity <= 0) return false;
  return el.getClientRects().length > 0;
};

/**
 * 判断是否可作为输入锚点
 */
const isEditableAnchor = (el: HTMLElement): boolean => {
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const input = el as HTMLInputElement;
    return input.type !== 'hidden';
  }
  if (el.isContentEditable) return true;
  return (
    el.getAttribute('role') === 'textbox' ||
    el.getAttribute('contenteditable') === 'true'
  );
};

/**
 * 获取默认锚点：当前焦点输入元素
 */
const getDefaultAnchor = (): HTMLElement | null => {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  if (!isEditableAnchor(active) || !isVisibleElement(active)) return null;
  return active;
};

/**
 * 应用顶部居中布局
 */
const applyTopCenterPlacement = (toast: HTMLElement): void => {
  toast.dataset.placement = 'top-center';
  toast.style.setProperty('--pe-toast-left', '50%');
  toast.style.setProperty('--pe-toast-top', `${TOAST_TOP_OFFSET}px`);
  toast.style.setProperty('--pe-toast-translate-x', '-50%');
  toast.style.setProperty('--pe-toast-translate-y', '-10px');
};

/**
 * 判断矩形是否可用
 */
const isValidAnchorRect = (rect: {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}): boolean => {
  if (
    rect.width < 50 ||
    rect.height < 10 ||
    rect.bottom < 0 ||
    rect.right < 0 ||
    rect.left > window.innerWidth ||
    rect.top > window.innerHeight
  ) {
    return false;
  }

  return true;
};

/**
 * 按矩形应用锚点布局，成功返回 true
 */
const applyAnchoredPlacementByRect = (
  toast: HTMLElement,
  rect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  }
): boolean => {
  if (!isValidAnchorRect(rect)) return false;

  const toastWidth = toast.offsetWidth;
  const toastHeight = toast.offsetHeight;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  if (toastWidth <= 0 || toastHeight <= 0) return false;

  const minLeft = TOAST_EDGE_PADDING;
  const maxLeft = Math.max(minLeft, viewportWidth - toastWidth - minLeft);
  const centeredLeft = rect.left + (rect.width - toastWidth) / 2;
  const left = Math.round(Math.min(maxLeft, Math.max(minLeft, centeredLeft)));

  const topAbove = Math.round(rect.top - toastHeight - TOAST_ANCHOR_GAP);
  const topBelow = Math.round(rect.bottom + TOAST_ANCHOR_GAP);
  const canPlaceAbove = topAbove >= TOAST_EDGE_PADDING;
  const canPlaceBelow =
    topBelow + toastHeight <= viewportHeight - TOAST_EDGE_PADDING;

  if (!canPlaceAbove && !canPlaceBelow) return false;

  const placeAbove = canPlaceAbove || !canPlaceBelow;
  const top = placeAbove ? topAbove : topBelow;

  toast.dataset.placement = placeAbove ? 'anchored-above' : 'anchored-below';
  toast.style.setProperty('--pe-toast-left', `${left}px`);
  toast.style.setProperty('--pe-toast-top', `${top}px`);
  toast.style.setProperty('--pe-toast-translate-x', '0');
  toast.style.setProperty(
    '--pe-toast-translate-y',
    placeAbove ? '-8px' : '8px'
  );

  return true;
};

/**
 * 尝试应用锚点布局，成功返回 true
 */
const applyAnchoredPlacement = (
  toast: HTMLElement,
  anchor: HTMLElement
): boolean => {
  if (!isVisibleElement(anchor)) return false;
  return applyAnchoredPlacementByRect(toast, anchor.getBoundingClientRect());
};

/**
 * 计算并设置 Toast 位置
 */
const positionToast = (toast: HTMLElement, options: ToastConfig): void => {
  if (options.placement === 'top-center') {
    applyTopCenterPlacement(toast);
    return;
  }

  if (
    options.anchorRect &&
    applyAnchoredPlacementByRect(toast, options.anchorRect)
  ) {
    return;
  }

  const anchor = options.anchor ?? getDefaultAnchor();
  if (anchor && applyAnchoredPlacement(toast, anchor)) {
    return;
  }

  applyTopCenterPlacement(toast);
};

/**
 * 显示 Toast 通知
 * P2-3.3: 在 Shadow DOM 中创建
 * @param config Toast 配置或消息字符串
 */
export const showToast = (config: ToastConfig | string): void => {
  const options: ToastConfig =
    typeof config === 'string' ? { message: config } : config;
  const { message, duration = 2000 } = options;

  const { root } = getShadowHost();

  // 移除已存在的 Toast
  if (currentToast && root.contains(currentToast)) {
    root.removeChild(currentToast);
  }

  // 创建新 Toast
  const toast = document.createElement('div');
  toast.className = TOAST_CLASS;
  toast.textContent = message;
  // P2-3.6: 无障碍属性
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  root.appendChild(toast);
  positionToast(toast, options);
  currentToast = toast;

  // 显示动画
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // 自动隐藏
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (root.contains(toast)) {
        root.removeChild(toast);
      }
      if (currentToast === toast) {
        currentToast = null;
      }
    }, 250);
  }, duration);
};
