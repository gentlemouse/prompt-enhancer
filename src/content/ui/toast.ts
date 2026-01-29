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
}

/** Toast 类名 */
const TOAST_CLASS = 'prompt-enhancer-toast';

/** 当前 Toast 元素 */
let currentToast: HTMLElement | null = null;

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
