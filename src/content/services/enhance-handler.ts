/**
 * 增强处理服务
 * 协调 UI 和后台通信
 */

import type { EditableElement } from './input-detector';
import { getInputValue, setInputValue } from './input-detector';
import { showToast } from '../ui/toast';
import type { ButtonState } from '../ui/button';
import { setButtonLoading } from '../ui/button';

/** 原始内容存储 */
const originalContents = new WeakMap<EditableElement, string>();

/**
 * 检查扩展 context 是否有效
 */
const isExtensionContextValid = (): boolean => {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
};

/**
 * 保存原始内容
 * @param input 输入框元素
 * @param content 原始内容
 */
export const saveOriginalContent = (input: EditableElement, content: string): void => {
  originalContents.set(input, content);
};

/**
 * 处理增强请求（非流式，保留用于回退）
 * @param input 输入框元素
 * @param buttonState 按钮状态
 */
export const handleEnhance = async (
  input: EditableElement,
  buttonState: ButtonState
): Promise<void> => {
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

  // 保存原始内容用于撤回
  originalContents.set(input, originalText);

  // 显示加载状态
  setButtonLoading(buttonState, true);
  showToast('润色中...');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'enhancePrompt',
      prompt: originalText,
    });

    if (response?.success) {
      setInputValue(input, response.enhanced);
      showToast('✓ 完成 (Ctrl+Z 可撤回)');
    } else {
      showToast('✗ ' + (response?.error || '失败'));
    }
  } catch (error) {
    // 处理 Extension context invalidated 错误
    const errorMessage =
      error instanceof Error ? error.message : '未知错误';
    if (errorMessage.includes('Extension context invalidated')) {
      showToast('扩展已更新，请刷新页面');
    } else {
      showToast('✗ ' + errorMessage);
    }
  } finally {
    setButtonLoading(buttonState, false);
  }
};

/**
 * 尝试撤回更改
 * @param input 输入框元素
 * @returns 是否成功撤回
 */
export const tryUndo = (input: EditableElement): boolean => {
  if (originalContents.has(input)) {
    const original = originalContents.get(input)!;
    setInputValue(input, original);
    originalContents.delete(input);
    showToast('已撤回');
    return true;
  }
  return false;
};

/**
 * 检查输入框是否有可撤回的内容
 * @param input 输入框元素
 */
export const hasOriginalContent = (input: EditableElement): boolean => {
  return originalContents.has(input);
};
