/**
 * Popup 脚本
 * 处理设置页面的交互逻辑
 */

import type { APIProvider, APIProviderConfig, TrialState } from '@shared/types';
import { getStorageConfig, saveStorageConfig } from '@shared/storage';
import { getTrialData } from '@shared/trial';
import { isByokConfigured } from '@shared/mode';
import { validateEndpoint, validateApiKey } from '@shared/utils/validation';
import { API_PROVIDERS } from '@shared/constants';
import { t, applyI18n } from '@shared/i18n';

// 试用横幅 DOM 元素
const trialBanner = document.getElementById('trialBanner') as HTMLElement;
const trialLabel = document.getElementById('trialLabel') as HTMLElement;
const trialCount = document.getElementById('trialCount') as HTMLElement;
const trialFill = document.getElementById('trialFill') as HTMLElement;
const setupNotice = document.getElementById('setupNotice') as HTMLElement;
const setupNoticeTitle = document.getElementById(
  'setupNoticeTitle'
) as HTMLElement;
const setupNoticeDesc = document.getElementById(
  'setupNoticeDesc'
) as HTMLElement;

// DOM 元素
const providerSelect = document.getElementById('provider') as HTMLSelectElement;
const modelSelect = document.getElementById('model') as HTMLSelectElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const apiKeyHint = document.getElementById('apiKeyHint') as HTMLElement;
const customEndpointInput = document.getElementById(
  'customEndpoint'
) as HTMLInputElement;
const customEndpointGroup = document.getElementById(
  'customEndpointGroup'
) as HTMLElement;
const customModelInput = document.getElementById(
  'customModel'
) as HTMLInputElement;
const customModelGroup = document.getElementById(
  'customModelGroup'
) as HTMLElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLElement;
const anthropicWarning = document.getElementById(
  'anthropicWarning'
) as HTMLElement;
const anthropicAck = document.getElementById(
  'anthropicAck'
) as HTMLInputElement;
const endpointHint = document.getElementById('endpointHint') as HTMLElement;
const shortcutEnhance = document.getElementById(
  'shortcutEnhance'
) as HTMLElement;
const shortcutUndo = document.getElementById('shortcutUndo') as HTMLElement;
const pageParams = new window.URLSearchParams(window.location.search);

