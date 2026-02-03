/**
 * 输入框检测服务
 * P1-2.5: 优化 MutationObserver，改为白名单站点检测
 */

import { AI_CHAT_DOMAINS, VALID_INPUT_TYPES } from '@shared/constants';

/** 可编辑元素类型 */
export type EditableElement = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

/** 排除的输入框特征（name、id、placeholder、class 中包含这些关键词则排除） */
const EXCLUDED_INPUT_PATTERNS = [
  // 数字相关
  'number',
  'num',
  'amount',
  'price',
  'cost',
  'quantity',
  'qty',
  'count',
  'size',
  'width',
  'height',
  'pixel',
  'px',
  'percent',
  'ratio',
  'scale',
  'zoom',
  'opacity',
  'weight',
  'age',
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'duration',
  'length',
  'limit',
  'max',
  'min',
  'step',
  'range',
  'slider',
  'rating',
  'score',
  'level',
  'index',
  'page',
  'offset',
  // 金融相关
  'currency',
  'money',
  'budget',
  'balance',
  'fee',
  'tax',
  'discount',
  // 技术参数
  'port',
  'timeout',
  'interval',
  'threshold',
  'radius',
  'margin',
  'padding',
  'spacing',
  'gap',
  'border',
  'font-size',
  'line-height',
  // 其他控件
  'color',
  'picker',
  'date',
  'time',
  'phone',
  'zip',
  'postal',
  'code',
  'pin',
  'otp',
  'verification',
  'captcha',
];

/** 最小输入框尺寸要求 */
const MIN_INPUT_WIDTH = 120;
const MIN_INPUT_HEIGHT = 28;
const MIN_TEXTAREA_WIDTH = 150;
const MIN_TEXTAREA_HEIGHT = 50;

/**
 * 检查是否在 AI 聊天网站
 */
export const isAIChatSite = (): boolean => {
  const hostname = window.location.hostname;
  return AI_CHAT_DOMAINS.some(domain => hostname.includes(domain));
};

/**
 * 检查输入框是否应该被排除（数字输入框、小型控件等）
 * @param el 输入框元素
 */
