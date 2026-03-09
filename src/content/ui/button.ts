/**
 * 增强按钮组件
 * P2-3.3: 使用 Shadow DOM 封装
 * Premium: 使用内联 SVG Sparkles 图标 + 渐变底座
 */

import { getShadowHost } from './shadow-host';
import { t } from '@shared/i18n';

/** 按钮容器类名 */
const CONTAINER_CLASS = 'prompt-enhancer-container';
const BUTTON_CLASS = 'prompt-enhancer-btn';
const LOADER_CLASS = 'prompt-enhancer-loader';
const BUTTON_ANCHOR_SIZE = 30;

/** Sparkles SVG 内联代码 (Lucide Sparkles — 与参考图一致) */
const SPARKLES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>`;

/** 按钮状态 */
export interface ButtonState {
  container: HTMLElement;
  button: HTMLElement;
  iconEl: HTMLElement | null;
  loader: HTMLElement;
  onboardingEl: HTMLElement | null;
}

type ElementRect = ReturnType<HTMLElement['getBoundingClientRect']>;

/** 可测试的矩形数据结构 */
export interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

const ACTION_CONTROL_SELECTOR =
  'button,[role="button"],input[type="submit"],input[type="button"]';

const MAX_SCOPE_DEPTH = 4;
const MAX_SCOPE_CONTROLS = 40;

/**
 * 判断元素是否可见
 */
const isElementVisible = (el: HTMLElement): boolean => {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const opacity = Number.parseFloat(style.opacity || '1');
  return Number.isNaN(opacity) || opacity > 0;
};

/**
 * 计算右侧控件需要保留的避让空间。
 * 纯几何计算，便于在测试中覆盖不同布局。
 */
export const calculateRightOverlayInset = (
  inputRect: RectLike,
  controlRects: RectLike[]
): number => {
  let reserved = 0;
  for (const rect of controlRects) {
    if (rect.width < 8 || rect.height < 8) continue;

    const verticalOverlap =
      Math.min(inputRect.bottom, rect.bottom) -
      Math.max(inputRect.top, rect.top);
    if (verticalOverlap < Math.min(12, inputRect.height * 0.3)) continue;

    // 只考虑输入框右半区域内、且贴近右边缘的动作控件
    if (
      rect.left < inputRect.left + inputRect.width * 0.45 ||
      rect.left > inputRect.right + 8
    ) {
      continue;
    }

    const inset = inputRect.right - rect.left + 6;
    if (inset <= 0) continue;

    reserved = Math.max(reserved, inset);
  }

  const maxAllowed = Math.max(0, inputRect.width * 0.45);
  return Math.min(reserved, maxAllowed);
};

/**
 * 收集输入框附近的动作控件矩形。
 * 向上扫描少量祖先容器，覆盖绝对定位后代和 composer 内嵌按钮。
 */
const collectNearbyActionControlRects = (
  input: HTMLElement,
  inputRect: ElementRect
): RectLike[] => {
  const scopes: HTMLElement[] = [];
  let current = input.parentElement;
  let depth = 0;

  while (
    current &&
    current !== document.body &&
    current !== document.documentElement &&
    depth < MAX_SCOPE_DEPTH
  ) {
    scopes.push(current);
    if (current.matches('form,[role="dialog"],[role="group"]')) {
      break;
    }
    current = current.parentElement;
    depth += 1;
  }

  const seen = new Set<HTMLElement>();
  const rects: RectLike[] = [];

  for (const scope of scopes) {
    const controls = Array.from(
      scope.querySelectorAll(ACTION_CONTROL_SELECTOR)
    ) as HTMLElement[];

    for (const control of controls) {
      if (seen.has(control)) continue;
      seen.add(control);

      if (control === input || control.contains(input)) continue;
      if (!isElementVisible(control)) continue;

      const rect = control.getBoundingClientRect();
      if (
        rect.right < inputRect.left ||
        rect.left > inputRect.right + 140 ||
        rect.bottom < inputRect.top ||
        rect.top > inputRect.bottom
      ) {
        continue;
      }

      rects.push(rect);
      if (rects.length >= MAX_SCOPE_CONTROLS) {
        return rects;
      }
    }
  }

  return rects;
};

/**
 * 判断按钮交互是否被临时禁用。
 */
const isButtonInteractionDisabled = (button: HTMLElement): boolean => {
  return button.getAttribute('aria-disabled') === 'true';
};

/**
 * 创建增强按钮
 * Premium: 使用内联 SVG，不再需要外部图标 URL
 * @param onClick 点击回调
 * @returns 按钮状态
 */
export const createEnhanceButton = (onClick: () => void): ButtonState => {
  const { root } = getShadowHost();

  // 创建按钮
  const button = document.createElement('div');
  button.className = BUTTON_CLASS;
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.setAttribute('aria-label', t('btnAriaLabel'));

  // 注入内联 SVG 图标
  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'prompt-enhancer-icon';
  iconWrapper.innerHTML = SPARKLES_SVG;
  button.appendChild(iconWrapper);
  button.title = t('btnAriaLabel');

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
    if (isButtonInteractionDisabled(button)) return;
    onClick();
  });

  // 避免点击按钮时抢走输入框焦点，减少 blur-hide 误触发
  button.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
  });

  // P2-3.6: 键盘事件（无障碍支持）
  button.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (isButtonInteractionDisabled(button)) return;
      onClick();
    }
  });

  // 创建容器（在 Shadow DOM 中）
  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;
  // 固定定位，供按钮与引导气泡锚定到输入框坐标
  container.style.position = 'fixed';
  container.style.width = `${BUTTON_ANCHOR_SIZE}px`;
  container.style.height = `${BUTTON_ANCHOR_SIZE}px`;
  container.appendChild(button);
  root.appendChild(container);

  return {
    container,
    button,
    iconEl: iconWrapper,
    loader,
    onboardingEl: null,
  };
};

/**
 * 设置按钮加载状态
 * @param state 按钮状态
 * @param loading 是否加载中
 */
export const setButtonLoading = (
  state: ButtonState,
  loading: boolean
): void => {
  const { button, iconEl, loader } = state;

  if (loading) {
    button.classList.remove('collapsed');
    if (iconEl) iconEl.style.display = 'none';
    loader.style.display = 'block';
    button.classList.add('loading');
    button.style.pointerEvents = 'auto';
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('aria-label', t('btnAriaEnhancing'));
  } else {
    if (iconEl) iconEl.style.display = 'flex';
    loader.style.display = 'none';
    button.classList.remove('loading');
    button.classList.remove('streaming');
    button.classList.remove('generating');
    button.style.pointerEvents = 'auto';
    button.removeAttribute('aria-busy');
    button.removeAttribute('aria-disabled');
    button.setAttribute('aria-label', t('btnAriaLabel'));
  }
};

/**
 * 设置按钮流式状态
 * P2-3.2: 流式输出时的视觉反馈
 */
export const setButtonStreaming = (
  state: ButtonState,
  streaming: boolean
): void => {
  const { button, iconEl, loader } = state;

  if (streaming) {
    button.classList.remove('collapsed');
    if (iconEl) iconEl.style.display = 'flex';
    loader.style.display = 'none';
    button.classList.remove('loading');
    button.classList.add('streaming', 'generating');
    button.style.pointerEvents = 'auto';
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('aria-label', t('btnAriaGenerating'));
  } else {
    button.classList.remove('streaming', 'generating');
    button.style.pointerEvents = 'auto';
    button.removeAttribute('aria-busy');
    button.removeAttribute('aria-disabled');
    button.setAttribute('aria-label', t('btnAriaLabel'));
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
  if (!input.isConnected || !isElementVisible(input)) {
    container.style.display = 'none';
    return;
  }

  const rect = input.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 使用固定锚点尺寸，避免收起/悬停等样式过渡引发重新锚定抖动
  const btnWidth = BUTTON_ANCHOR_SIZE;
  const btnHeight = BUTTON_ANCHOR_SIZE;
  const baseMargin = 6;

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

  const inputStyle = window.getComputedStyle(input);
  const paddingRight = Number.parseFloat(inputStyle.paddingRight || '0') || 0;
  const paddingBottom = Number.parseFloat(inputStyle.paddingBottom || '0') || 0;
  const actionControlRects = collectNearbyActionControlRects(input, rect);
  const overlayInset = calculateRightOverlayInset(rect, actionControlRects);
  const rightInset = Math.max(
    baseMargin,
    Math.ceil(paddingRight) + 4,
    Math.ceil(overlayInset)
  );

  // 水平：默认贴在输入框右侧内边缘，同时避开右侧内置控件
  let left = Math.round(rect.right - btnWidth - rightInset);

  // 垂直：根据输入框高度决定
  let top: number;
  const isMultiline =
    input.tagName === 'TEXTAREA' ||
    (input.tagName !== 'INPUT' && rect.height > 60);

  if (isMultiline) {
    // 多行：右下角，考虑底部 padding
    const bottomInset = Math.max(baseMargin, Math.ceil(paddingBottom / 2));
    top = Math.round(rect.bottom - btnHeight - bottomInset);
  } else {
    // 单行：垂直居中
    top = Math.round(rect.top + (rect.height - btnHeight) / 2);
  }

  // 确保不超出视口
  top = Math.max(2, Math.min(top, viewportHeight - btnHeight - 2));
  left = Math.max(2, Math.min(left, viewportWidth - btnWidth - 2));

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

/**
 * 收起按钮为迷你星芒
 */
export const collapseButton = (state: ButtonState): void => {
  state.button.classList.add('collapsed');
};

/**
 * 展开按钮为完整图标
 */
export const expandButton = (state: ButtonState): void => {
  state.button.classList.remove('collapsed');
};

/**
 * 检查按钮是否处于收起状态
 */
export const isButtonCollapsed = (state: ButtonState): boolean => {
  return state.button.classList.contains('collapsed');
};

/**
 * 显示引导气泡
 * @param state 按钮状态
 * @param onDismiss 关闭回调
 */
export const showOnboarding = (
  state: ButtonState,
  onDismiss: () => void
): void => {
  // 如果已经存在，不重复创建
  if (state.onboardingEl) return;

  const tooltip = document.createElement('div');
  tooltip.className = 'prompt-enhancer-onboarding';

  // 图标
  const icon = document.createElement('span');
  icon.className = 'prompt-enhancer-onboarding-icon';
  icon.textContent = '✨';
  tooltip.appendChild(icon);

  // 文字
  const text = document.createElement('span');
  text.className = 'prompt-enhancer-onboarding-text';
  text.textContent = t('onboardingStep2Hint');
  tooltip.appendChild(text);

  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.className = 'prompt-enhancer-onboarding-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', t('previewClose'));
  closeBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
  });
  closeBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    hideOnboarding(state);
    onDismiss();
  });
  tooltip.appendChild(closeBtn);

  state.container.appendChild(tooltip);
  state.onboardingEl = tooltip;
};

/**
 * 隐藏引导气泡
 */
export const hideOnboarding = (state: ButtonState): void => {
  if (state.onboardingEl) {
    state.onboardingEl.remove();
    state.onboardingEl = null;
  }
};
