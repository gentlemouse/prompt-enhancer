/**
 * 增强按钮组件
 * P2-3.3: 使用 Shadow DOM 封装
 */

import { getShadowHost } from './shadow-host';

/** 按钮容器类名 */
const CONTAINER_CLASS = 'prompt-enhancer-container';
const BUTTON_CLASS = 'prompt-enhancer-btn';
const LOADER_CLASS = 'prompt-enhancer-loader';

/** 按钮状态 */
export interface ButtonState {
  container: HTMLElement;
  button: HTMLElement;
  iconImg: HTMLImageElement | null;
  loader: HTMLElement;
}

/**
 * 创建增强按钮
 * P2-3.3: 在 Shadow DOM 中创建
 * @param iconUrl 图标 URL
 * @param onClick 点击回调
 * @returns 按钮状态
 */
export const createEnhanceButton = (
  iconUrl: string,
  onClick: () => void
): ButtonState => {
  const { root } = getShadowHost();

  // 创建按钮
  const button = document.createElement('div');
  button.className = BUTTON_CLASS;
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.setAttribute('aria-label', '润色 Prompt (Cmd/Ctrl+Shift+E)');
  button.setAttribute('aria-describedby', 'prompt-enhancer-tooltip');

  // 创建图标
  const img = document.createElement('img');
  img.src = iconUrl;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.style.cssText = 'width:24px;height:24px;display:block;';
  img.onerror = (): void => {
    button.textContent = '✨';
  };
  button.appendChild(img);
  button.title = '润色 Prompt (Cmd/Ctrl+Shift+E)';

  // 创建加载动画元素
  const loader = document.createElement('span');
  loader.className = LOADER_CLASS;
  loader.textContent = '⏳';
  loader.style.display = 'none';
  loader.setAttribute('aria-hidden', 'true');
  button.appendChild(loader);

  // 点击事件
  button.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  // P2-3.6: 键盘事件（无障碍支持）
  button.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  });

  // 创建容器（在 Shadow DOM 中）
  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;
  container.appendChild(button);
  root.appendChild(container);

  return {
    container,
    button,
    iconImg: img,
    loader,
  };
};

/**
 * 设置按钮加载状态
 * @param state 按钮状态
 * @param loading 是否加载中
 */
export const setButtonLoading = (state: ButtonState, loading: boolean): void => {
  const { button, iconImg, loader } = state;

  if (loading) {
    if (iconImg) iconImg.style.display = 'none';
    loader.style.display = 'block';
    button.classList.add('loading');
    button.style.pointerEvents = 'none';
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-label', '正在润色...');
  } else {
    if (iconImg) iconImg.style.display = 'block';
    loader.style.display = 'none';
    button.classList.remove('loading');
    button.classList.remove('streaming');
    button.style.pointerEvents = 'auto';
    button.removeAttribute('aria-busy');
    button.setAttribute('aria-label', '润色 Prompt (Cmd/Ctrl+Shift+E)');
  }
};

/**
 * 设置按钮流式状态
 * P2-3.2: 流式输出时的视觉反馈
 */
export const setButtonStreaming = (state: ButtonState, streaming: boolean): void => {
  const { button, iconImg, loader } = state;

  if (streaming) {
    if (iconImg) iconImg.style.display = 'block';
    loader.style.display = 'none';
    button.classList.remove('loading');
    button.classList.add('streaming');
    button.style.pointerEvents = 'none';
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-label', '正在生成...');
  } else {
    button.classList.remove('streaming');
    button.style.pointerEvents = 'auto';
    button.removeAttribute('aria-busy');
    button.setAttribute('aria-label', '润色 Prompt (Cmd/Ctrl+Shift+E)');
  }
};

/**
 * 定位按钮
 * @param container 容器元素
 * @param input 输入框元素
 */
export const positionButton = (
  container: HTMLElement,
  input: HTMLElement
): void => {
  const rect = input.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const btnWidth = 32;
  const btnHeight = 32;
  const padding = 4;

  // 计算按钮位置：在输入框的右下角
  let top = rect.bottom - btnHeight - padding;
  let left = rect.right - btnWidth - padding;

  // 确保不超出视口
  top = Math.max(padding, Math.min(top, viewportHeight - btnHeight - padding));
  left = Math.max(padding, Math.min(left, viewportWidth - btnWidth - padding));

  container.style.top = `${top}px`;
  container.style.left = `${left}px`;
  container.style.display = 'flex';
};

/**
 * 隐藏按钮
 * @param container 容器元素
 */
export const hideButton = (container: HTMLElement): void => {
  container.style.display = 'none';
};
