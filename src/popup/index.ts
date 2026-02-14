/**
 * Popup 脚本
 * 处理设置页面的交互逻辑
 */

import type { APIProvider, APIProviderConfig } from '@shared/types';
import { getStorageConfig, saveStorageConfig } from '@shared/storage';
import { validateEndpoint, validateApiKey } from '@shared/utils/validation';
import { API_PROVIDERS } from '@shared/constants';

// DOM 元素
const providerSelect = document.getElementById('provider') as HTMLSelectElement;
const modelSelect = document.getElementById('model') as HTMLSelectElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
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
const anthropicAck = document.getElementById('anthropicAck') as HTMLInputElement;
const endpointHint = document.getElementById('endpointHint') as HTMLElement;
const shortcutEnhance = document.getElementById(
  'shortcutEnhance'
) as HTMLElement;
const shortcutUndo = document.getElementById('shortcutUndo') as HTMLElement;

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
    endpointHint.textContent = result.error || '无效的地址';
    endpointHint.className = 'hint error';
    customEndpointInput.classList.add('error');
    return false;
  }

  endpointHint.textContent = '✓ 地址格式正确';
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
  } catch {
    showStatus('加载设置失败，请刷新', 'error');
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
    showStatus(keyValidation.error || '请输入 API Key', 'error');
    return;
  }

  // P0-1.4: 验证自定义 Endpoint
  if (apiProvider === 'custom') {
    if (!validateCustomEndpoint()) {
      showStatus('请检查 API 地址', 'error');
      return;
    }
  }

  // P0-1.3: 检查 Anthropic 警告确认
  if (apiProvider === 'anthropic' && !anthropicAck.checked) {
    showStatus('请先确认 Anthropic 安全警告', 'error');
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
    showStatus('设置已保存', 'success');
  } catch (error) {
    showStatus(
      '保存失败: ' + (error instanceof Error ? error.message : '未知错误'),
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

/**
 * 初始化
 */
const initialize = async (): Promise<void> => {
  updateShortcutDisplay();

  // 检查是否需要 Onboarding
  const needsOnboarding = await checkNeedsOnboarding();
  if (needsOnboarding) {
    showOnboarding(document.body, () => {
      loadSettings();
    });
  } else {
    loadSettings();
  }
};

// 启动
initialize();
