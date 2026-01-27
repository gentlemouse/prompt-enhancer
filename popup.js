// 从 background.js 获取 API 提供商配置
let API_PROVIDERS = {};

const providerSelect = document.getElementById('provider');
const modelSelect = document.getElementById('model');
const apiKeyInput = document.getElementById('apiKey');
const customEndpointInput = document.getElementById('customEndpoint');
const customEndpointGroup = document.getElementById('customEndpointGroup');
const customModelInput = document.getElementById('customModel');
const customModelGroup = document.getElementById('customModelGroup');
const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');

// 更新模型列表
function updateModelList(provider) {
  const models = API_PROVIDERS[provider]?.models || [];
  modelSelect.innerHTML = models
    .map(m => `<option value="${m}">${m}</option>`)
    .join('');
}

// 显示/隐藏自定义配置输入框
function toggleCustomEndpoint(provider) {
  if (provider === 'custom') {
    customEndpointGroup.classList.add('show');
    customModelGroup.classList.add('show');
  } else {
    customEndpointGroup.classList.remove('show');
    customModelGroup.classList.remove('show');
  }
}

// 显示状态消息
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
  setTimeout(() => {
    statusDiv.className = 'status';
  }, 3000);
}

// 加载保存的设置
async function loadSettings() {
  // 从 background.js 获取提供商配置
  const { providers } = await chrome.runtime.sendMessage({ action: 'getProviders' });
  API_PROVIDERS = providers;

  const config = await chrome.storage.sync.get([
    'apiProvider',
    'apiKey',
    'model',
    'customEndpoint',
    'customModel'
  ]);

  if (config.apiProvider) {
    providerSelect.value = config.apiProvider;
    updateModelList(config.apiProvider);
    toggleCustomEndpoint(config.apiProvider);
  }

  if (config.model) {
    modelSelect.value = config.model;
  }

  if (config.apiKey) {
    apiKeyInput.value = config.apiKey;
  }

  if (config.customEndpoint) {
    customEndpointInput.value = config.customEndpoint;
  }

  if (config.customModel) {
    customModelInput.value = config.customModel;
  }
}

// 保存设置
async function saveSettings() {
  const apiProvider = providerSelect.value;
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const customEndpoint = customEndpointInput.value.trim();
  const customModel = customModelInput.value.trim();

  if (!apiKey) {
    showStatus('请输入 API Key', 'error');
    return;
  }

  if (apiProvider === 'custom' && !customEndpoint) {
    showStatus('请输入自定义 API 地址', 'error');
    return;
  }

  // 自定义提供商使用自定义模型名，否则使用下拉选择的模型
  const finalModel = (apiProvider === 'custom' && customModel) ? customModel : model;

  try {
    await chrome.storage.sync.set({
      apiProvider,
      apiKey,
      model: finalModel,
      customEndpoint: apiProvider === 'custom' ? customEndpoint : '',
      customModel: apiProvider === 'custom' ? customModel : ''
    });
    showStatus('设置已保存', 'success');
  } catch (error) {
    showStatus('保存失败: ' + error.message, 'error');
  }
}

// 事件监听
providerSelect.addEventListener('change', (e) => {
  updateModelList(e.target.value);
  toggleCustomEndpoint(e.target.value);
});

saveBtn.addEventListener('click', saveSettings);

// 回车保存
apiKeyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveSettings();
  }
});

// 初始化
loadSettings().catch(err => {
  showStatus('加载设置失败，请刷新', 'error');
});
