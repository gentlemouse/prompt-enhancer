/**
 * Shadow DOM 宿主组件
 * P2-3.3: 将 UI 封装在 Shadow DOM 中，避免 CSS 污染
 */

import { getStyles } from './styles';

/** Shadow Host 实例 */
let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;

/**
 * 创建或获取 Shadow Host
 */
export const getShadowHost = (): { host: HTMLElement; root: ShadowRoot } => {
  if (shadowHost && shadowRoot) {
    return { host: shadowHost, root: shadowRoot };
  }

  // 创建宿主元素
  shadowHost = document.createElement('div');
  shadowHost.id = 'prompt-enhancer-shadow-host';
  shadowHost.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;

  // 创建 Shadow Root
  shadowRoot = shadowHost.attachShadow({ mode: 'open' });

  // 注入样式
  const style = document.createElement('style');
  style.textContent = getStyles();
  shadowRoot.appendChild(style);

  // 添加到文档
  document.body.appendChild(shadowHost);

  return { host: shadowHost, root: shadowRoot };
};

/**
 * 在 Shadow DOM 中创建元素
 */
export const createInShadow = <K extends keyof HTMLElementTagNameMap>(
  tagName: K
): HTMLElementTagNameMap[K] => {
  const { root } = getShadowHost();
  const element = document.createElement(tagName);
  root.appendChild(element);
  return element;
};

/**
 * 从 Shadow DOM 中移除元素
 */
export const removeFromShadow = (element: HTMLElement): void => {
  if (shadowRoot?.contains(element)) {
    shadowRoot.removeChild(element);
  }
};

/**
 * 清理 Shadow Host
 */
export const cleanupShadowHost = (): void => {
  if (shadowHost && shadowHost.parentNode) {
    shadowHost.parentNode.removeChild(shadowHost);
  }
  shadowHost = null;
  shadowRoot = null;
};
