import { describe, expect, it } from 'vitest';
import { resolveStreamErrorUiAction } from '@content/services/stream-error';

describe('resolveStreamErrorUiAction', () => {
  it('keeps partial content when stream already produced text', () => {
    expect(
      resolveStreamErrorUiAction({
        hasPartialContent: true,
        error: 'FREE_QUOTA_EXHAUSTED',
        fallbackMessage: 'Unknown error',
      })
    ).toEqual({ type: 'show_partial_kept' });
  });

  it('maps free quota errors to trial prompt action', () => {
    expect(
      resolveStreamErrorUiAction({
        hasPartialContent: false,
        error: 'FREE_QUOTA_EXHAUSTED',
        fallbackMessage: 'Unknown error',
      })
    ).toEqual({
      type: 'show_quota_prompt',
      reason: 'free_quota_exhausted',
    });
  });

  it('falls back to a generic error for non-quota failures', () => {
    expect(
      resolveStreamErrorUiAction({
        hasPartialContent: false,
        error: '',
        fallbackMessage: 'Unknown error',
      })
    ).toEqual({
      type: 'show_generic_error',
      message: 'Unknown error',
    });
  });
});
