/**
 * 增强处理服务
 * 协调 UI 和后台通信
 */

import type { EditableElement } from './input-detector';
import { getInputValue, setInputValue } from './input-detector';
import { showToast } from '../ui/toast';
import { t } from '@shared/i18n';
import type { ButtonState } from '../ui/button';
import { setButtonLoading } from '../ui/button';
import { getQuotaBlockReason, PROXY_NETWORK_ERROR } from '@shared/quota-errors';
import { showTrialExpiredPrompt } from '../ui/trial-prompt';

/** 原始内容存储 */
const originalContents = new WeakMap<EditableElement, string>();

/**
 * 将内部错误码转换为用户可读提示
 */
const toUserFacingErrorMessage = (error: unknown): string => {
  if (error === PROXY_NETWORK_ERROR) {
    return t('toastProxyNetworkBlocked');
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return t('toastRequestFailed');
};

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
export const saveOriginalContent = (
  input: EditableElement,
  content: string
): void => {
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
    showToast(t('toastRefreshPage'));
    return;
  }

  const originalText = getInputValue(input);

  if (!originalText.trim()) {
    showToast(t('toastEmpty'));
    return;
  }

  // 保存原始内容用于撤回
  originalContents.set(input, originalText);

  // 显示加载状态
  setButtonLoading(buttonState, true);
  showToast({
    message: t('toastEnhancing'),
    anchor: input,
  });

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'enhancePrompt',
      prompt: originalText,
    });

    if (response?.success) {
      setInputValue(input, response.enhanced);
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      showToast({
        message: isMac ? t('toastDoneMac') : t('toastDone'),
        duration: 3600,
        anchor: input,
      });
    } else {
      const quotaBlockReason = getQuotaBlockReason(response?.error);
      if (quotaBlockReason) {
        showTrialExpiredPrompt(quotaBlockReason);
      } else {
        showToast('✗ ' + toUserFacingErrorMessage(response?.error));
      }
    }
  } catch (error) {
    // 处理 Extension context invalidated 错误
    const errorMessage =
      error instanceof Error ? error.message : t('statusUnknownError');
    const quotaBlockReason = getQuotaBlockReason(errorMessage);
    if (quotaBlockReason) {
      showTrialExpiredPrompt(quotaBlockReason);
    } else if (errorMessage.includes('Extension context invalidated')) {
      showToast(t('toastRefreshPage'));
    } else {
      showToast('✗ ' + toUserFacingErrorMessage(errorMessage));
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
    showToast(t('toastUndone'));
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
