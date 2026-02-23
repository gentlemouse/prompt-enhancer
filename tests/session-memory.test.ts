/**
 * 会话记忆测试
 *
 * 覆盖目标：
 * - 初始化和重置
 * - 历史记录推入和滑动窗口
 * - URL 变化检测
 * - 会话超时检测
 * - 更新增强结果
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * session-memory 依赖 window.location，需要模拟浏览器环境。
 * 这里使用模块级 mock 来隔离全局状态。
 */

const mockLocation = { href: 'https://chatgpt.com/chat' };

vi.stubGlobal('window', { location: mockLocation });

const {
  initSessionMemory,
  pushHistory,
  updateLastEnhanced,
  getHistory,
  clearHistory,
  getHistorySize,
} = await import('@content/services/session-memory');

describe('SessionMemory', () => {
  beforeEach(() => {
    mockLocation.href = 'https://chatgpt.com/chat';
    clearHistory();
    initSessionMemory();
  });

  describe('初始化', () => {
    it('初始化后历史为空', () => {
      expect(getHistory()).toEqual([]);
      expect(getHistorySize()).toBe(0);
    });
  });

  describe('pushHistory', () => {
    it('应记录一条历史', () => {
      pushHistory('测试输入');
      expect(getHistorySize()).toBe(1);
      expect(getHistory()[0].text).toBe('测试输入');
    });

    it('应记录多条历史', () => {
      pushHistory('第一条');
      pushHistory('第二条');
      pushHistory('第三条');
      expect(getHistorySize()).toBe(3);
    });

    it('应记录 enhanced 字段', () => {
      pushHistory('输入', '增强结果');
      expect(getHistory()[0].enhanced).toBe('增强结果');
    });

    it('应包含时间戳', () => {
      const before = Date.now();
      pushHistory('测试');
      const after = Date.now();
      const ts = getHistory()[0].timestamp;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe('滑动窗口', () => {
    it('超过窗口大小应裁剪旧记录（默认 5）', () => {
      for (let i = 0; i < 7; i++) {
        pushHistory(`第${i}条`);
      }
      expect(getHistorySize()).toBe(5);
      expect(getHistory()[0].text).toBe('第2条');
      expect(getHistory()[4].text).toBe('第6条');
    });
  });

  describe('URL 变化检测', () => {
    it('URL 变化后应重置历史', () => {
      pushHistory('原始页面的记录');
      expect(getHistorySize()).toBe(1);

      mockLocation.href = 'https://chatgpt.com/chat/new';
      pushHistory('新页面的记录');

      expect(getHistorySize()).toBe(1);
      expect(getHistory()[0].text).toBe('新页面的记录');
    });
  });

  describe('会话超时', () => {
    it('超过 30 分钟应重置历史', () => {
      pushHistory('旧记录');
      expect(getHistorySize()).toBe(1);

      const originalDateNow = Date.now;
      Date.now = vi.fn().mockReturnValue(originalDateNow() + 31 * 60 * 1000);

      const history = getHistory();
      expect(history).toEqual([]);

      Date.now = originalDateNow;
    });

    it('未超时不应重置', () => {
      pushHistory('记录');
      expect(getHistorySize()).toBe(1);

      const originalDateNow = Date.now;
      Date.now = vi.fn().mockReturnValue(originalDateNow() + 10 * 60 * 1000);

      expect(getHistory().length).toBe(1);

      Date.now = originalDateNow;
    });
  });

  describe('updateLastEnhanced', () => {
    it('应更新最后一条记录的增强结果', () => {
      pushHistory('输入1');
      pushHistory('输入2');
      updateLastEnhanced('增强后的输入2');

      const history = getHistory();
      expect(history[1].enhanced).toBe('增强后的输入2');
      expect(history[0].enhanced).toBeUndefined();
    });

    it('空历史时调用不应报错', () => {
      expect(() => updateLastEnhanced('测试')).not.toThrow();
    });
  });

  describe('clearHistory', () => {
    it('应清空所有历史', () => {
      pushHistory('记录1');
      pushHistory('记录2');
      clearHistory();
      expect(getHistorySize()).toBe(0);
      expect(getHistory()).toEqual([]);
    });
  });

  describe('getHistory 返回浅拷贝', () => {
    it('修改返回值不应影响内部状态', () => {
      pushHistory('原始记录');
      const history = getHistory();
      history.push({ text: '注入', timestamp: 0 });
      expect(getHistorySize()).toBe(1);
    });
  });
});
