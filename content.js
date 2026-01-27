// Prompt Enhancer - Content Script

const originalContents = new WeakMap();
let activeInput = null;
let positionLocked = false; // 位置锁定标志

// 获取图标 URL
const ICON_URL = chrome.runtime.getURL('icons/icon24.png');

// 创建按钮
function createEnhanceButton() {
  const button = document.createElement('div');
  button.className = 'prompt-enhancer-btn';

  // 创建图标
  const img = document.createElement('img');
  img.src = ICON_URL;
  img.alt = '✨';
  img.style.cssText = 'width:24px;height:24px;display:block;';
  img.onerror = () => {
    button.innerHTML = '✨';
  };
  button.appendChild(img);
  button.title = '润色 Prompt (Cmd/Ctrl+Shift+E)';

  // 保存图标引用，用于加载状态
  button.iconImg = img;

  // 创建加载动画元素（沙漏）
  const loader = document.createElement('span');
  loader.className = 'prompt-enhancer-loader';
  loader.textContent = '⏳';
  loader.style.display = 'none';
  button.appendChild(loader);

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeInput) handleEnhance(activeInput, button);
  });

  const container = document.createElement('div');
  container.className = 'prompt-enhancer-container';
  container.appendChild(button);
  document.body.appendChild(container);

  return { container, button };
}

// 获取输入框的值
function getInputValue(el) {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value;
  return el.innerText || el.textContent;
}

// 设置输入框的值
function setInputValue(el, value) {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    el.innerText = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
  }
}

// 检查扩展 context 是否有效
function isExtensionContextValid() {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// 处理润色
async function handleEnhance(input, button) {
  // 检查扩展 context 是否有效
  if (!isExtensionContextValid()) {
    showToast('请刷新页面后重试');
    return;
  }

  const originalText = getInputValue(input);

  if (!originalText.trim()) {
    showToast('输入框为空');
    return;
  }

  originalContents.set(input, originalText);

  // 加载状态 - 显示沙漏，隐藏图标
  const img = button.querySelector('img');
  const loader = button.querySelector('.prompt-enhancer-loader');
  if (img) img.style.display = 'none';
  if (loader) loader.style.display = 'block';
  button.classList.add('loading');
  button.style.pointerEvents = 'none';
  showToast('润色中...');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'enhancePrompt',
      prompt: originalText
    });

    if (response?.success) {
      setInputValue(input, response.enhanced);
      showToast('✓ 完成 (Ctrl+Z 可撤回)');
    } else {
      showToast('✗ ' + (response?.error || '失败'));
    }
  } catch (error) {
    // 处理 Extension context invalidated 错误
    if (error.message?.includes('Extension context invalidated')) {
      showToast('扩展已更新，请刷新页面');
    } else {
      showToast('✗ ' + error.message);
    }
  } finally {
    // 恢复图标，隐藏沙漏
    if (img) img.style.display = 'block';
    if (loader) loader.style.display = 'none';
    button.classList.remove('loading');
    button.style.pointerEvents = 'auto';
  }
}


// Toast
function showToast(message) {
  const existing = document.querySelector('.prompt-enhancer-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'prompt-enhancer-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 2000);
}

// 定位按钮 - 首次显示时定位，之后位置锁定不变
function positionButton(container, input, forceUpdate = false) {
  // 如果位置已锁定且不是强制更新，则不改变位置
  if (positionLocked && !forceUpdate) {
    return;
  }

  const rect = input.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 按钮尺寸
  const btnWidth = 32;
  const btnHeight = 32;
  const padding = 4;

  // 计算按钮位置：在输入框的右下角
  let top = rect.bottom - btnHeight - padding;
  let left = rect.right - btnWidth - padding;

  // 确保不超出视口
  top = Math.max(padding, Math.min(top, viewportHeight - btnHeight - padding));
  left = Math.max(padding, Math.min(left, viewportWidth - btnWidth - padding));

  container.style.top = `${top}px`;
  container.style.left = `${left}px`;
  container.style.display = 'flex';

  // 锁定位置
  positionLocked = true;
}

// 支持的 INPUT 类型
const VALID_INPUT_TYPES = ['text', 'search', 'url', 'email', 'tel', ''];

// AI 聊天网站白名单 - 只在这些网站上检测 contenteditable
const AI_CHAT_DOMAINS = [
  'chat.openai.com',
  'chatgpt.com',
  'claude.ai',
  'gemini.google.com',
  'bard.google.com',
  'poe.com',
  'perplexity.ai',
  'chat.mistral.ai',
  'huggingface.co',
  'you.com',
  'phind.com',
  'copilot.microsoft.com',
  'chat.deepseek.com',
  'kimi.moonshot.cn',
  'tongyi.aliyun.com',
  'yiyan.baidu.com',
  'xinghuo.xfyun.cn',
  'chat.zhipu.ai',
  'character.ai',
  'pi.ai',
];

// 检查是否在 AI 聊天网站
function isAIChatSite() {
  const hostname = window.location.hostname;
  return AI_CHAT_DOMAINS.some(domain => hostname.includes(domain));
}

