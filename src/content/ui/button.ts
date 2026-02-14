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
    button.classList.add('streaming', 'generating'); // 添加 generating 类以触发发光动画
    button.style.pointerEvents = 'none';
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-label', '正在生成...');
  } else {
    button.classList.remove('streaming', 'generating');
    button.style.pointerEvents = 'auto';
    button.removeAttribute('aria-busy');
    button.setAttribute('aria-label', '润色 Prompt (Cmd/Ctrl+Shift+E)');
  }
};

/**
 * 定位按钮
 * 始终右对齐，垂直位置根据输入框类型自适应：
 * - 单行输入框（input）：垂直居中
 * - 多行输入框（textarea / contenteditable）：右下角
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

  const btnSize = 32;
  const margin = 6;

  // 安全检查：输入框必须在视口中可见且尺寸合理
  if (
    rect.width < 50 ||
    rect.height < 10 ||
    rect.bottom < 0 ||
    rect.top > viewportHeight ||
    rect.right < 0 ||
    rect.left > viewportWidth ||
    // 输入框面积超过视口 50% → 大概率是选错了元素
    rect.width * rect.height > viewportWidth * viewportHeight * 0.5
  ) {
    container.style.display = 'none';
    return;
  }

  // 水平：始终右对齐，贴在输入框右侧内边缘
  let left = Math.round(rect.right - btnSize - margin);

  // 垂直：根据输入框高度决定
  let top: number;
  const isMultiline =
    input.tagName === 'TEXTAREA' ||
    (input.tagName !== 'INPUT' && rect.height > 60);

  if (isMultiline) {
    // 多行：右下角
    top = Math.round(rect.bottom - btnSize - margin);
  } else {
    // 单行：垂直居中
    top = Math.round(rect.top + (rect.height - btnSize) / 2);
  }

  // 确保不超出视口
  top = Math.max(2, Math.min(top, viewportHeight - btnSize - 2));
  left = Math.max(2, Math.min(left, viewportWidth - btnSize - 2));

  container.style.top = `${top}px`;
  container.style.left = `${left}px`;
  container.style.display = 'flex';

  // 检测输入框背景亮度，自动切换图标颜色
  const btn = container.querySelector('.prompt-enhancer-btn') as HTMLElement;
  if (btn) {
    updateButtonTheme(btn, input);
  }
};

/**
 * 检测元素附近的实际背景亮度
 * 向上遍历 DOM 找到第一个有效背景色，计算相对亮度
 * @param el 目标元素
 * @returns 是否为暗色背景
 */
const detectDarkBackground = (el: HTMLElement): boolean => {
  let current: HTMLElement | null = el;

  while (current) {
    const style = getComputedStyle(current);
    const bg = style.backgroundColor;

    // 跳过透明背景
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      // 解析 rgb/rgba
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        // 相对亮度公式 (ITU-R BT.709)
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        return luminance < 0.5;
      }
    }

    current = current.parentElement;
  }

  // 回退：检查 body 背景色
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const bodyMatch = bodyBg?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (bodyMatch) {
    const lum =
      (0.2126 * parseInt(bodyMatch[1]) +
        0.7152 * parseInt(bodyMatch[2]) +
        0.0722 * parseInt(bodyMatch[3])) /
      255;
    return lum < 0.5;
  }

  return false;
};

/**
 * 更新按钮的暗色/亮色样式
 * 根据输入框附近的实际背景色决定是否反色
 * @param button 按钮元素
 * @param input 输入框元素
 */
export const updateButtonTheme = (
  button: HTMLElement,
  input: HTMLElement
): void => {
  const isDark = detectDarkBackground(input);
  if (isDark) {
    button.classList.add('on-dark');
  } else {
    button.classList.remove('on-dark');
  }
};

/**
 * 隐藏按钮
 * @param container 容器元素
 */
export const hideButton = (container: HTMLElement): void => {
  container.style.display = 'none';
};
