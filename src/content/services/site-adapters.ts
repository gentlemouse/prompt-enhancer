/**
 * 站点输入适配器
 *
 * 目的：
 * - 将高耦合站点的输入框识别与写值逻辑收敛到单独模块
 * - 先从 ChatGPT 开始，后续可按站点逐步扩展
 */

type AdapterEditableElement =
  | HTMLTextAreaElement
  | HTMLInputElement
  | HTMLElement;

type WriteMode = 'direct' | 'replace';

/** 站点输入适配器元素信号 */
export interface SiteAdapterElementSignals {
  hostname: string;
  id: string | null;
  tagName: string | null;
  isContentEditable: boolean;
  role: string | null;
  name: string | null;
}

/** 站点输入适配器 */
export interface SiteInputAdapter {
  id: string;
  matches: (el: Element) => boolean;
  isValidElement: (el: Element) => boolean;
  readValue: (el: AdapterEditableElement) => string;
  writeValue: (
    el: AdapterEditableElement,
    value: string,
    mode: WriteMode
  ) => boolean;
}

const CHATGPT_HOSTS = ['chatgpt.com', 'chat.openai.com'];

const matchesHostname = (hostname: string, domains: string[]): boolean => {
  const normalizedHost = hostname.toLowerCase();
  return domains.some(domain => {
    const normalized = domain.toLowerCase();
    return (
      normalizedHost === normalized || normalizedHost.endsWith(`.${normalized}`)
    );
  });
};

const getElementSignals = (el: Element): SiteAdapterElementSignals => {
  const element = el as HTMLElement;
  return {
    hostname: window.location.hostname,
    id: element.id || null,
    tagName: element.tagName || null,
    isContentEditable: element.isContentEditable,
    role: element.getAttribute?.('role'),
    name: element.getAttribute?.('name'),
  };
};

/**
 * ChatGPT 主输入框识别信号。
 * 只接受真正的 composer root，不接受隐藏 fallback textarea。
 */
export const isChatGPTPromptElementSignals = (
  signals: SiteAdapterElementSignals
): boolean => {
  if (!matchesHostname(signals.hostname, CHATGPT_HOSTS)) return false;
  if (signals.id !== 'prompt-textarea') return false;
  if (!signals.isContentEditable) return false;
  if (signals.tagName !== 'DIV') return false;

  return signals.role === 'textbox';
};

const createChatGptParagraphNodes = (value: string): HTMLElement[] => {
  const normalized = value.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const paragraphs = lines.length > 0 ? lines : [''];

  return paragraphs.map(line => {
    const paragraph = document.createElement('p');
    if (line) {
      paragraph.textContent = line;
    } else {
      paragraph.appendChild(document.createElement('br'));
    }
    return paragraph;
  });
};

const dispatchChatGptInputEvents = (
  editor: HTMLElement,
  value: string,
  mode: WriteMode
): void => {
  const inputType =
    mode === 'direct' ? 'insertReplacementText' : 'insertFromPaste';

  editor.dispatchEvent(
    new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType,
      data: value,
    })
  );

  editor.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType,
      data: value,
    })
  );
};

const chatGptAdapter: SiteInputAdapter = {
  id: 'chatgpt',
  matches: (el: Element): boolean => {
    return isChatGPTPromptElementSignals(getElementSignals(el));
  },
  isValidElement: (el: Element): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    if (!chatGptAdapter.matches(el)) return false;

    const rect = el.getBoundingClientRect();
    return rect.width >= 120 && rect.height >= 24;
  },
  readValue: (el: AdapterEditableElement): string => {
    if (!(el instanceof HTMLElement)) return '';
    return el.innerText || el.textContent || '';
  },
  writeValue: (
    el: AdapterEditableElement,
    value: string,
    mode: WriteMode
  ): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    if (!chatGptAdapter.matches(el)) return false;

    const nodes = createChatGptParagraphNodes(value);
    el.replaceChildren(...nodes);
    dispatchChatGptInputEvents(el, value, mode);
    return true;
  },
};

const SITE_INPUT_ADAPTERS: SiteInputAdapter[] = [chatGptAdapter];

/**
 * 根据元素解析适配器。
 */
export const getSiteInputAdapter = (
  el: Element | null
): SiteInputAdapter | null => {
  if (!el) return null;

  for (const adapter of SITE_INPUT_ADAPTERS) {
    if (adapter.matches(el)) return adapter;
  }

  return null;
};
