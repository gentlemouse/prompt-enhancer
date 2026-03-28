/**
 * 重试工具测试
 *
 * 覆盖目标：
 * - 成功场景（首次成功）
 * - 重试后成功
 * - 重试全部失败
 * - 指数退避延迟计算
 * - 不可重试错误直接抛出
 * - 超时 fetch
 */

import { describe, it, expect, vi } from 'vitest';
import { withRetry, fetchWithTimeout, isAbortError } from '@shared/utils/retry';

describe('withRetry', () => {
  it('首次成功应直接返回', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('首次失败后重试成功', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, {
      initialDelay: 1,
      maxDelay: 10,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('所有重试都失败应抛出最后一个错误', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        initialDelay: 1,
        maxDelay: 10,
      })
    ).rejects.toThrow('network error');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('不可重试的错误应直接抛出，不重试', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('invalid api key'));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        initialDelay: 1,
      })
    ).rejects.toThrow('invalid api key');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('自定义 shouldRetry 应被尊重', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('custom error'));
    const shouldRetry = vi.fn().mockReturnValue(true);

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        initialDelay: 1,
        maxDelay: 10,
        shouldRetry,
      })
    ).rejects.toThrow('custom error');

    expect(shouldRetry).toHaveBeenCalled();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('onRetry 回调应被调用', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('500 server error'))
      .mockResolvedValue('ok');

    const onRetry = vi.fn();

    await withRetry(fn, {
      initialDelay: 1,
      maxDelay: 10,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.any(Error),
      1,
      expect.any(Number)
    );
  });

  it('非 Error 对象应被包装', async () => {
    const fn = vi.fn().mockRejectedValue('string error');

    await expect(
      withRetry(fn, {
        maxRetries: 0,
        initialDelay: 1,
      })
    ).rejects.toThrow('string error');
  });

  it('429 rate limit 应触发重试', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, {
      initialDelay: 1,
      maxDelay: 10,
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('503 service unavailable 应触发重试', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('503 service unavailable'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, {
      initialDelay: 1,
      maxDelay: 10,
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('AbortError 不应触发重试', async () => {
    const fn = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        initialDelay: 1,
      })
    ).rejects.toThrow('Aborted');

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('fetchWithTimeout', () => {
  it('应在超时后中止请求', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('aborted')), 100);
        })
    );

    await expect(fetchWithTimeout('https://example.com', {}, 10)).rejects.toThrow();

    globalThis.fetch = originalFetch;
  });

  it('正常响应应直接返回', async () => {
    const mockResponse = new Response('ok');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout('https://example.com', {}, 5000);
    expect(result).toBe(mockResponse);

    globalThis.fetch = originalFetch;
  });

  it('应响应外部 AbortSignal 中止请求', async () => {
    const controller = new AbortController();
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, options?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = options?.signal as AbortSignal | undefined;
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          );
        })
    );
    globalThis.fetch = fetchMock;

    const request = fetchWithTimeout(
      'https://example.com',
      {},
      5000,
      controller.signal
    );
    controller.abort();

    await expect(request).rejects.toSatisfy(isAbortError);

    globalThis.fetch = originalFetch;
  });
});