const focusApiKeySetup = (): void => {
  window.requestAnimationFrame(() => {
    apiKeyInput.focus();
    apiKeyInput.select();
    apiKeyInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
};

const showSetupNotice = (
  titleKey: string,
  descKey: string,
  hintKey: string
): void => {
  setupNotice.style.display = 'block';
  setupNoticeTitle.textContent = t(titleKey);
  setupNoticeDesc.textContent = t(descKey);
  apiKeyHint.textContent = t(hintKey);
  apiKeyHint.className = 'hint warning';
  focusApiKeySetup();
};

/** 当前 API 提供商配置 */
const currentProviders: Record<APIProvider, APIProviderConfig> = API_PROVIDERS;

/**
 * 更新模型列表
 */
const updateModelList = (provider: APIProvider): void => {
  const models = currentProviders[provider]?.models || [];
  modelSelect.innerHTML = models
    .map(m => `<option value="${m}">${m}</option>`)
    .join('');
};

/**
 * 显示/隐藏自定义配置输入框
 */
const toggleCustomEndpoint = (provider: APIProvider): void => {
  if (provider === 'custom') {
    customEndpointGroup.classList.add('show');
    customModelGroup.classList.add('show');
  } else {
    customEndpointGroup.classList.remove('show');
    customModelGroup.classList.remove('show');
  }

  // P0-1.3: 显示/隐藏 Anthropic 警告
  if (provider === 'anthropic') {
    anthropicWarning.style.display = 'block';
  } else {
    anthropicWarning.style.display = 'none';
  }
};

/**
 * 显示状态消息
 */
const showStatus = (message: string, type: 'success' | 'error'): void => {
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
  setTimeout(() => {
    statusDiv.className = 'status';
  }, 3000);
};

/**
 * P0-1.4: 验证自定义 Endpoint
 */
const validateCustomEndpoint = (): boolean => {
  const provider = providerSelect.value as APIProvider;
  if (provider !== 'custom') return true;

  const endpoint = customEndpointInput.value.trim();
  const result = validateEndpoint(endpoint);

  if (!result.valid) {
    endpointHint.textContent = result.error || t('statusInvalidEndpoint');
    endpointHint.className = 'hint error';
    customEndpointInput.classList.add('error');
    return false;
  }

  endpointHint.textContent = t('statusEndpointOk');
  endpointHint.className = 'hint success';
  customEndpointInput.classList.remove('error');
  return true;
};

/**
 * 加载保存的设置
 */
const loadSettings = async (): Promise<void> => {
  try {
    const config = await getStorageConfig();

    if (config?.apiProvider) {
      providerSelect.value = config.apiProvider;
      updateModelList(config.apiProvider);
      toggleCustomEndpoint(config.apiProvider);
    }

    if (config?.model) {
      modelSelect.value = config.model;
    }

    if (config?.apiKey) {
      apiKeyInput.value = config.apiKey;
    }

    if (config?.customEndpoint) {
      customEndpointInput.value = config.customEndpoint;
    }

    if (config?.customModel) {
      customModelInput.value = config.customModel;
    }

    if (config?.anthropicWarningAcknowledged) {
      anthropicAck.checked = true;
    }

    const source = pageParams.get('source');
    if (source === 'free_quota_exhausted') {
      showSetupNotice(
        'freeQuotaExhaustedTitle',
        'popupSetupOwnKeyDesc',
        'popupSetupOwnKeyHint'
      );
    } else if (source === 'trial_expired') {
      showSetupNotice(
        'trialExpired',
        'popupTrialExpiredSetupDesc',
        'popupSetupOwnKeyHint'
      );
    }
  } catch {
    showStatus(t('statusLoadFailed'), 'error');
  }
};

/**
 * 保存设置
 */
const saveSettings = async (): Promise<void> => {
  const apiProvider = providerSelect.value as APIProvider;
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const customEndpoint = customEndpointInput.value.trim();
  const customModel = customModelInput.value.trim();

  // 验证 API Key
  const keyValidation = validateApiKey(apiKey, apiProvider);
  if (!keyValidation.valid) {
    showStatus(keyValidation.error || t('statusEnterApiKey'), 'error');
    return;
  }

  if (apiProvider === 'custom') {
    if (!validateCustomEndpoint()) {
      showStatus(t('statusCheckEndpoint'), 'error');
      return;
    }
  }

  if (apiProvider === 'anthropic' && !anthropicAck.checked) {
    showStatus(t('statusConfirmAnthropic'), 'error');
    return;
  }

  // 自定义提供商使用自定义模型名
  const finalModel =
    apiProvider === 'custom' && customModel ? customModel : model;

  try {
    await saveStorageConfig({
      apiProvider,
      apiKey,
      model: finalModel,
      customEndpoint: apiProvider === 'custom' ? customEndpoint : '',
      customModel: apiProvider === 'custom' ? customModel : '',
      anthropicWarningAcknowledged:
        apiProvider === 'anthropic' ? anthropicAck.checked : undefined,
    });
    showStatus(t('statusSaved'), 'success');
  } catch (error) {
    showStatus(
      t(
        'statusSaveFailed',
        error instanceof Error ? error.message : t('statusUnknownError')
      ),
      'error'
    );
  }
};

/**
 * 检测操作系统并更新快捷键显示
 */
const updateShortcutDisplay = (): void => {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  if (isMac) {
    shortcutEnhance.innerHTML = '<kbd>⌘</kbd><kbd>⇧</kbd><kbd>E</kbd>';
    shortcutUndo.innerHTML = '<kbd>⌘</kbd><kbd>Z</kbd>';
  } else {
    shortcutEnhance.innerHTML = '<kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>E</kbd>';
    shortcutUndo.innerHTML = '<kbd>Ctrl</kbd><kbd>Z</kbd>';
  }
};

// 事件监听
providerSelect.addEventListener('change', e => {
  const provider = (e.target as HTMLSelectElement).value as APIProvider;
  updateModelList(provider);
  toggleCustomEndpoint(provider);
});

// P0-1.4: 实时验证 Endpoint
customEndpointInput.addEventListener('blur', validateCustomEndpoint);
customEndpointInput.addEventListener('input', () => {
  endpointHint.textContent = '';
  endpointHint.className = 'hint';
  customEndpointInput.classList.remove('error');
});

saveBtn.addEventListener('click', saveSettings);

// 回车保存
apiKeyInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    saveSettings();
  }
});

