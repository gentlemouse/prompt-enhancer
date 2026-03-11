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

/** search 输入框可视为聊天输入时的关键词（刻意不包含 search） */
const CHAT_SEARCH_HINT_KEYWORDS = [
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
];

/** 明显偏“全站搜索”语义的关键词 */
const GLOBAL_SEARCH_HINT_KEYWORDS = ['search', '搜索', 'find', '查找'];

/** 容器级别的正向 CSS 类名片段（用于检测父级上下文） */
const CHAT_CONTAINER_PATTERNS = [
  'chat',
  'message',
  'prompt',
  'compose',
  'conversation',
  'dialog',
];

/** 发送/提交动作关键词（用于识别聊天输入旁边的发送按钮） */
const SEND_ACTION_KEYWORDS = [
  'send',
  'submit',
  'reply',
  '发送',
  '提交',
  '回复',
  'chat-send',
];

/** 发送控件选择器 */
const SEND_CONTROL_SELECTOR =
  'button,[role="button"],input[type="submit"],input[type="button"]';

/** 非 AI 站点 contenteditable 检测信号 */
export interface ContentEditableIntentSignals {
  hasTextboxRole: boolean;
  hasRichEditor: boolean;
  hasTextHint: boolean;
  hasChatContainer: boolean;
  hasSendControl: boolean;
}

/** 点击原生输入框时的回退判定信号 */
export interface NativeFocusFallbackSignals {
  isAISite: boolean;
  focusedTagName: string | null;
  eventTargetMatchesFocused: boolean;
}

/**
 * 判断元素是否可见
 */
const isElementVisible = (el: HTMLElement): boolean => {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const opacity = Number.parseFloat(style.opacity || '1');
  return Number.isNaN(opacity) || opacity > 0;
};

/** 与框架强绑定的 contenteditable 选择器（写回需走兼容路径） */
const FRAMEWORK_MANAGED_EDITOR_SELECTORS = [
  '.ProseMirror',
  '[data-slate-editor]',
  '[data-lexical-editor]',
  '.ql-editor',
  '.tiptap',
];

/**
 * 跨 DOM 边界向上查找父节点
 * 支持从 Shadow DOM 内部跳转到 host
 */
const getCrossBoundaryParent = (el: Element): Element | null => {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  if (root instanceof ShadowRoot) return root.host;
  return null;
};

/**
 * 从事件中提取最接近真实交互节点的 Element
 * 优先使用 composedPath，兼容 Shadow DOM 事件重定向
 */
const getEventElement = (e: Event): Element | null => {
  if (typeof e.composedPath === 'function') {
    const path = e.composedPath();
    for (const node of path) {
      if (node instanceof Element) return node;
    }
  }
  return e.target instanceof Element ? e.target : null;
};

/**
 * 获取当前文档（含 Shadow DOM / iframe）的最深层 activeElement
 */
const getDeepActiveElement = (
  root: Document | ShadowRoot = document
): Element | null => {
  let active: Element | null = root.activeElement;

  while (active) {
    if (active instanceof HTMLElement && active.tagName === 'IFRAME') {
      try {
        const frameDoc = (active as { contentDocument?: Document | null })
          .contentDocument;
        if (
          frameDoc?.activeElement &&
          frameDoc.activeElement !== frameDoc.body
        ) {
          active = frameDoc.activeElement;
          continue;
        }
      } catch {
        // 跨域 iframe 无法访问，忽略并返回当前层级元素
      }
    }

    if (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
      continue;
    }

    break;
  }

  return active;
};

/**
 * 判断是否为框架托管的 contenteditable 编辑器
 * 这类编辑器通常依赖浏览器编辑命令/特定事件顺序同步内部状态
 */
const isFrameworkManagedContentEditable = (el: HTMLElement): boolean => {
  return FRAMEWORK_MANAGED_EDITOR_SELECTORS.some(selector =>
    el.matches(selector)
  );
};

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
  current = getCrossBoundaryParent(el);
  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    if (current instanceof HTMLElement) {
      const attr = current.getAttribute('contenteditable');
      if (attr === 'false') break;
      if (attr === 'true' || attr === '') {
        return current;
      }
    }
    current = getCrossBoundaryParent(current);
  }

  return null;
};

/**
 * 提取输入提示文本（placeholder / aria 系列）
 */
