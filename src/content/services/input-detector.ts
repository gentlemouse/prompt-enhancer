/**
 * 输入框检测服务
 * P1-2.5: 优化 MutationObserver，改为白名单站点检测
 */

import { AI_CHAT_DOMAINS, VALID_INPUT_TYPES } from '@shared/constants';

/** 可编辑元素类型 */
export type EditableElement = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

/**
 * 检查是否在 AI 聊天网站
 */
export const isAIChatSite = (): boolean => {
  const hostname = window.location.hostname;
  return AI_CHAT_DOMAINS.some(domain => hostname.includes(domain));
};

/**
 * 验证输入框是否有效
 * @param el 要验证的元素
 */
export const isValidInput = (el: Element | null): el is EditableElement => {
  if (!el) return false;

  const tag = el.tagName;

  // TEXTAREA 直接通过
  if (tag === 'TEXTAREA') {
    const rect = el.getBoundingClientRect();
    return rect.width >= 30 && rect.height >= 15;
  }

  // INPUT 检查类型
  if (tag === 'INPUT') {
    const input = el as HTMLInputElement;
    const inputType = input.type?.toLowerCase() || '';
    if (!VALID_INPUT_TYPES.includes(inputType)) return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= 30 && rect.height >= 15;
  }

  // contenteditable 只在 AI 聊天网站上检测
  if ((el as HTMLElement).isContentEditable && isAIChatSite()) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 30 || rect.height < 15) return false;
    // 排除太大的区域
    if (rect.height > window.innerHeight * 0.5) return false;
    return true;
  }

  return false;
};

/**
 * 查找可编辑元素
 * @param el 起始元素
 */
export const findEditableElement = (el: Element | null): EditableElement | null => {
  if (!el) return null;

  // 直接是 TEXTAREA
  if (el.tagName === 'TEXTAREA') return el as HTMLTextAreaElement;

  // 是 INPUT 且类型有效
  if (el.tagName === 'INPUT') {
    const input = el as HTMLInputElement;
    const inputType = input.type?.toLowerCase() || '';
    if (VALID_INPUT_TYPES.includes(inputType)) {
      return input;
    }
  }

  // 只在 AI 聊天网站上检测 contenteditable
  if (!isAIChatSite()) return null;

  // 自身是 contenteditable
  if ((el as HTMLElement).isContentEditable && isValidInput(el)) {
    return el as HTMLElement;
  }

  // 向上查找 contenteditable 祖先
  let current = el.parentElement;
  while (current && current !== document.body) {
    if (current.isContentEditable && isValidInput(current)) {
      return current;
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
