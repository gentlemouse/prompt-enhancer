/**
 * Onboarding 向导模块
 * P2-3.8: 首次安装引导流程
 */

import { t, applyI18n } from '@shared/i18n';

/** 向导状态 */
let currentStep = 0;
let container: HTMLElement | null = null;

/**
 * 创建向导 UI
 */
const createOnboardingUI = (onComplete: () => void): HTMLElement => {
  const div = document.createElement('div');
  div.className = 'onboarding-overlay';
  div.innerHTML = `
    <div class="onboarding-modal" role="dialog" aria-labelledby="onboarding-title" aria-modal="true">
      <div class="onboarding-header">
        <h2 id="onboarding-title" data-i18n="onboardingTitle"></h2>
        <div class="onboarding-progress">
          <span class="step-indicator step-1 active"></span>
          <span class="step-indicator step-2"></span>
          <span class="step-indicator step-3"></span>
        </div>
      </div>
      <div class="onboarding-content">
        <div class="onboarding-step active" data-step="0">
          <div class="step-icon">🎁</div>
          <h3 data-i18n="trialWelcome">免费体验，即刻开始</h3>
          <p data-i18n="trialWelcomeDesc">您有 10 次免费试用额度，无需配置即可体验 Prompt 润色功能。试用结束后，配置您自己的 API Key 即可无限制使用。</p>
        </div>
        <div class="onboarding-step" data-step="1">
          <div class="step-icon">⌨️</div>
          <h3 data-i18n="onboardingStep2Title"></h3>
          <p data-i18n-html="onboardingStep2Desc"></p>
          <p class="step-hint" data-i18n="onboardingStep2Hint"></p>
        </div>
        <div class="onboarding-step" data-step="2">
          <div class="step-icon">✨</div>
          <h3 data-i18n="onboardingStep3Title"></h3>
          <p data-i18n="onboardingStep3Desc"></p>
          <p class="step-hint" data-i18n="onboardingStep3Desc2"></p>
        </div>
      </div>
      <div class="onboarding-footer">
        <button class="onboarding-btn secondary" id="onboarding-skip" data-i18n="onboardingSkip"></button>
        <div class="onboarding-nav">
          <button class="onboarding-btn secondary" id="onboarding-prev" disabled data-i18n="onboardingPrev"></button>
          <button class="onboarding-btn primary" id="onboarding-next" data-i18n="onboardingNext"></button>
        </div>
      </div>
    </div>
  `;

  // 注入样式
  const style = document.createElement('style');
  style.textContent = getOnboardingStyles();
  div.appendChild(style);

  // 绑定事件
  const prevBtn = div.querySelector('#onboarding-prev') as HTMLButtonElement;
  const nextBtn = div.querySelector('#onboarding-next') as HTMLButtonElement;
  const skipBtn = div.querySelector('#onboarding-skip') as HTMLButtonElement;

  prevBtn.addEventListener('click', () => goToStep(currentStep - 1));
  nextBtn.addEventListener('click', () => {
    if (currentStep === 2) {
      completeOnboarding(onComplete);
    } else {
      goToStep(currentStep + 1);
    }
  });
  skipBtn.addEventListener('click', () => completeOnboarding(onComplete));

  // 键盘导航
  div.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      completeOnboarding(onComplete);
    } else if (e.key === 'ArrowRight' && currentStep < 2) {
      goToStep(currentStep + 1);
    } else if (e.key === 'ArrowLeft' && currentStep > 0) {
      goToStep(currentStep - 1);
    }
  });

  return div;
};

/**
 * 跳转到指定步骤
 */
const goToStep = (step: number): void => {
  if (step < 0 || step > 2 || !container) return;

  currentStep = step;

  // 更新步骤指示器
  const indicators = container.querySelectorAll('.step-indicator');
  indicators.forEach((ind, i) => {
    ind.classList.toggle('active', i <= step);
    ind.classList.toggle('current', i === step);
  });

  // 更新步骤内容
  const steps = container.querySelectorAll('.onboarding-step');
  steps.forEach((s, i) => {
    s.classList.toggle('active', i === step);
  });

  // 更新按钮状态
  const prevBtn = container.querySelector(
    '#onboarding-prev'
  ) as HTMLButtonElement;
  const nextBtn = container.querySelector(
    '#onboarding-next'
  ) as HTMLButtonElement;

  prevBtn.disabled = step === 0;
  nextBtn.textContent = step === 2 ? t('onboardingStart') : t('onboardingNext');

  // 聚焦到下一步按钮
  nextBtn.focus();
};

/**
 * 完成向导
 */
const completeOnboarding = async (onComplete: () => void): Promise<void> => {
  try {
    await chrome.runtime.sendMessage({ action: 'completeOnboarding' });
  } catch {
    // 忽略错误
  }

  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;
  currentStep = 0;

  onComplete();
};

/**
 * 显示向导
 */
export const showOnboarding = (
  parent: HTMLElement,
  onComplete: () => void
): void => {
  if (container) return;

  container = createOnboardingUI(onComplete);
  parent.appendChild(container);
  applyI18n(container);

  // 聚焦到模态框
  const modal = container.querySelector('.onboarding-modal') as HTMLElement;
  modal?.focus();
};

/**
 * 检查是否需要显示向导
 */