const getHintText = (el: HTMLElement): string => {
  return [
    el.getAttribute('aria-label'),
    el.getAttribute('aria-placeholder'),
    el.getAttribute('data-placeholder'),
    el.getAttribute('placeholder'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

/**
 * 检测是否命中聊天容器上下文（最多向上 6 层）
 */
const hasChatContainerContext = (el: HTMLElement): boolean => {
  let current: Element | null = el;
  let depth = 0;

  while (
    current &&
    current !== document.body &&
    current !== document.documentElement &&
    depth < 6
  ) {
    if (current instanceof HTMLElement) {
      const classNames = String(current.className || '').toLowerCase();
      const dataTestId = (
        current.getAttribute('data-testid') || ''
      ).toLowerCase();
      const merged = `${classNames} ${dataTestId}`;
      if (CHAT_CONTAINER_PATTERNS.some(p => merged.includes(p))) {
        return true;
      }
    }
    current = getCrossBoundaryParent(current);
    depth += 1;
  }

  return false;
};

/**
 * 检测输入框附近是否存在“发送/提交”按钮
 */
const hasNearbySendControl = (el: HTMLElement): boolean => {
  const scope =
    el.closest('form,[role="dialog"],[role="group"]') || el.parentElement;
  if (!scope) return false;

  const inputRect = el.getBoundingClientRect();
  const controls = Array.from(
    scope.querySelectorAll(SEND_CONTROL_SELECTOR)
  ) as HTMLElement[];

  // 限制扫描数量，避免大型表单页面带来不必要开销
  const limitedControls = controls.slice(0, 40);

  for (const control of limitedControls) {
    if (!isElementVisible(control)) continue;
    if (control === el) continue;

    const rect = control.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) continue;

    const verticalOverlap =
      Math.min(inputRect.bottom, rect.bottom) -
      Math.max(inputRect.top, rect.top);
    if (verticalOverlap < Math.min(10, inputRect.height * 0.25)) continue;

    // 发送按钮通常在输入框右侧或轻微重叠区域
    const nearRight = rect.left >= inputRect.left + inputRect.width * 0.45;
    const notTooFar = rect.left - inputRect.right <= 140;
    if (!nearRight || !notTooFar) continue;

    const signalText = [
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.getAttribute('data-testid'),
      control.textContent,
      (control as HTMLInputElement).value,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (SEND_ACTION_KEYWORDS.some(kw => signalText.includes(kw))) {
      return true;
    }
  }

  return false;
};

/**
 * 非 AI 站点下，只有具备明确“聊天/提问意图”的 contenteditable 才应触发按钮。
 * 结构信号（textbox / 富文本框架）仅用于辅助确认，不足以单独放行。
 */
export const shouldAcceptContentEditableForNonAISite = (
  signals: ContentEditableIntentSignals
): boolean => {
  const {
    hasTextboxRole,
    hasRichEditor,
    hasTextHint,
    hasChatContainer,
    hasSendControl,
  } = signals;

  const hasStructuralSignal = hasTextboxRole || hasRichEditor;
  const hasIntentSignal = hasTextHint || hasSendControl;

  if (hasTextHint && hasChatContainer) return true;
  if (hasIntentSignal && hasStructuralSignal) return true;
  if (hasSendControl && hasChatContainer) return true;

  return false;
};

/**
 * AI 站点里，部分编辑器会把真实焦点放到隐藏的原生 input/textarea，
 * 但点击事件目标仍然来自真正的可编辑区域。
 * 仅在这种场景下，才回退到事件目标继续查找输入框。
 */
export const shouldFallbackToEventTargetAfterNativeFocus = (
  signals: NativeFocusFallbackSignals
): boolean => {
  const { isAISite, focusedTagName, eventTargetMatchesFocused } = signals;

  if (!isAISite) return false;
  if (eventTargetMatchesFocused) return false;

  return focusedTagName === 'INPUT' || focusedTagName === 'TEXTAREA';
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
  const hasTextboxRole = TEXTBOX_ROLES.includes(role);

  // 信号 2：匹配已知富文本编辑器框架
  let hasRichEditor = false;
  for (const selector of RICH_EDITOR_SELECTORS) {
    if (el.matches(selector) || el.querySelector(selector)) {
      hasRichEditor = true;
      break;
    }
  }

  // 信号 3：aria-label / data-placeholder 包含文本输入关键词
  const hintText = getHintText(el);
  const hasTextHint =
    !!hintText && TEXT_INPUT_KEYWORDS.some(kw => hintText.includes(kw));

  // 信号 4：父级有聊天/消息相关的容器类名
  const hasChatContainer = hasChatContainerContext(el);

  // 信号 5：附近存在发送/提交控件
  const hasSendControl = hasNearbySendControl(el);

  return shouldAcceptContentEditableForNonAISite({
    hasTextboxRole,
    hasRichEditor,
    hasTextHint,
    hasChatContainer,
    hasSendControl,
  });
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

  // 对 search 输入框收紧触发门槛，减少 AI 站点中的“全站搜索”误触发
  if (inputType === 'search') {
    const hintText = getHintText(el);
    const hasChatHint = CHAT_SEARCH_HINT_KEYWORDS.some(kw =>
      hintText.includes(kw)
    );
    const hasChatContext = hasChatContainerContext(el);
    const hasSendControl = hasNearbySendControl(el);
    const chatSignalCount = [
      hasChatHint,
      hasChatContext,
      hasSendControl,
    ].filter(Boolean).length;

    const hasGlobalSearchHint = GLOBAL_SEARCH_HINT_KEYWORDS.some(kw =>
      hintText.includes(kw)
    );
    if (hasGlobalSearchHint && chatSignalCount === 0) return false;

    // 至少命中 2 个聊天信号，才将 search 视为聊天输入框
    if (chatSignalCount < 2) return false;
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

  let current: Element | null = el;
  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    // textarea：直接验证
    if (current.tagName === 'TEXTAREA') {
      return isValidTextarea(current as HTMLTextAreaElement)
        ? (current as HTMLTextAreaElement)
        : null;
    }

    // input：直接验证
    if (current.tagName === 'INPUT') {
      return isValidTextInput(current as HTMLInputElement)
        ? (current as HTMLInputElement)
        : null;
    }

    // contenteditable：查找根元素再验证
    if ((current as HTMLElement).isContentEditable) {
      const root = findContentEditableRoot(current);
      if (root && isValidContentEditable(root)) {
        return root;
      }
    }

    current = getCrossBoundaryParent(current);
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
    // ProseMirror/Slate 等框架编辑器使用 textContent 写入时，
    // 可能只更新 DOM 而不更新内部状态，导致“看起来改了但无法发送”。
    if (isFrameworkManagedContentEditable(el)) {
      setInputValue(el, value);
      return;
    }

    el.textContent = value;
    el.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertReplacementText',
        data: value,
      })
    );
    el.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertReplacementText',
        data: value,
      })
    );
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
    const target = findEditableElement(getEventElement(e));
    if (target) {
      activeInput = target;
      onFocus(target);
    }
  };

  /** 处理焦点丢失 */
  const handleFocusOut = (): void => {
    setTimeout(() => {
      const newFocus = getDeepActiveElement();
      const newTarget = newFocus ? findEditableElement(newFocus) : null;
      if (!newTarget) {
        onBlur();
      }
    }, 200);
  };

  /** 处理点击（补充 focusin 的不足） */
  const handleClick = (e: MouseEvent): void => {
    const eventTarget = getEventElement(e);
    const focused = getDeepActiveElement();
    if (focused) {
      const focusedEditable = findEditableElement(focused);
      if (focusedEditable) {
        activeInput = focusedEditable;
        onFocus(focusedEditable);
        return;
      }

      // 若当前聚焦的是原生输入框但不符合 prompt 条件（如数字输入框），
      // 则默认不再从点击目标向上回溯，避免误命中祖先 contenteditable 容器。
      // 但 AI 站点里的框架编辑器可能会把焦点留在隐藏 textarea/input，
      // 这时允许基于真实点击目标再尝试一次。
      if (
        shouldFallbackToEventTargetAfterNativeFocus({
          isAISite: isAIChatSite(),
          focusedTagName: focused.tagName,
          eventTargetMatchesFocused: eventTarget === focused,
        })
      ) {
        const fallbackTarget = findEditableElement(eventTarget);
        if (fallbackTarget) {
          activeInput = fallbackTarget;
          onFocus(fallbackTarget);
        }
        return;
      }

      if (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA') {
        return;
      }
    }

    const target = findEditableElement(eventTarget);
    if (target) {
      activeInput = target;
      onFocus(target);
    }
  };

  /** 处理输入事件（捕获新出现的输入框） */
  const handleInput = (e: Event): void => {
    const target = findEditableElement(getEventElement(e));
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
    const focused = getDeepActiveElement();
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
  const focused = getDeepActiveElement();
  return focused ? findEditableElement(focused) : null;
};
