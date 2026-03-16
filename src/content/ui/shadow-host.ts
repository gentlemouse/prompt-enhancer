/**
 * Shadow DOM 宿主组件
 * P2-3.3: 将 UI 封装在 Shadow DOM 中，避免 CSS 污染
 * 含 SPA 存活检测：DOM 被框架移除后自动重建
 */

import { getStyles } from './styles';

/** Shadow Host DOM id */
export const SHADOW_HOST_ID = 'prompt-enhancer-shadow-host';

/** Shadow Host 实例 */
let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;

/** 存活检测定时器 */
let aliveCheckTimer: ReturnType<typeof setInterval> | null = null;

/** 重建回调队列（重建后通知组件重新挂载自身） */
type RebuildCallback = (root: ShadowRoot) => void;
const rebuildCallbacks: Set<RebuildCallback> = new Set();

/**
 * 注册重建回调
 * 当 Shadow Host 因 SPA 切换被移除后重建时，组件可通过此回调重新挂载自身
 */
export const onShadowHostRebuild = (cb: RebuildCallback): (() => void) => {
  rebuildCallbacks.add(cb);
  return () => rebuildCallbacks.delete(cb);
};

/**
 * 内部创建 Shadow Host
 */
const createShadowHost = (): { host: HTMLElement; root: ShadowRoot } => {
  // 创建宿主元素
  const host = document.createElement('div');
  host.id = SHADOW_HOST_ID;
  host.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;

  // 创建 Shadow Root
  const root = host.attachShadow({ mode: 'open' });

  // 注入样式
  const style = document.createElement('style');
  style.textContent = getStyles();
  root.appendChild(style);

  // 添加到文档
  document.body.appendChild(host);

  shadowHost = host;
  shadowRoot = root;

  return { host, root };
};

/**
 * 创建或获取 Shadow Host
 */
export const getShadowHost = (): { host: HTMLElement; root: ShadowRoot } => {
  if (shadowHost && shadowRoot && document.body.contains(shadowHost)) {
    return { host: shadowHost, root: shadowRoot };
  }

  // 首次创建或被移除后重建
  const result = createShadowHost();
  startAliveCheck();
  return result;
};

/**
 * 确保 Shadow Host 仍在 DOM 中，被移除则重建
 * @returns 是否进行了重建
 */
export const ensureShadowHostAlive = (): boolean => {
  if (!shadowHost || !document.body.contains(shadowHost)) {
    // 已被 SPA 框架移除，重建
    const { root } = createShadowHost();
    // 通知所有注册的组件重新挂载
    for (const cb of rebuildCallbacks) {
      try {
        cb(root);
      } catch {
        // 忽略回调错误
      }
    }
    return true;
  }
  return false;
};

/**
 * 启动存活检测（每 2 秒检查一次）
 */
const startAliveCheck = (): void => {
  if (aliveCheckTimer) return;
  aliveCheckTimer = setInterval(() => {
    ensureShadowHostAlive();
  }, 2000);
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
  if (aliveCheckTimer) {
    clearInterval(aliveCheckTimer);
    aliveCheckTimer = null;
  }
  if (shadowHost && shadowHost.parentNode) {
    shadowHost.parentNode.removeChild(shadowHost);
  }
  shadowHost = null;
  shadowRoot = null;
};
