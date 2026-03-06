/**
 * 免费额度相关错误码与归一化工具
 */

export const TRIAL_EXPIRED_ERROR = 'TRIAL_EXPIRED';
export const FREE_QUOTA_EXHAUSTED_ERROR = 'FREE_QUOTA_EXHAUSTED';

export type QuotaBlockReason = 'trial_expired' | 'free_quota_exhausted';

const FREE_QUOTA_PATTERNS = [
  'insufficient_quota',
  'quota exhausted',
  'quota exceeded',
  'exceeded your current quota',
  'credit balance is too low',
  'billing',
  '余额不足',
  '额度不足',
  '免费额度',
  '试用额度',
  '用完',
  '耗尽',
];

const extractErrorMessage = (body: string): string => {
  if (!body) return '';

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string } | string;
      message?: string;
    };

    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {
    // 非 JSON 响应按原始文本处理
  }

  return body;
};

const toMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return String(error);
};

export const isTrialExpiredError = (error: unknown): boolean =>
  toMessage(error).includes(TRIAL_EXPIRED_ERROR);

export const isFreeQuotaExhaustedError = (error: unknown): boolean => {
  const message = toMessage(error);

  if (message.includes(FREE_QUOTA_EXHAUSTED_ERROR)) {
    return true;
  }

  const normalized = message.toLowerCase();
  return FREE_QUOTA_PATTERNS.some(pattern => normalized.includes(pattern));
};

export const getQuotaBlockReason = (
  error: unknown
): QuotaBlockReason | null => {
  if (isTrialExpiredError(error)) return 'trial_expired';
  if (isFreeQuotaExhaustedError(error)) return 'free_quota_exhausted';
  return null;
};

export const normalizeProxyError = (status: number, body: string): Error => {
  const message = extractErrorMessage(body).trim();
  const normalized = message.toLowerCase();

  if (
    status === 429 ||
    FREE_QUOTA_PATTERNS.some(pattern => normalized.includes(pattern))
  ) {
    return new Error(FREE_QUOTA_EXHAUSTED_ERROR);
  }

  return new Error(message || `API 调用失败: ${status}`);
};
