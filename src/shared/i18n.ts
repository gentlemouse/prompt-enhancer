/**
 * 国际化工具模块
 *
 * 封装 chrome.i18n.getMessage，提供统一的多语言文本获取接口。
 * Chrome 会根据用户的浏览器/系统语言自动匹配 _locales 下的消息文件。
 */

/**
 * 获取国际化文本
 * @param key 消息键名（对应 messages.json 中的 key）
 * @param substitutions 替换参数
 * @returns 翻译后的文本，未找到时返回 key 本身
 */
export const t = (key: string, ...substitutions: string[]): string => {
  try {
    const msg = chrome.i18n.getMessage(key, substitutions);
    return msg || key;
  } catch {
    return key;
  }
};

/**
 * 批量替换 DOM 元素中的国际化文本
 * 扫描所有带 data-i18n 属性的元素并替换其文本内容
 * 支持的属性：
 * - data-i18n="key" → 替换 textContent
 * - data-i18n-placeholder="key" → 替换 placeholder
 * - data-i18n-title="key" → 替换 title
 * - data-i18n-html="key" → 替换 innerHTML（用于包含 HTML 的文本）
 * @param root 根元素，默认 document
 */
export const applyI18n = (root: Document | HTMLElement = document): void => {
  // textContent
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  // innerHTML
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (key) el.innerHTML = t(key);
  });

  // placeholder
  root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) (el as HTMLInputElement).placeholder = t(key);
  });

  // title
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.title = t(key);
  });
};