// 验证输入框
function isValidInput(el) {
  if (!el) return false;
  const tag = el.tagName;

  // TEXTAREA 直接通过
  if (tag === 'TEXTAREA') {
    const rect = el.getBoundingClientRect();
    return rect.width >= 30 && rect.height >= 15;
  }

  // INPUT 检查类型
  if (tag === 'INPUT' && VALID_INPUT_TYPES.includes(el.type?.toLowerCase() || '')) {
    const rect = el.getBoundingClientRect();
    return rect.width >= 30 && rect.height >= 15;
  }

  // contenteditable 只在 AI 聊天网站上检测
  if (el.isContentEditable && isAIChatSite()) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 30 || rect.height < 15) return false;
    if (rect.height > window.innerHeight * 0.5) return false; // 排除太大的区域
    return true;
  }

  return false;
}

// 查找可编辑元素
function findEditableElement(el) {
  if (!el) return null;

  // 直接是 TEXTAREA
  if (el.tagName === 'TEXTAREA') return el;

  // 是 INPUT 且类型有效
  if (el.tagName === 'INPUT' && VALID_INPUT_TYPES.includes(el.type?.toLowerCase() || '')) {
    return el;
  }

  // 只在 AI 聊天网站上检测 contenteditable
  if (!isAIChatSite()) return null;

  // 自身是 contenteditable
  if (el.isContentEditable && isValidInput(el)) {
    return el;
  }

  // 向上查找 contenteditable 祖先
  let current = el.parentElement;
  while (current && current !== document.body) {
    if (current.isContentEditable && isValidInput(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

// 显示按钮
function showButton(container, target) {
  if (!target || !isValidInput(target)) return;

  // 如果切换到新的输入框，解锁位置
  if (target !== activeInput) {
    positionLocked = false;
  }

  activeInput = target;
  positionButton(container, target);
  container.style.display = 'flex';
}

// 初始化
function init() {
  const { container, button } = createEnhanceButton();
  container.style.display = 'none';

  // 焦点事件
  document.addEventListener('focusin', (e) => {
    const target = findEditableElement(e.target) || (isValidInput(e.target) ? e.target : null);
    if (target) {
      showButton(container, target);
    }
  }, true);

  // 失焦隐藏 - 增加延时防止竞态
  document.addEventListener('focusout', (e) => {
    setTimeout(() => {
      // 检查焦点是否移到了按钮上
      if (container.matches(':hover') || container.contains(document.activeElement)) {
        return;
      }
      // 检查是否切换到了另一个输入框
      const newFocus = document.activeElement;
      const newTarget = findEditableElement(newFocus);
      if (newTarget && isValidInput(newTarget)) {
        return; // focusin 会处理
      }
      container.style.display = 'none';
    }, 200);
  }, true);

  // 点击事件 - 作为主要检测方式
  document.addEventListener('click', (e) => {
    // 点击按钮本身时不处理
    if (container.contains(e.target)) return;

    const target = findEditableElement(e.target);
    if (target && isValidInput(target)) {
      showButton(container, target);
    }
  }, true);

  // mousedown 事件 - 比 click 更早触发，用于某些特殊输入框
  document.addEventListener('mousedown', (e) => {
    if (container.contains(e.target)) return;

    const target = findEditableElement(e.target);
    if (target && isValidInput(target)) {
      // 延迟一点让元素完成渲染
      setTimeout(() => showButton(container, target), 50);
    }
  }, true);

  // 窗口大小变化时更新位置（强制更新以确保按钮在视口内）
  window.addEventListener('resize', () => {
    if (activeInput && container.style.display !== 'none') {
      positionButton(container, activeInput, true);
    }
  });

  // 快捷键
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // Ctrl+Z / Cmd+Z 撤回
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
      const focused = document.activeElement;
      const target = findEditableElement(focused) || (isValidInput(focused) ? focused : null);
      if (target && originalContents.has(target)) {
        e.preventDefault();
        e.stopPropagation();
        const original = originalContents.get(target);
        setInputValue(target, original);
        originalContents.delete(target);
        showToast('已撤回');
        return;
      }
    }

    // Cmd/Ctrl+Shift+E 润色
    if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      e.stopPropagation();

      let target = activeInput;
      if (!target || !isValidInput(target)) {
        const focused = document.activeElement;
        target = findEditableElement(focused) || (isValidInput(focused) ? focused : null);
        if (target) activeInput = target;
      }

      if (target) {
        handleEnhance(target, button);
      } else {
        showToast('请先点击输入框');
      }
    }
  }, true);

  // input 事件 - 用户开始输入时显示按钮
  document.addEventListener('input', (e) => {
    const target = findEditableElement(e.target);
    if (target && isValidInput(target) && target !== activeInput) {
      showButton(container, target);
    }
  }, true);

  // MutationObserver - 检测动态加载的输入框获得焦点
  const observer = new MutationObserver((mutations) => {
    // 检查当前焦点元素
    const focused = document.activeElement;
    if (focused && focused !== document.body) {
      const target = findEditableElement(focused);
      if (target && isValidInput(target) && target !== activeInput) {
        showButton(container, target);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['contenteditable', 'style', 'class']
  });

  // 右键菜单
  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === 'enhanceSelection') {
      const focused = document.activeElement;
      const target = findEditableElement(focused) || (isValidInput(focused) ? focused : null);
      if (target) {
        activeInput = target;
        handleEnhance(activeInput, button);
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