export const checkNeedsOnboarding = async (): Promise<boolean> => {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'checkOnboarding',
    });
    return response?.needsOnboarding ?? false;
  } catch {
    return false;
  }
};

/**
 * 获取向导样式
 */
const getOnboardingStyles = (): string => `
  .onboarding-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .onboarding-modal {
    background: #ffffff;
    border-radius: 16px;
    width: 100%;
    max-width: 340px;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.04),
      0 8px 40px rgba(0, 0, 0, 0.16),
      0 24px 60px rgba(0, 0, 0, 0.08);
    animation: modal-appear 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    outline: none;
    overflow: hidden;
  }

  @keyframes modal-appear {
    from {
      opacity: 0;
      transform: scale(0.94) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .onboarding-header {
    padding: 20px 20px 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    text-align: center;
  }

  .onboarding-header h2 {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.3px;
    margin: 0 0 14px;
    color: #1e1f24;
  }

  .onboarding-progress {
    display: flex;
    justify-content: center;
    gap: 6px;
  }

  .step-indicator {
    width: 28px;
    height: 3px;
    border-radius: 9999px;
    background: #e8e8ec;
    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .step-indicator.active {
    background: linear-gradient(135deg, #3A3937, #272625);
  }

  .step-indicator.current {
    background: linear-gradient(135deg, #3A3937, #272625);
    width: 36px;
  }

  .onboarding-content {
    padding: 24px 20px;
    min-height: 180px;
    position: relative;
  }

  .onboarding-step {
    display: none;
    text-align: center;
    animation: step-appear 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .onboarding-step.active {
    display: block;
  }

  @keyframes step-appear {
    from {
      opacity: 0;
      transform: translateX(12px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .step-icon {
    font-size: 42px;
    margin-bottom: 14px;
  }

  .onboarding-step h3 {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 15px;
    font-weight: 650;
    margin: 0 0 8px;
    letter-spacing: -0.2px;
    color: #1e1f24;
  }

  .onboarding-step p {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    color: #62636c;
    line-height: 1.6;
    margin: 0 0 8px;
  }

  .step-hint {
    font-size: 11px !important;
    color: #8b8d98 !important;
  }

  .onboarding-step kbd {
    display: inline-block;
    padding: 2px 6px;
    background: #f0f0f3;
    border: 1px solid #e0e0e5;
    border-radius: 5px;
    font-size: 11px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    box-shadow: 0 1px 0 #e0e0e5;
  }

  .onboarding-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    background: #fcfcfd;
  }

  .onboarding-nav {
    display: flex;
    gap: 8px;
  }

  .onboarding-btn {
    padding: 8px 18px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .onboarding-btn.primary {
    background: linear-gradient(135deg, #3A3937, #272625);
    color: #F6F1D5;
    box-shadow: inset 0 1px 1px rgba(246, 241, 213, 0.2), 0 1px 3px rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(0, 0, 0, 0.1);
  }

  .onboarding-btn.primary:hover {
    box-shadow: inset 0 1px 1px rgba(246, 241, 213, 0.3), 0 2px 6px rgba(0, 0, 0, 0.35);
    transform: translateY(-0.5px);
  }

  .onboarding-btn.secondary {
    background: #f0f0f3;
    color: #62636c;
  }

  .onboarding-btn.secondary:hover {
    background: #e8e8ec;
    color: #1e1f24;
  }

  .onboarding-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }

  .onboarding-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(246, 241, 213, 0.4);
  }

  /* 暗色模式 */
  @media (prefers-color-scheme: dark) {
    .onboarding-overlay {
      background: rgba(0, 0, 0, 0.6);
    }

    .onboarding-modal {
      background: #18191b;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.06),
        0 8px 40px rgba(0, 0, 0, 0.5),
        0 24px 60px rgba(0, 0, 0, 0.3);
    }

    .onboarding-header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .onboarding-header h2 {
      color: #edeef0;
    }

    .step-indicator {
      background: #272a2d;
    }

    .step-indicator.active,
    .step-indicator.current {
      background: linear-gradient(135deg, #272625, #171717);
    }

    .onboarding-step h3 {
      color: #edeef0;
    }

    .onboarding-step p {
      color: #a0a4ab;
    }

    .step-hint {
      color: #696e77 !important;
    }

    .onboarding-step kbd {
      background: #212225;
      border: 1px solid #363a3f;
      color: #a0a4ab;
      box-shadow: 0 1px 0 #363a3f;
    }

    .onboarding-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      background: #111113;
    }

    .onboarding-btn.primary {
      background: linear-gradient(135deg, #272625, #171717);
      color: #F6F1D5;
      box-shadow: inset 0 1px 1px rgba(246, 241, 213, 0.1), 0 1px 3px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .onboarding-btn.primary:hover {
      box-shadow: inset 0 1px 1px rgba(246, 241, 213, 0.2), 0 2px 6px rgba(0, 0, 0, 0.4);
      background: linear-gradient(135deg, #3A3937, #272625);
    }

    .onboarding-btn.secondary {
      background: #212225;
      color: #a0a4ab;
    }

    .onboarding-btn.secondary:hover {
      background: #2e3135;
      color: #edeef0;
    }

    .onboarding-btn:focus-visible {
      box-shadow: 0 0 0 3px rgba(246, 241, 213, 0.25);
    }
  }
`;
