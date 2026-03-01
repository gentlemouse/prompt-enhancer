/**
 * 输入框检测服务
 *
 * 检测策略（三层过滤）：
 *
 * Layer 1 - 站点分类：
 *   AI 聊天站点（白名单）→ 放宽检测
 *   其他站点 → 严格检测
 *
 * Layer 2 - 元素类型分流：
 *   contenteditable → 通过特征检测（role、富文本框架、aria 属性）判断
 *   textarea → 尺寸过滤
 *   input[text] → 仅 AI 站点检测，排除数字/控件型
 *
 * Layer 3 - 智能排除：
 *   使用 HTML 语义属性（type、inputMode、min/max/step、role）排除
 *   而非脆弱的子串匹配
 */

import { AI_CHAT_DOMAINS } from '@shared/constants';

/** 可编辑元素类型 */
export type EditableElement =
  | HTMLTextAreaElement
  | HTMLInputElement
  | HTMLElement;

// ==========================================================
//  站点分类
// ==========================================================

/**
 * 检查是否在 AI 聊天网站（白名单）
 * 白名单站点享受放宽的检测规则
 */
export const isAIChatSite = (): boolean => {
  const hostname = window.location.hostname.toLowerCase();
  return AI_CHAT_DOMAINS.some(domain => {
    const normalized = domain.toLowerCase();
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
};

// ==========================================================
//  contenteditable 检测
// ==========================================================

/** 已知富文本编辑器框架的选择器 */
const RICH_EDITOR_SELECTORS = [
  '.ProseMirror',
  '.DraftEditor-root',
  '[data-slate-editor]',
  '.ql-editor',
  '.tiptap',
  '.cm-content',
  '.CodeMirror-code',
];

/** 表示"文本输入区"的 role 值 */
const TEXTBOX_ROLES = ['textbox', 'combobox'];

/** aria-label / data-placeholder 中的正向关键词 */
const TEXT_INPUT_KEYWORDS = [
  'message',
  'prompt',
  'chat',
  'ask',
  'query',
  'input',
  'type',
  'send',
  'write',
  'compose',
  'reply',
  'comment',
  '消息',
  '输入',
  '提问',
  '对话',
  '发送',
  '回复',
  '评论',
  '搜索',
];

/** 容器级别的正向 CSS 类名片段（用于检测父级上下文） */
const CHAT_CONTAINER_PATTERNS = [
  'chat',
  'message',
  'prompt',
  'editor',
  'compose',
  'conversation',
  'dialog',
];

/**
 * 查找 contenteditable 根元素
 * 与 isContentEditable（继承属性）不同，
 * 这里查找真正设置了 contenteditable="true" 的最近祖先
 *
 * 策略：取最内层（最接近焦点的）有效根元素，
 * 避免选中覆盖大面积区域的外层容器导致按钮错位
 * @param el 起始元素
 */
const findContentEditableRoot = (el: Element): HTMLElement | null => {
  let current: Element | null = el;

  // 先检查自身
  if (
    current instanceof HTMLElement &&
    (current.getAttribute('contenteditable') === 'true' ||
      current.getAttribute('contenteditable') === '')
  ) {
    return current;
  }

  // 向上查找最近的 contenteditable="true" 祖先
  current = el.parentElement;
  while (current && current !== document.body) {
    if (current instanceof HTMLElement) {
      const attr = current.getAttribute('contenteditable');
      if (attr === 'false') break;
      if (attr === 'true' || attr === '') {
        return current;
      }
    }
    current = current.parentElement;
  }

  return null;
};

/**
 * 检测 contenteditable 元素是否为有效的文本输入区
 * @param el contenteditable 根元素
 */
const isValidContentEditable = (el: HTMLElement): boolean => {
  const rect = el.getBoundingClientRect();

  // 基本尺寸检查
  if (rect.width < 80 || rect.height < 24) return false;
  // 排除覆盖整个视口的区域（可能是整个页面的 contenteditable）
  if (rect.height > window.innerHeight * 0.7) return false;

  // AI 聊天站点：尺寸通过就接受
  if (isAIChatSite()) return true;

  // --- 非 AI 站点：需要更强的正向信号 ---

  // 信号 1：role 属性
  const role = el.getAttribute('role')?.toLowerCase() || '';
  if (TEXTBOX_ROLES.includes(role)) return true;

  // 信号 2：匹配已知富文本编辑器框架
  for (const selector of RICH_EDITOR_SELECTORS) {
    if (el.matches(selector) || el.querySelector(selector)) return true;
  }

  // 信号 3：aria-label / data-placeholder 包含文本输入关键词
  const hintText = [
    el.getAttribute('aria-label'),
    el.getAttribute('aria-placeholder'),
    el.getAttribute('data-placeholder'),
    el.getAttribute('placeholder'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (hintText && TEXT_INPUT_KEYWORDS.some(kw => hintText.includes(kw))) {
    return true;
  }

  // 信号 4：父级有聊天/消息相关的容器类名
  const parentClasses = (el.parentElement?.className || '').toLowerCase();
  if (CHAT_CONTAINER_PATTERNS.some(p => parentClasses.includes(p))) {
    return true;
  }

  // 没有足够信号，拒绝
  return false;
};

// ==========================================================
//  textarea 检测
// ==========================================================

/**
 * 检测 textarea 是否有效
 * @param el textarea 元素
 */
const isValidTextarea = (el: HTMLTextAreaElement): boolean => {
  const rect = el.getBoundingClientRect();

  if (isAIChatSite()) {
    // AI 站点：放宽尺寸
    return rect.width >= 80 && rect.height >= 20;
  }

  // 非 AI 站点：要求较大的 textarea（过滤掉表单中的小备注框）
  return rect.width >= 200 && rect.height >= 50;
};

// ==========================================================
//  input 检测
// ==========================================================

/** 接受的 input type 白名单 */
const VALID_INPUT_TYPES = ['text', 'search', ''];

/**
 * 检测 input 是否为有效的文本输入框
 * 非 AI 站点直接拒绝所有 input（单行输入框几乎不用于输入 prompt）
 * @param el input 元素
 */
const isValidTextInput = (el: HTMLInputElement): boolean => {
  // 非 AI 站点不检测 input 元素
  if (!isAIChatSite()) return false;

  const inputType = el.type?.toLowerCase() || '';
  if (!VALID_INPUT_TYPES.includes(inputType)) return false;

  // 排除：inputMode 为数字类型
  const inputMode = el.inputMode?.toLowerCase() || '';
  if (['numeric', 'decimal', 'tel'].includes(inputMode)) return false;

  // 排除：有 min/max/step 属性（数字滑块/计数器）
  if (
    el.hasAttribute('min') ||
    el.hasAttribute('max') ||
    el.hasAttribute('step')
  ) {
    return false;
  }

  // 排除：role 为数字控件
  const role = el.getAttribute('role')?.toLowerCase() || '';
  if (['spinbutton', 'slider', 'progressbar', 'meter'].includes(role)) {
    return false;
  }

  // 尺寸检查
  const rect = el.getBoundingClientRect();
  return rect.width >= 100 && rect.height >= 20;
};

// ==========================================================
//  统一校验接口
// ==========================================================

/**
 * 验证元素是否为有效的可编辑输入区
 * @param el 要验证的元素
 */
export const isValidInput = (el: Element | null): el is EditableElement => {
  if (!el) return false;

  const tag = el.tagName;

  if (tag === 'TEXTAREA') {
    return isValidTextarea(el as HTMLTextAreaElement);
  }

  if (tag === 'INPUT') {
    return isValidTextInput(el as HTMLInputElement);
  }

  // contenteditable 元素
  if ((el as HTMLElement).isContentEditable) {
    return isValidContentEditable(el as HTMLElement);
  }

  return false;
};

// ==========================================================
//  查找可编辑元素
// ==========================================================

/**
 * 从事件目标查找可编辑元素
 * @param el 起始元素（通常是事件目标）
 */
export const findEditableElement = (
  el: Element | null
): EditableElement | null => {
  if (!el) return null;

  // textarea：直接验证
  if (el.tagName === 'TEXTAREA') {
    return isValidTextarea(el as HTMLTextAreaElement)
      ? (el as HTMLTextAreaElement)
      : null;
  }

  // input：直接验证
  if (el.tagName === 'INPUT') {
    return isValidTextInput(el as HTMLInputElement)
      ? (el as HTMLInputElement)
      : null;
  }

  // contenteditable：查找根元素再验证
  if ((el as HTMLElement).isContentEditable) {
    const root = findContentEditableRoot(el);
    if (root && isValidContentEditable(root)) {
      return root;
    }
  }

  return null;
};

// ==========================================================
//  值读写
// ==========================================================

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
 * 静默设置输入框的值（不创建浏览器 undo 记录）
 * 用于流式输出等频繁更新场景
 * @param el 输入框元素
 * @param value 要设置的值
 */
export const setInputValueDirect = (
  el: EditableElement,
  value: string
): void => {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const input = el as HTMLTextAreaElement | HTMLInputElement;
    const proto =
      el.tagName === 'TEXTAREA'
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
};

/**
 * 设置输入框的值（支持浏览器原生单步 undo）
 * 通过 execCommand 实现，Ctrl+Z 可一次撤回全部更改
 * @param el 输入框元素
 * @param value 要设置的值
 */
export const setInputValue = (el: EditableElement, value: string): void => {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const input = el as HTMLTextAreaElement | HTMLInputElement;
    input.focus();
    input.select();
    if (!document.execCommand('insertText', false, value)) {
      input.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else {
    el.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (!document.execCommand('insertText', false, value)) {
      el.innerText = value;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
    }
  }
};

// ==========================================================
//  输入框检测器（事件监听）
// ==========================================================

/** 输入框检测器配置 */
interface InputDetectorConfig {
  onFocus: (el: EditableElement) => void;
  onBlur: () => void;
}

/**
 * 创建输入框检测器
 * 监听页面焦点事件，自动发现可编辑元素
 */
export const createInputDetector = (
  config: InputDetectorConfig
): (() => void) => {
  const { onFocus, onBlur } = config;
  let activeInput: EditableElement | null = null;
  let observer: MutationObserver | null = null;

  /** 处理焦点获取 */
  const handleFocusIn = (e: FocusEvent): void => {
    const target = findEditableElement(e.target as Element);
    if (target) {
      activeInput = target;
      onFocus(target);
    }
  };

  /** 处理焦点丢失 */
  const handleFocusOut = (): void => {
    setTimeout(() => {
      const newFocus = document.activeElement;
      const newTarget = newFocus ? findEditableElement(newFocus) : null;
      if (!newTarget) {
        onBlur();
      }
    }, 200);
  };

  /** 处理点击（补充 focusin 的不足） */
  const handleClick = (e: MouseEvent): void => {
    const target = findEditableElement(e.target as Element);
    if (target) {
      activeInput = target;
      onFocus(target);
    }
  };

  /** 处理输入事件（捕获新出现的输入框） */
  const handleInput = (e: Event): void => {
    const target = findEditableElement(e.target as Element);
    if (target && target !== activeInput) {
      activeInput = target;
      onFocus(target);
    }
  };

  // 注册事件
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);

  // MutationObserver：监听动态 DOM 变化（SPA 路由切换等）
  // 仅在检测到 contenteditable 时有意义
  observer = new MutationObserver(() => {
    const focused = document.activeElement;
    if (focused && focused !== document.body) {
      const target = findEditableElement(focused);
      if (target && target !== activeInput) {
        activeInput = target;
        onFocus(target);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['contenteditable'],
  });

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
