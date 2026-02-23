/**
 * 试用耗尽提示组件
 * 在 Shadow DOM 中显示持久提示，引导用户配置 API Key
 */

import { getShadowHost } from './shadow-host';

/** 当前提示元素 */
let currentPrompt: HTMLElement | null = null;

/**
 * 显示试用耗尽提示
 */
export const showTrialExpiredPrompt = (): void => {
  if (currentPrompt) return;

  const { root } = getShadowHost();

  const prompt = document.createElement('div');
  prompt.className = 'prompt-enhancer-trial-expired';
  prompt.setAttribute('role', 'alert');

  const isZh = navigator.language.startsWith('zh');

  prompt.innerHTML = `
    <button class="prompt-enhancer-trial-expired-close" aria-label="Close">×</button>
    <div class="prompt-enhancer-trial-expired-icon">🔒</div>
    <div class="prompt-enhancer-trial-expired-title">${isZh ? '免费试用已用完' : 'Free Trial Expired'}</div>
    <div class="prompt-enhancer-trial-expired-desc">${isZh ? '配置您自己的 API Key 即可继续使用' : 'Configure your API Key to continue'}</div>
    <button class="prompt-enhancer-trial-expired-btn">${isZh ? '打开设置' : 'Open Settings'}</button>
  `;

  const closeBtn = prompt.querySelector('.prompt-enhancer-trial-expired-close') as HTMLButtonElement;
  closeBtn.addEventListener('click', () => dismissTrialExpiredPrompt());

  const openBtn = prompt.querySelector('.prompt-enhancer-trial-expired-btn') as HTMLButtonElement;
  openBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openPopup' }).catch(() => {
      /* Popup 不支持 programmatic open，回退到新标签页 */
    });
    dismissTrialExpiredPrompt();
  });

  root.appendChild(prompt);
  currentPrompt = prompt;

  requestAnimationFrame(() => {
    prompt.classList.add('show');
  });
};

/**
 * 关闭试用耗尽提示
 */
const dismissTrialExpiredPrompt = (): void => {
  if (!currentPrompt) return;

  currentPrompt.classList.remove('show');
  const el = currentPrompt;
  currentPrompt = null;

  setTimeout(() => {
    const { root } = getShadowHost();
    if (root.contains(el)) {
      root.removeChild(el);
    }
  }, 300);
};
