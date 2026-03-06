/**
 * 试用耗尽提示组件
 * 在 Shadow DOM 中显示持久提示，引导用户配置 API Key
 */

import { getShadowHost } from './shadow-host';
import { t } from '@shared/i18n';
import type { QuotaBlockReason } from '@shared/quota-errors';

/** 当前提示元素 */
let currentPrompt: HTMLElement | null = null;

/**
 * 显示试用耗尽提示
 */
export const showTrialExpiredPrompt = (
  reason: QuotaBlockReason = 'trial_expired'
): void => {
  if (currentPrompt) return;

  const { root } = getShadowHost();
  const isFreeQuotaExhausted = reason === 'free_quota_exhausted';

  const prompt = document.createElement('div');
  prompt.className = 'prompt-enhancer-trial-expired';
  prompt.setAttribute('role', 'alert');

  prompt.innerHTML = `
    <button class="prompt-enhancer-trial-expired-close" aria-label="Close">×</button>
    <div class="prompt-enhancer-trial-expired-icon">${isFreeQuotaExhausted ? '⚠️' : '🔒'}</div>
    <div class="prompt-enhancer-trial-expired-title">${t(
      isFreeQuotaExhausted ? 'freeQuotaExhaustedTitle' : 'trialExpired'
    )}</div>
    <div class="prompt-enhancer-trial-expired-desc">${t(
      isFreeQuotaExhausted ? 'freeQuotaExhaustedDesc' : 'trialExpiredDesc'
    )}</div>
    <button class="prompt-enhancer-trial-expired-btn">${t('trialOpenSettings')}</button>
  `;

  const closeBtn = prompt.querySelector(
    '.prompt-enhancer-trial-expired-close'
  ) as HTMLButtonElement;
  closeBtn.addEventListener('click', () => dismissTrialExpiredPrompt());

  const openBtn = prompt.querySelector(
    '.prompt-enhancer-trial-expired-btn'
  ) as HTMLButtonElement;
  openBtn.addEventListener('click', () => {
    const popupUrl = chrome.runtime.getURL(
      `src/popup/index.html?source=${reason}`
    );
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
