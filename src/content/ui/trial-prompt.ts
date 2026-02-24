/**
 * 试用耗尽提示组件
 * 在 Shadow DOM 中显示持久提示，引导用户配置 API Key
 */

import { getShadowHost } from './shadow-host';
import { t } from '@shared/i18n';

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

  prompt.innerHTML = `
    <button class="prompt-enhancer-trial-expired-close" aria-label="Close">×</button>
    <div class="prompt-enhancer-trial-expired-icon">🔒</div>
    <div class="prompt-enhancer-trial-expired-title">${t('trialExpired')}</div>
    <div class="prompt-enhancer-trial-expired-desc">${t('trialExpiredDesc')}</div>
    <button class="prompt-enhancer-trial-expired-btn">${t('trialOpenSettings')}</button>
  `;

  const closeBtn = prompt.querySelector('.prompt-enhancer-trial-expired-close') as HTMLButtonElement;
  closeBtn.addEventListener('click', () => dismissTrialExpiredPrompt());

  const openBtn = prompt.querySelector('.prompt-enhancer-trial-expired-btn') as HTMLButtonElement;
  openBtn.addEventListener('click', () => {
    // 直接在新标签页中打开扩展设置页
    const popupUrl = chrome.runtime.getURL('src/popup/index.html');
    window.open(popupUrl, '_blank');
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
