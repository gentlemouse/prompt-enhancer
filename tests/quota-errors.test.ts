import { describe, expect, it } from 'vitest';
import {
  FREE_QUOTA_EXHAUSTED_ERROR,
  TRIAL_EXPIRED_ERROR,
  getQuotaBlockReason,
  normalizeProxyError,
} from '../src/shared/quota-errors';

describe('quota errors', () => {
  it('maps proxy 429 responses to free quota exhausted', () => {
    const error = normalizeProxyError(
      429,
      JSON.stringify({ error: { message: 'quota exhausted' } })
    );

    expect(error.message).toBe(FREE_QUOTA_EXHAUSTED_ERROR);
  });

  it('detects free quota exhausted from normalized error code', () => {
    expect(getQuotaBlockReason(FREE_QUOTA_EXHAUSTED_ERROR)).toBe(
      'free_quota_exhausted'
    );
  });

  it('detects trial expired from error code', () => {
    expect(getQuotaBlockReason(TRIAL_EXPIRED_ERROR)).toBe('trial_expired');
  });

  it('keeps regular proxy errors untouched', () => {
    const error = normalizeProxyError(
      500,
      JSON.stringify({ error: { message: 'internal server error' } })
    );

    expect(error.message).toBe('internal server error');
  });
});