const shouldExcludeInput = (el: HTMLInputElement): boolean => {
  // 检查 inputmode 属性
  const inputMode = el.inputMode?.toLowerCase() || '';
  if (inputMode === 'numeric' || inputMode === 'decimal' || inputMode === 'tel') {
    return true;
  }

  // 检查 pattern 属性（数字模式）
  const pattern = el.pattern || '';
  if (/^\[?\\?d|^\d|\{\d/.test(pattern)) {
    return true;
  }

  // 获取所有可检查的属性值
  const checkValues = [
    el.name,
    el.id,
    el.placeholder,
    el.className,
    el.getAttribute('aria-label'),
    el.getAttribute('data-testid'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // 检查是否匹配排除模式
  return EXCLUDED_INPUT_PATTERNS.some(pattern => checkValues.includes(pattern));
};

/**
 * 验证输入框是否有效
 * @param el 要验证的元素
 */
export const isValidInput = (el: Element | null): el is EditableElement => {
  if (!el) return false;

  const tag = el.tagName;

  // TEXTAREA - 需要足够大的尺寸
  if (tag === 'TEXTAREA') {
    const rect = el.getBoundingClientRect();
    // AI 聊天站点放宽尺寸要求
    if (isAIChatSite()) {
      return rect.width >= 100 && rect.height >= 30;
    }
    return rect.width >= MIN_TEXTAREA_WIDTH && rect.height >= MIN_TEXTAREA_HEIGHT;
  }

  // INPUT 检查类型和尺寸
  if (tag === 'INPUT') {
    const input = el as HTMLInputElement;
    const inputType = input.type?.toLowerCase() || '';

    // 类型必须在白名单中
    if (!VALID_INPUT_TYPES.includes(inputType)) return false;

    // 检查是否应该排除（数字输入框等）
    if (shouldExcludeInput(input)) return false;

    const rect = el.getBoundingClientRect();

    // AI 聊天站点放宽尺寸要求
    if (isAIChatSite()) {
      return rect.width >= 80 && rect.height >= 20;
    }

    // 非 AI 站点要求更大的输入框
    return rect.width >= MIN_INPUT_WIDTH && rect.height >= MIN_INPUT_HEIGHT;
  }

  // contenteditable 或 role="textbox" 只在 AI 聊天网站上检测
  if (isAIChatSite()) {
    const htmlEl = el as HTMLElement;
    const isEditable = htmlEl.isContentEditable;
    const hasTextboxRole = el.getAttribute('role') === 'textbox';

    if (isEditable || hasTextboxRole) {
      const rect = el.getBoundingClientRect();
      // 最小尺寸要求（放宽以支持更多富文本编辑器）
      if (rect.width < 80 || rect.height < 24) return false;
      // 放宽最大高度限制，允许更大的编辑区域
      if (rect.height > window.innerHeight * 0.8) return false;
      return true;
    }
  }

  return false;
};

/**
 * 查找可编辑元素
 * 始终返回包含点击位置的最内层有效的可编辑容器
 * @param el 起始元素
 */
export const findEditableElement = (el: Element | null): EditableElement | null => {
  if (!el) return null;

  // 直接是 TEXTAREA，需要通过 isValidInput 验证尺寸
  if (el.tagName === 'TEXTAREA') {
    return isValidInput(el) ? (el as HTMLTextAreaElement) : null;
  }

  // 是 INPUT，需要通过完整验证（类型、尺寸、排除规则）
  if (el.tagName === 'INPUT') {
    return isValidInput(el) ? (el as HTMLInputElement) : null;
  }

  // 只在 AI 聊天网站上检测 contenteditable 和 role="textbox"
  if (!isAIChatSite()) return null;

  // 从当前元素开始向上查找第一个有效的可编辑容器
  // 这样无论点击在编辑器的哪个子元素上，都会返回同一个容器
  let current: Element | null = el;
  while (current && current !== document.body) {
    const htmlEl = current as HTMLElement;
    if ((htmlEl.isContentEditable || current.getAttribute('role') === 'textbox') && isValidInput(current)) {
      return htmlEl;
    }
    current = current.parentElement;
  }

  return null;
};

/**
 * 获取输入框的值
 * @param el 输入框元素
 */
export const getInputValue = (el: EditableElement): string => {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    return (el as HTMLTextAreaElement | HTMLInputElement).value;
  }
  return el.innerText || el.textContent || '';
};

/**
 * 设置输入框的值
 * @param el 输入框元素
 * @param value 要设置的值
 */
export const setInputValue = (el: EditableElement, value: string): void => {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    (el as HTMLTextAreaElement | HTMLInputElement).value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    el.innerText = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
  }
};

/** 输入框检测器配置 */
interface InputDetectorConfig {
  onFocus: (el: EditableElement) => void;
  onBlur: () => void;
}

/**
 * 创建输入框检测器
 * P1-2.5: 优化检测策略，减少不必要的 Observer
 */
export const createInputDetector = (config: InputDetectorConfig): (() => void) => {
  const { onFocus, onBlur } = config;
  let activeInput: EditableElement | null = null;
  let observer: MutationObserver | null = null;

  // 处理焦点获取
  const handleFocusIn = (e: FocusEvent): void => {
    const target = findEditableElement(e.target as Element);
    if (target && isValidInput(target)) {
      activeInput = target;
      onFocus(target);
    }
  };

  // 处理焦点丢失
  const handleFocusOut = (): void => {
    setTimeout(() => {
      const newFocus = document.activeElement;
      const newTarget = findEditableElement(newFocus);
      if (!newTarget || !isValidInput(newTarget)) {
        onBlur();
      }
    }, 200);
  };

  // 处理点击
  const handleClick = (e: MouseEvent): void => {
    const target = findEditableElement(e.target as Element);
    if (target && isValidInput(target)) {
      activeInput = target;
      onFocus(target);
    }
  };

  // 处理输入
  const handleInput = (e: Event): void => {
    const target = findEditableElement(e.target as Element);
    if (target && isValidInput(target) && target !== activeInput) {
      activeInput = target;
      onFocus(target);
    }
  };

  // 注册事件
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);

  // P1-2.5: 仅在 AI 聊天网站启用 MutationObserver
  if (isAIChatSite()) {
    observer = new MutationObserver(() => {
      const focused = document.activeElement;
      if (focused && focused !== document.body) {
        const target = findEditableElement(focused);
        if (target && isValidInput(target) && target !== activeInput) {
          activeInput = target;
          onFocus(target);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['contenteditable', 'style', 'class'],
    });
  }

  // 返回清理函数
  return (): void => {
    document.removeEventListener('focusin', handleFocusIn, true);
    document.removeEventListener('focusout', handleFocusOut, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    observer?.disconnect();
  };
};

/**
 * 获取当前活跃的输入框
 */
export const getActiveInput = (): EditableElement | null => {
  const focused = document.activeElement;
  return focused ? findEditableElement(focused) : null;
};
