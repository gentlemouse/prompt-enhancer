import {
  getQuotaBlockReason,
  type QuotaBlockReason,
} from '@shared/quota-errors';

export type StreamErrorUiAction =
  | { type: 'show_partial_kept' }
  | { type: 'show_quota_prompt'; reason: QuotaBlockReason }
  | { type: 'show_generic_error'; message: string };

/**
 * 归一化流式错误的 UI 行为，避免额度错误被当成普通失败提示。
 */
export const resolveStreamErrorUiAction = (options: {
  hasPartialContent: boolean;
  error: unknown;
  fallbackMessage: string;
}): StreamErrorUiAction => {
  if (options.hasPartialContent) {
    return { type: 'show_partial_kept' };
  }

  const quotaBlockReason = getQuotaBlockReason(options.error);
  if (quotaBlockReason) {
    return { type: 'show_quota_prompt', reason: quotaBlockReason };
  }

  const message =
    typeof options.error === 'string' && options.error.trim()
      ? options.error
      : options.fallbackMessage;

  return { type: 'show_generic_error', message };
};
