/**
 * Onboarding 向导模块
 * P2-3.8: 首次安装引导流程
 */

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
          <h3>快捷键</h3>
          <p>使用 <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> 一键润色当前输入框的内容。</p>
          <p class="step-hint">提示：也可以点击输入框旁边的 ✨ 按钮</p>
        </div>
        <div class="onboarding-step" data-step="2">
          <div class="step-icon">✨</div>
          <h3>开始使用</h3>
          <p>一切准备就绪！在任意输入框中输入你的 Prompt，然后点击润色按钮或使用快捷键即可。</p>
          <p class="step-hint">优化后的结果会实时预览，你可以选择应用或取消。</p>
        </div>
      </div>
      <div class="onboarding-footer">
        <button class="onboarding-btn secondary" id="onboarding-skip">跳过</button>
        <div class="onboarding-nav">
          <button class="onboarding-btn secondary" id="onboarding-prev" disabled>上一步</button>
          <button class="onboarding-btn primary" id="onboarding-next">下一步</button>
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
  nextBtn.textContent = step === 2 ? '开始使用' : '下一步';

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
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .onboarding-modal {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 320px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    animation: modal-appear 0.3s ease;
    outline: none;
  }

  @keyframes modal-appear {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .onboarding-header {
    padding: 20px 20px 16px;
    border-bottom: 1px solid #eee;
    text-align: center;
  }

  .onboarding-header h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 12px;
  }

  .onboarding-progress {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .step-indicator {
    width: 24px;
    height: 4px;
    border-radius: 2px;
    background: #e0e0e0;
    transition: background 0.3s;
  }

  .step-indicator.active {
    background: #1a1a1a;
  }

  .step-indicator.current {
    background: #4a90d9;
  }

  .onboarding-content {
    padding: 20px;
    min-height: 180px;
    position: relative;
  }

  .onboarding-step {
    display: none;
    text-align: center;
    animation: step-appear 0.3s ease;
  }

  .onboarding-step.active {
    display: block;
  }

  @keyframes step-appear {
    from {
      opacity: 0;
      transform: translateX(10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .step-icon {
    font-size: 40px;
    margin-bottom: 12px;
  }

  .onboarding-step h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  .onboarding-step p {
    font-size: 13px;
    color: #666;
    line-height: 1.5;
    margin: 0 0 8px;
  }

  .step-hint {
    font-size: 11px !important;
    color: #999 !important;
  }

  .onboarding-step kbd {
    display: inline-block;
    padding: 2px 6px;
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
  }

  .onboarding-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-top: 1px solid #eee;
  }

  .onboarding-nav {
    display: flex;
    gap: 8px;
  }

  .onboarding-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .onboarding-btn.primary {
    background: #1a1a1a;
    color: white;
  }

  .onboarding-btn.primary:hover {
    background: #333;
  }

  .onboarding-btn.secondary {
    background: #f0f0f0;
    color: #666;
  }

  .onboarding-btn.secondary:hover {
    background: #e0e0e0;
  }

  .onboarding-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .onboarding-btn:focus {
    outline: 2px solid #4a90d9;
    outline-offset: 2px;
  }

  /* 暗色模式适配 */
  @media (prefers-color-scheme: dark) {
    .onboarding-modal {
      background: #1f1f1f;
      color: #e0e0e0;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    }

    .onboarding-header {
      border-bottom: 1px solid #333;
    }

    .onboarding-header h2 {
      color: #fff;
    }

    .step-indicator {
      background: #333;
    }

    .step-indicator.active {
      background: #fff;
    }

    .onboarding-step p {
      color: #aaa;
    }

    .step-hint {
      color: #666 !important;
    }

    .onboarding-step kbd {
      background: #2d2d2d;
      border: 1px solid #444;
      color: #ccc;
    }

    .onboarding-footer {
      border-top: 1px solid #333;
    }

    .onboarding-btn.primary {
      background: #fff;
      color: #000;
    }

    .onboarding-btn.primary:hover {
      background: #e0e0e0;
    }

    .onboarding-btn.secondary {
      background: #2d2d2d;
      color: #ccc;
    }

    .onboarding-btn.secondary:hover {
      background: #3a3a3a;
    }
  }
`;
