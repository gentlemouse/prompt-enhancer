/**
 * 内联样式模块
 * P2-3.3: 用于 Shadow DOM 内的样式
 * Premium Design System: Inter · 靛青→紫罗兰品牌渐变 · 精调曲线
 */

/**
 * 获取所有 UI 样式
 */
export const getStyles = (): string => `
/* ─── 字体引入 ─── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* ─── 按钮容器 ─── */
.prompt-enhancer-container {
  position: fixed;
  z-index: 2147483647 !important;
  display: flex;
  gap: 4px;
  pointer-events: none;
  isolation: isolate;
}

/* ─── 按钮基础样式 — Premium 渐变底座 + 白色 SVG ─── */
.prompt-enhancer-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  pointer-events: auto;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  /* 展开时使用快速响应曲线 */
  transition:
    width 0.15s ease-out,
    height 0.15s ease-out,
    border-radius 0.15s ease-out,
    opacity 0.15s ease-out,
    transform 0.15s ease-out,
    box-shadow 0.15s ease-out,
    background 0.15s ease-out,
    clip-path 0.15s ease-out;
  user-select: none;
  opacity: 0.55;
  transform: scale(0.92);
  /* 确保 clip-path 过渡时不裁掉内容 */
  overflow: visible;
  position: relative;
}

.prompt-enhancer-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
}

/* ─── 收起态：迷你星芒 ✦ ─── */
.prompt-enhancer-btn.collapsed {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: #7c3aed;
  box-shadow: 0 0 6px rgba(124, 58, 237, 0.4);
  opacity: 0.8;
  transform: scale(1);
  /* 四芒星裁切形状 */
  clip-path: polygon(
    50% 0%,
    62% 38%,
    100% 50%,
    62% 62%,
    50% 100%,
    38% 62%,
    0% 50%,
    38% 38%
  );
  /* 收起时使用柔和退让曲线 */
  transition:
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    clip-path 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: sparkle-breathe 3s ease-in-out infinite;
}

/* 收起态隐藏 SVG 图标 */
.prompt-enhancer-btn.collapsed .prompt-enhancer-icon {
  opacity: 0;
  transform: scale(0.3);
}

/* 收起态呼吸动画 */
@keyframes sparkle-breathe {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* ─── 悬停：从收起态展开，或从含蓄态亮起 ─── */
.prompt-enhancer-btn:hover,
.prompt-enhancer-btn.collapsed:hover {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  opacity: 1;
  transform: scale(1);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.45);
  clip-path: none;
  animation: none;
  /* 展开时使用灵敏曲线 */
  transition:
    width 0.15s ease-out,
    height 0.15s ease-out,
    border-radius 0.15s ease-out,
    opacity 0.15s ease-out,
    transform 0.15s ease-out,
    box-shadow 0.15s ease-out,
    background 0.15s ease-out,
    clip-path 0.15s ease-out;
}

/* 悬停收起态时恢复图标可见 */
.prompt-enhancer-btn.collapsed:hover .prompt-enhancer-icon {
  opacity: 1;
  transform: scale(1);
}

.prompt-enhancer-btn:active {
  transform: scale(0.9);
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.25);
}

/* ─── 生成中：魔法棒施法效果 ─── */
.prompt-enhancer-btn.generating {
  opacity: 1;
  pointer-events: none;
  position: relative;
  clip-path: none;
  animation: btn-glow 1.8s ease-in-out infinite;
}

/* 图标微浮动 + 多层品牌色光晕 */
.prompt-enhancer-btn.generating .prompt-enhancer-icon {
  animation: wand-float 2.4s ease-in-out infinite;
  opacity: 1;
  transform: scale(1);
}

/* 轻微浮动：营造"悬浮施法"感 */
@keyframes wand-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

/* 生成中：按钮整体光晕脉冲 */
@keyframes btn-glow {
  0%, 100% {
    box-shadow:
      0 2px 8px rgba(99, 102, 241, 0.35),
      0 0 0 0 rgba(139, 92, 246, 0);
  }
  50% {
    box-shadow:
      0 4px 16px rgba(99, 102, 241, 0.5),
      0 0 20px 4px rgba(139, 92, 246, 0.2);
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
  background: radial-gradient(circle, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0) 70%);
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

/* P2-3.6: 焦点样式（无障碍） */
.prompt-enhancer-btn:focus {
  outline: 2px solid #6366f1;
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
  clip-path: none;
}

.prompt-enhancer-btn.generating.streaming {
  animation:
    btn-glow 1.8s ease-in-out infinite,
    streaming-pulse 1.5s ease-in-out infinite;
}

@keyframes streaming-pulse {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

/* ─── 引导气泡 (Onboarding Tooltip) ─── */
.prompt-enhancer-onboarding {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  max-width: min(320px, calc(100vw - 16px));
  background: rgba(17, 17, 19, 0.92);
  color: white;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  white-space: normal;
  pointer-events: auto;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08),
    0 4px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transform: translateY(6px);
  animation: onboarding-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: 0.5s;
  letter-spacing: -0.1px;
}

/* 气泡尾巴（小三角） */
.prompt-enhancer-onboarding::after {
  content: '';
  position: absolute;
  bottom: -5px;
  right: 14px;
  width: 10px;
  height: 10px;
  background: rgba(17, 17, 19, 0.92);
  transform: rotate(45deg);
  border-radius: 0 0 2px 0;
}

.prompt-enhancer-onboarding-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.prompt-enhancer-onboarding-text {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
}

.prompt-enhancer-onboarding-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.35);
  font-size: 14px;
  cursor: pointer;
  padding: 2px;
  line-height: 1;
  flex-shrink: 0;
  border-radius: 4px;
  transition: all 0.15s;
  margin-left: 4px;
}

.prompt-enhancer-onboarding-close:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.08);
}

.prompt-enhancer-onboarding-close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.45);
}

@keyframes onboarding-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .prompt-enhancer-btn,
  .prompt-enhancer-icon,
  .prompt-enhancer-loader,
  .prompt-enhancer-onboarding,
  .prompt-enhancer-toast,
  .prompt-enhancer-btn::before,
  .prompt-enhancer-btn::after {
    animation: none !important;
    transition: none !important;
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

/* ─── Toast 提示 — Glassmorphism ─── */
.prompt-enhancer-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(60px);
  background: rgba(17, 17, 19, 0.88);
  color: white;
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 13px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 2147483647;
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08),
    0 4px 16px rgba(0, 0, 0, 0.3);
  letter-spacing: -0.1px;
}

.prompt-enhancer-toast.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

/* ─── 流式输出预览面板 — Premium Card ─── */
.prompt-enhancer-preview {
  position: fixed;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.04),
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 24px 48px rgba(0, 0, 0, 0.06);
  max-width: 420px;
  max-height: 320px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 2147483647;
  pointer-events: auto;
}

.prompt-enhancer-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #fcfcfd;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 12px;
  font-weight: 500;
  color: #62636c;
}

.prompt-enhancer-preview-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.prompt-enhancer-preview-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  animation: dot-pulse 1.2s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.prompt-enhancer-preview-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #8b8d98;
  padding: 0 4px;
  line-height: 1;
  border-radius: 4px;
  transition: all 0.15s;
}

.prompt-enhancer-preview-close:hover {
  color: #1e1f24;
  background: rgba(0, 0, 0, 0.05);
}

.prompt-enhancer-preview-content {
  padding: 14px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.6;
  color: #1e1f24;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 打字机光标 — 品牌色 */
.prompt-enhancer-preview-content::after {
  content: '▋';
  animation: cursor-blink 1s step-end infinite;
  color: #6366f1;
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
  padding: 10px 14px;
  background: #fcfcfd;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.prompt-enhancer-preview-btn {
  flex: 1;
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.prompt-enhancer-preview-btn.primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  box-shadow: 0 1px 3px rgba(99, 102, 241, 0.25);
}

.prompt-enhancer-preview-btn.primary:hover {
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
  transform: translateY(-0.5px);
}

.prompt-enhancer-preview-btn.secondary {
  background: #f0f0f3;
  color: #62636c;
}

.prompt-enhancer-preview-btn.secondary:hover {
  background: #e8e8ec;
  color: #1e1f24;
}

/* P2-3.6: 无障碍焦点样式 */
.prompt-enhancer-preview-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

.prompt-enhancer-preview-btn:focus:not(:focus-visible) {
  outline: none;
}

/* ─── 试用耗尽提示 — Glassmorphism ─── */
.prompt-enhancer-trial-expired {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(80px);
  background: rgba(17, 17, 19, 0.92);
  color: white;
  padding: 20px 24px;
  border-radius: 16px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 2147483647;
  opacity: 0;
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08),
    0 8px 32px rgba(0, 0, 0, 0.35);
  max-width: 360px;
  text-align: center;
}

.prompt-enhancer-trial-expired.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

.prompt-enhancer-trial-expired-icon {
  font-size: 28px;
  margin-bottom: 10px;
}

.prompt-enhancer-trial-expired-title {
  font-size: 15px;
  font-weight: 650;
  margin-bottom: 6px;
  letter-spacing: -0.2px;
}

.prompt-enhancer-trial-expired-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 16px;
  line-height: 1.5;
}

.prompt-enhancer-trial-expired-btn {
  display: inline-block;
  padding: 9px 24px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.prompt-enhancer-trial-expired-btn:hover {
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
  transform: translateY(-1px);
}

.prompt-enhancer-trial-expired-close {
  position: absolute;
  top: 10px;
  right: 12px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  font-size: 16px;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
  border-radius: 4px;
  transition: all 0.15s;
}

.prompt-enhancer-trial-expired-close:hover {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.08);
}

/* ─── 试用计数 Toast ─── */
.prompt-enhancer-toast-trial {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.prompt-enhancer-toast-trial-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.prompt-enhancer-toast-trial-hint.warning {
  color: #fbbf24;
}

.prompt-enhancer-toast-trial-link {
  color: #818cf8;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
`;
