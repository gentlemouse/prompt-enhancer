/**
 * 重试工具模块
 * P1-2.6: 实现指数退避重试策略
 */

import { RETRY_CONFIG } from '../constants';

/** 重试选项 */
export interface RetryOptions {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 初始延迟（毫秒） */
  initialDelay?: number;
  /** 最大延迟（毫秒） */
  maxDelay?: number;
  /** 退避倍数 */
  backoffMultiplier?: number;
  /** 是否应该重试的判断函数 */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** 重试前的回调 */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/** 默认的可重试错误判断 */
const defaultShouldRetry = (error: Error, _attempt: number): boolean => {
  const message = error.message.toLowerCase();
  // 网络错误、超时、服务器错误应该重试
  const retryableErrors = [
    'network',
    'timeout',
    'econnreset',
    'econnrefused',
    'socket hang up',
    '429', // Rate limit
    '500',
    '502',
    '503',
    '504',
    'internal server error',
    'bad gateway',
    'service unavailable',
    'gateway timeout',
  ];
  return retryableErrors.some(e => message.includes(e));
};

/**
 * 计算指数退避延迟
 * @param attempt 当前尝试次数（从 1 开始）
 * @param options 重试选项
 * @returns 延迟时间（毫秒）
 */
const calculateDelay = (attempt: number, options: Required<RetryOptions>): number => {
  const { initialDelay, maxDelay, backoffMultiplier } = options;
  // 指数退避：delay = initialDelay * (multiplier ^ (attempt - 1))
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  // 添加随机抖动（±25%）避免雷同
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, maxDelay);
};

/**
 * 延迟函数
 * @param ms 延迟毫秒数
 * @returns Promise that resolves after the delay
 */
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * 带指数退避的重试包装器
 * @param fn 要执行的异步函数
 * @param options 重试选项
 * @returns 函数执行结果
 * @throws 如果所有重试都失败，抛出最后一个错误
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts: Required<RetryOptions> = {
    maxRetries: options.maxRetries ?? RETRY_CONFIG.maxRetries,
    initialDelay: options.initialDelay ?? RETRY_CONFIG.initialDelay,
    maxDelay: options.maxDelay ?? RETRY_CONFIG.maxDelay,
    backoffMultiplier: options.backoffMultiplier ?? RETRY_CONFIG.backoffMultiplier,
    shouldRetry: options.shouldRetry ?? defaultShouldRetry,
    onRetry: options.onRetry ?? (() => {}),
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最后一次尝试或不应该重试的错误
      if (attempt > opts.maxRetries || !opts.shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // 计算延迟并等待
      const delay = calculateDelay(attempt, opts);
      opts.onRetry(lastError, attempt, delay);
      await sleep(delay);
    }
  }

  // 理论上不会到达这里，但 TypeScript 需要
  throw lastError ?? new Error('Retry failed');
}

/**
 * 创建带超时的 fetch
 * @param url 请求 URL
 * @param options fetch 选项
 * @param timeout 超时时间（毫秒）
 * @returns Response
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
