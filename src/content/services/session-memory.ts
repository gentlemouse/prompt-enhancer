/**
 * 会话记忆服务
 *
 * 在当前页面维护一个滑动窗口，记录最近 N 轮用户输入。
 * 用于判断"新话题"vs"追问"，支持动态策略选择。
 *
 * 生命周期：
 * - 页面加载时创建
 * - 页面关闭/刷新时清空
 * - URL 变化时自动重置
 */

import type { HistoryItem } from '@shared/types';

/** 默认窗口大小 */
const DEFAULT_WINDOW_SIZE = 5;

/** 会话超时时间（30 分钟无操作视为新会话） */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** 会话记忆状态 */
interface SessionMemoryState {
  /** 历史记录队列 */
  items: HistoryItem[];
  /** 窗口大小 */
  windowSize: number;
  /** 当前页面 URL（用于检测页面切换） */
  currentUrl: string;
}

const state: SessionMemoryState = {
  items: [],
  windowSize: DEFAULT_WINDOW_SIZE,
  currentUrl: '',
};

/**
 * 初始化会话记忆
 * 记录当前 URL，后续用于检测页面切换
 */
export const initSessionMemory = (): void => {
  state.currentUrl = window.location.href;
  state.items = [];
};

/**
 * 检查是否需要重置（URL 变化或超时）
 */
const checkAndReset = (): void => {
  const currentUrl = window.location.href;

  // URL 变化 → 重置
  if (currentUrl !== state.currentUrl) {
    state.currentUrl = currentUrl;
    state.items = [];
    return;
  }

  // 超时 → 重置
  if (state.items.length > 0) {
    const lastTimestamp = state.items[state.items.length - 1].timestamp;
    if (Date.now() - lastTimestamp > SESSION_TIMEOUT_MS) {
      state.items = [];
    }
  }
};

/**
 * 记录一条用户输入
 * @param text 用户输入的原始文本
 * @param enhanced 优化后的文本（可选，流式完成后补充）
 */
export const pushHistory = (text: string, enhanced?: string): void => {
  checkAndReset();

  state.items.push({
    text,
    timestamp: Date.now(),
    enhanced,
  });

  // 维护窗口大小
  if (state.items.length > state.windowSize) {
    state.items = state.items.slice(-state.windowSize);
  }
};

/**
 * 更新最后一条记录的增强结果
 * @param enhanced 优化后的文本
 */
export const updateLastEnhanced = (enhanced: string): void => {
  if (state.items.length > 0) {
    state.items[state.items.length - 1].enhanced = enhanced;
  }
};

/**
 * 获取当前会话历史
 * @returns 历史记录数组（浅拷贝）
 */
export const getHistory = (): HistoryItem[] => {
  checkAndReset();
  return [...state.items];
};

/**
 * 清空会话记忆
 */
export const clearHistory = (): void => {
  state.items = [];
};

/**
 * 获取历史记录数量
 */
export const getHistorySize = (): number => {
  return state.items.length;
};
