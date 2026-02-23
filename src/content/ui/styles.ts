/**
 * 内联样式模块
 * P2-3.3: 用于 Shadow DOM 内的样式
 */

/**
 * 获取所有 UI 样式
 */
export const getStyles = (): string => `
/* 按钮容器 - 固定定位，始终在可视区域内 */
.prompt-enhancer-container {
  position: fixed;
  z-index: 2147483647 !important;
  display: flex;
  gap: 4px;
  pointer-events: auto;
  isolation: isolate;
}

/* 按钮基础样式 - 纯图标无边框 */
.prompt-enhancer-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: none;
  transition: all 0.2s ease;
  user-select: none;
  opacity: 0.7;
}

/* Hover：克制地提亮 */
.prompt-enhancer-btn:hover {
  opacity: 1;
  transform: scale(1.05);
}

.prompt-enhancer-btn:active {
  transform: scale(0.92);
}

/* 生成中：魔法棒施法效果 */
.prompt-enhancer-btn.generating {
  opacity: 1;
  pointer-events: none;
  position: relative;
}

/* 图标微浮动 + 多层金色光晕 */
.prompt-enhancer-btn.generating img {
  animation: wand-float 2.4s ease-in-out infinite, wand-glow 1.6s ease-in-out infinite;
}

/* 轻微浮动：营造"悬浮施法"感 */
@keyframes wand-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

/* 金色光晕脉冲：从内层暖金到外层柔光 */
@keyframes wand-glow {
  0%, 100% {
    filter:
      drop-shadow(0 0 3px rgba(255, 200, 60, 0.5))
      drop-shadow(0 0 6px rgba(255, 170, 30, 0.3));
  }
  50% {
    filter:
      drop-shadow(0 0 5px rgba(255, 215, 80, 0.85))
      drop-shadow(0 0 12px rgba(255, 180, 40, 0.55))
      drop-shadow(0 0 22px rgba(255, 150, 20, 0.25));
  }
}

/* 星尘粒子：按钮伪元素 */
.prompt-enhancer-btn.generating::before,
.prompt-enhancer-btn.generating::after {
  content: '';
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 220, 100, 0.9), rgba(255, 180, 50, 0) 70%);
  pointer-events: none;
}

.prompt-enhancer-btn.generating::before {
  top: 2px;
  right: 0px;
  animation: sparkle-a 1.8s ease-in-out infinite;
}

.prompt-enhancer-btn.generating::after {
  top: 6px;
  right: -2px;
  animation: sparkle-b 2.2s ease-in-out infinite 0.4s;
}

@keyframes sparkle-a {
  0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
  20% { opacity: 1; transform: translate(-4px, -6px) scale(1); }
  60% { opacity: 0.6; transform: translate(-8px, -10px) scale(0.8); }
  100% { opacity: 0; transform: translate(-12px, -14px) scale(0.3); }
}

@keyframes sparkle-b {
  0% { opacity: 0; transform: translate(0, 0) scale(0.4); }
  25% { opacity: 0.9; transform: translate(3px, -7px) scale(1.1); }
  65% { opacity: 0.4; transform: translate(5px, -12px) scale(0.7); }
  100% { opacity: 0; transform: translate(6px, -16px) scale(0.2); }
}

/* 暗色页面：通过 JS 检测实际背景色后添加 .on-dark 类 */
.prompt-enhancer-btn.on-dark img {
  filter: invert(1);
}

.prompt-enhancer-btn.on-dark.generating img {
  animation: wand-float 2.4s ease-in-out infinite, wand-glow-dark 1.6s ease-in-out infinite;
}

@keyframes wand-glow-dark {
  0%, 100% {
    filter:
      invert(1)
      drop-shadow(0 0 3px rgba(255, 200, 60, 0.5))
      drop-shadow(0 0 6px rgba(255, 170, 30, 0.3));
  }
  50% {
    filter:
      invert(1)
      drop-shadow(0 0 5px rgba(255, 215, 80, 0.85))
      drop-shadow(0 0 12px rgba(255, 180, 40, 0.55))
      drop-shadow(0 0 22px rgba(255, 150, 20, 0.25));
  }
}

/* P2-3.6: 焦点样式（无障碍） */
.prompt-enhancer-btn:focus {
  outline: 2px solid #4a90d9;
  outline-offset: 2px;
  opacity: 1;
}

.prompt-enhancer-btn:focus:not(:focus-visible) {
  outline: none;
}

/* 加载状态 */
.prompt-enhancer-btn.loading {
  opacity: 1;
  pointer-events: none;
}

/* P2-3.2: 流式输出时的脉动动画 */
.prompt-enhancer-btn.streaming {
  animation: streaming-pulse 1.5s ease-in-out infinite;
}

@keyframes streaming-pulse {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

.prompt-enhancer-loader {
  font-size: 20px;
  display: inline-block;
  animation: hourglass-flip 2.4s ease-in-out infinite;
}

/* 沙漏翻转动画 */
@keyframes hourglass-flip {
  0% { transform: rotate(0deg); }
  20% { transform: rotate(180deg); }
  50% { transform: rotate(180deg); }
  70% { transform: rotate(360deg); }
  100% { transform: rotate(360deg); }
}

/* Toast 提示 */
.prompt-enhancer-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(60px);
  background: rgba(30, 30, 30, 0.92);
  color: white;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 2147483647;
  opacity: 0;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}

.prompt-enhancer-toast.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

/* P2-3.2: 流式输出预览面板 */
.prompt-enhancer-preview {
  position: fixed;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 400px;
  max-height: 300px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 2147483647;
  pointer-events: auto;
}

.prompt-enhancer-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  font-size: 12px;
  font-weight: 500;
  color: #666;
}

.prompt-enhancer-preview-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.prompt-enhancer-preview-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4caf50;
  animation: dot-pulse 1s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.prompt-enhancer-preview-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #999;
  padding: 0 4px;
  line-height: 1;
}

.prompt-enhancer-preview-close:hover {
  color: #333;
}

.prompt-enhancer-preview-content {
  padding: 12px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.5;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 打字机光标 */
.prompt-enhancer-preview-content::after {
  content: '▋';
  animation: cursor-blink 1s step-end infinite;
  color: #4a90d9;
}

.prompt-enhancer-preview-content.done::after {
  display: none;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.prompt-enhancer-preview-actions {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-top: 1px solid #e0e0e0;
}

.prompt-enhancer-preview-btn {
  flex: 1;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.prompt-enhancer-preview-btn.primary {
  background: #1a1a1a;
  color: white;
}

.prompt-enhancer-preview-btn.primary:hover {
  background: #333;
}

.prompt-enhancer-preview-btn.secondary {
  background: #e0e0e0;
  color: #333;
}

.prompt-enhancer-preview-btn.secondary:hover {
  background: #d0d0d0;
}

/* P2-3.6: 无障碍焦点样式 */
.prompt-enhancer-preview-btn:focus {
  outline: 2px solid #4a90d9;
  outline-offset: 2px;
}

.prompt-enhancer-preview-btn:focus:not(:focus-visible) {
  outline: none;
}

/* 试用耗尽提示 */
.prompt-enhancer-trial-expired {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(80px);
  background: rgba(30, 30, 30, 0.96);
  color: white;
  padding: 16px 20px;
  border-radius: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 2147483647;
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  max-width: 340px;
  text-align: center;
}

.prompt-enhancer-trial-expired.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

.prompt-enhancer-trial-expired-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.prompt-enhancer-trial-expired-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}

.prompt-enhancer-trial-expired-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 14px;
  line-height: 1.4;
}

.prompt-enhancer-trial-expired-btn {
  display: inline-block;
  padding: 8px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.prompt-enhancer-trial-expired-btn:hover {
  background: #2563eb;
}

.prompt-enhancer-trial-expired-close {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 16px;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
}

.prompt-enhancer-trial-expired-close:hover {
  color: rgba(255, 255, 255, 0.8);
}

/* 试用计数 Toast（带次要信息的扩展样式） */
.prompt-enhancer-toast-trial {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.prompt-enhancer-toast-trial-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.prompt-enhancer-toast-trial-hint.warning {
  color: #fbbf24;
}

.prompt-enhancer-toast-trial-link {
  color: #60a5fa;
  cursor: pointer;
  text-decoration: underline;
}
`;