// P2-3.8: 引入 Onboarding
import { showOnboarding, checkNeedsOnboarding } from './onboarding';

const renderTrialBanner = (remaining: number, total: number): void => {
  trialBanner.style.display = 'block';

  const safeTotal = total > 0 ? total : 10;
  const pct = Math.round((remaining / safeTotal) * 100);

  trialLabel.textContent =
    remaining > 0 ? t('trialBannerActive') : t('trialBannerExpired');
  trialCount.textContent = t(
    'trialRemaining',
    String(remaining),
    String(safeTotal)
  );

  trialFill.style.width = `${pct}%`;
  trialFill.className = 'trial-banner-fill';
  if (remaining <= 0) {
    trialFill.classList.add('expired');
  } else if (remaining <= 3) {
    trialFill.classList.add('warning');
  } else {
    trialFill.classList.add('good');
  }
};

/**
 * 更新试用横幅显示
 */
const updateTrialBanner = async (): Promise<void> => {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getTrialStatus',
    });
    if (!response?.success) return;

    const { trialState, trialRemaining, trialTotal } = response;

    if (trialState === 'API_CONFIGURED') {
      trialBanner.style.display = 'none';
      return;
    }

    const remaining = trialRemaining ?? 0;
    const total = trialTotal ?? 10;
    renderTrialBanner(remaining, total);

    if (trialState === 'TRIAL_EXPIRED') {
      showTrialExpiredOverlay();
    }
  } catch {
    try {
      // background 通道异常时兜底读取本地状态，避免免费额度展示空白
      const config = await getStorageConfig();
      if (isByokConfigured(config)) {
        trialBanner.style.display = 'none';
        return;
      }

      const trialData = await getTrialData();
      const remaining = Math.max(0, trialData.maxUses - trialData.usedCount);
      const state: TrialState =
        remaining > 0 ? 'TRIAL_ACTIVE' : 'TRIAL_EXPIRED';
      renderTrialBanner(remaining, trialData.maxUses);
      if (state === 'TRIAL_EXPIRED') {
        showTrialExpiredOverlay();
      }
    } catch {
      // 最终兜底：不影响设置页主流程
    }
  }
};

/**
 * 显示试用结束引导覆盖层
 */
const showTrialExpiredOverlay = (): void => {
  if (document.getElementById('trialExpiredOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'trialExpiredOverlay';
  overlay.className = 'trial-expired-overlay';
  overlay.innerHTML = `
    <div class="trial-expired-icon">🔓</div>
    <div class="trial-expired-title" data-i18n="trialUnlock"></div>
    <div class="trial-expired-desc" data-i18n="trialExpiredOverlayDesc"></div>
    <div class="trial-expired-steps">
      <div class="trial-expired-steps-title" data-i18n="trialHowToGetKey"></div>
      <ol>
        <li data-i18n="trialStep1"></li>
        <li data-i18n="trialStep2"></li>
        <li data-i18n="trialStep3"></li>
      </ol>
    </div>
    <button class="trial-expired-btn" data-i18n="trialStartConfig"></button>
  `;

  document.body.appendChild(overlay);
  applyI18n(overlay);

  const btn = overlay.querySelector('.trial-expired-btn') as HTMLButtonElement;
  btn.addEventListener('click', () => {
    overlay.remove();
    showSetupNotice(
      'trialExpired',
      'popupTrialExpiredSetupDesc',
      'popupSetupOwnKeyHint'
    );
  });
};

/**
 * 弹窗打开时尝试为当前活动标签页注入内容脚本
 * 兜底修复：当站点未自动注入时，用户打开弹窗即可立即可用
 */
const injectCurrentTabContentScript = async (): Promise<void> => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !tab.url) return;
    if (!/^https?:\/\//i.test(tab.url)) return;

    await chrome.runtime.sendMessage({
      action: 'injectContentScript',
      tabId: tab.id,
    });
  } catch {
    // 注入失败不影响设置页主流程
  }
};

/**
 * 初始化
 */
const initialize = async (): Promise<void> => {
  applyI18n();
  updateShortcutDisplay();
  await injectCurrentTabContentScript();

  const needsOnboarding = await checkNeedsOnboarding();
  if (needsOnboarding) {
    showOnboarding(document.body, () => {
      loadSettings();
      updateTrialBanner();
    });
  } else {
    loadSettings();
    updateTrialBanner();
  }
};

// 启动
initialize();
