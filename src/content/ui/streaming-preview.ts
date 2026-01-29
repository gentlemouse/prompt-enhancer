/**
 * 流式输出预览面板
 * P2-3.2: 显示实时的打字机效果
 */

import { getShadowHost } from './shadow-host';

/** 预览面板状态 */
interface PreviewState {
  container: HTMLElement | null;
  content: HTMLElement | null;
  text: string;
  onApply: ((text: string) => void) | null;
  onCancel: (() => void) | null;
}

const state: PreviewState = {
  container: null,
  content: null,
  text: '',
  onApply: null,
  onCancel: null,
};

/**
 * 创建预览面板
 */
const createPreviewPanel = (): HTMLElement => {
  const { root } = getShadowHost();

  const container = document.createElement('div');
  container.className = 'prompt-enhancer-preview';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-label', '优化预览');
  container.setAttribute('aria-live', 'polite');

  container.innerHTML = `
    <div class="prompt-enhancer-preview-header">
      <div class="prompt-enhancer-preview-status">
        <div class="prompt-enhancer-preview-dot"></div>
        <span>正在优化...</span>
      </div>
      <button class="prompt-enhancer-preview-close" aria-label="关闭" tabindex="0">&times;</button>
    </div>
    <div class="prompt-enhancer-preview-content" tabindex="0"></div>
    <div class="prompt-enhancer-preview-actions">
      <button class="prompt-enhancer-preview-btn secondary" tabindex="0">取消</button>
      <button class="prompt-enhancer-preview-btn primary" tabindex="0" disabled>应用</button>
    </div>
  `;

  // 绑定事件
  const closeBtn = container.querySelector('.prompt-enhancer-preview-close') as HTMLButtonElement;
  const cancelBtn = container.querySelector('.prompt-enhancer-preview-btn.secondary') as HTMLButtonElement;
  const applyBtn = container.querySelector('.prompt-enhancer-preview-btn.primary') as HTMLButtonElement;

  closeBtn.addEventListener('click', () => hidePreview(true));
  cancelBtn.addEventListener('click', () => hidePreview(true));
  applyBtn.addEventListener('click', () => {
    if (state.onApply && state.text) {
      state.onApply(state.text);
    }
    hidePreview(false);
  });

  // P2-3.6: 键盘导航支持
  container.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hidePreview(true);
    } else if (e.key === 'Enter' && !applyBtn.disabled) {
      if (state.onApply && state.text) {
        state.onApply(state.text);
      }
      hidePreview(false);
    }
  });

  root.appendChild(container);
  return container;
};

/**
 * 定位预览面板
 */
const positionPreview = (container: HTMLElement, input: HTMLElement): void => {
  const rect = input.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const panelWidth = 400;
  const panelHeight = 300;
  const padding = 10;

  // 优先显示在输入框下方
  let top = rect.bottom + padding;
  let left = rect.left;

  // 如果下方空间不足，显示在上方
  if (top + panelHeight > viewportHeight - padding) {
    top = rect.top - panelHeight - padding;
  }

  // 确保不超出视口
  if (top < padding) top = padding;
  if (left + panelWidth > viewportWidth - padding) {
    left = viewportWidth - panelWidth - padding;
  }
  if (left < padding) left = padding;

  container.style.top = `${top}px`;
  container.style.left = `${left}px`;
};

/**
 * 显示预览面板
 */
export const showPreview = (
  input: HTMLElement,
  onApply: (text: string) => void,
  onCancel: () => void
): void => {
  // 创建或获取面板
  if (!state.container) {
    state.container = createPreviewPanel();
  }

  state.content = state.container.querySelector('.prompt-enhancer-preview-content');
  state.text = '';
  state.onApply = onApply;
  state.onCancel = onCancel;

  // 重置状态
  if (state.content) {
    state.content.textContent = '';
    state.content.classList.remove('done');
  }

  const statusText = state.container.querySelector('.prompt-enhancer-preview-status span');
  if (statusText) statusText.textContent = '正在优化...';

  const dot = state.container.querySelector('.prompt-enhancer-preview-dot') as HTMLElement;
  if (dot) dot.style.display = 'block';

  const applyBtn = state.container.querySelector('.prompt-enhancer-preview-btn.primary') as HTMLButtonElement;
  if (applyBtn) applyBtn.disabled = true;

  // 定位并显示
  positionPreview(state.container, input);
  state.container.style.display = 'flex';

  // 聚焦到内容区域
  state.content?.focus();
};

/**
 * 追加文本（流式）
 */
export const appendText = (chunk: string): void => {
  if (state.content && chunk) {
    state.text += chunk;
    state.content.textContent = state.text;

    // 自动滚动到底部
    state.content.scrollTop = state.content.scrollHeight;
  }
};

/**
 * 标记完成
 */
export const markComplete = (): void => {
  if (state.container) {
    const statusText = state.container.querySelector('.prompt-enhancer-preview-status span');
    if (statusText) statusText.textContent = '优化完成';

    const dot = state.container.querySelector('.prompt-enhancer-preview-dot') as HTMLElement;
    if (dot) dot.style.display = 'none';

    const applyBtn = state.container.querySelector('.prompt-enhancer-preview-btn.primary') as HTMLButtonElement;
    if (applyBtn) applyBtn.disabled = false;

    if (state.content) {
      state.content.classList.add('done');
    }

    // 聚焦到应用按钮
    applyBtn?.focus();
  }
};

/**
 * 显示错误
 */
export const showError = (error: string): void => {
  if (state.container) {
    const statusText = state.container.querySelector('.prompt-enhancer-preview-status span') as HTMLElement | null;
    if (statusText) {
      statusText.textContent = `错误: ${error}`;
      statusText.style.color = '#e53935';
    }

    const dot = state.container.querySelector('.prompt-enhancer-preview-dot') as HTMLElement | null;
    if (dot) dot.style.display = 'none';

    if (state.content) {
      state.content.classList.add('done');
    }
  }
};

/**
 * 隐藏预览面板
 */
export const hidePreview = (cancelled: boolean): void => {
  if (state.container) {
    state.container.style.display = 'none';
  }

  if (cancelled && state.onCancel) {
    state.onCancel();
  }

  state.text = '';
  state.onApply = null;
  state.onCancel = null;
};

/**
 * 检查预览面板是否可见
 */
export const isPreviewVisible = (): boolean => {
  return (state.container as HTMLElement | null)?.style.display === 'flex';
};

/**
 * 获取当前文本
 */
export const getCurrentText = (): string => {
  return state.text;
};
