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

/* ─── 语义化变量 (Semantic Variables) ─── */
:host, :root {
  /* 原始调色板: 方案五 钛金与珠光霜月 */
  --color-titanium-deep: #272625;
  --color-titanium-core: #878681;
  --color-ethereal-mist: rgba(217, 217, 217, 0.4);
  --color-pearly-moon: #F6F1D5;
  --color-obsidian: #171717;

  /* 语义令牌 - 默认（亮色输入框优先：深沉钛金带来高对比度） */
  --ai-text-primary: rgba(255, 255, 255, 0.9);
  --ai-text-secondary: rgba(255, 255, 255, 0.5);
  --ai-border-subtle: rgba(255, 255, 255, 0.15);
  --ai-border-highlight: rgba(246, 241, 213, 0.25);
  --ai-glass-bg: rgba(39, 38, 37, 0.85); /* 显著加深：保障白色网页下按钮的可视性 */
  --ai-glass-hover: rgba(58, 57, 55, 0.95);
  --ai-icon-color: var(--color-pearly-moon); /* 霜月色 */
  --ai-dot-color: var(--color-titanium-core);
  --ai-collapsed-star-size: 13px;
  --ai-collapsed-star-rest-opacity: 0.78;
  --ai-collapsed-star-glow-soft: rgba(246, 241, 213, 0.28);
  --ai-collapsed-star-glow-strong: rgba(246, 241, 213, 0.5);

  /* 物理动效参数 */
  --ai-curve-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --ai-curve-asymmetric: cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-color-scheme: dark) {
  :host, :root {
    /* 暗黑模式下输入框通常为黑与深灰，我们将按钮反转为浅色霜透玻璃提升物理边缘可视度 */
    --ai-glass-bg: rgba(255, 255, 255, 0.12);
    --ai-glass-hover: rgba(255, 255, 255, 0.2);
    --ai-border-subtle: rgba(255, 255, 255, 0.25);
    --ai-border-highlight: rgba(255, 255, 255, 0.4);
    --ai-dot-color: #B0AFAF; /* 提亮收起态星芒点，避免随夜色隐匿 */
  }
}

/* ─── 按钮容器 ─── */
.prompt-enhancer-container {
  position: fixed;
  z-index: 2147483647 !important;
  display: flex;
  gap: 4px;
  pointer-events: none;
  isolation: isolate;
}

/* ─── 按钮基础展开态 — 液态玻璃质感 (Liquid Glassmorphism) ─── */
.prompt-enhancer-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  /* 液态玻璃基底 */
  background: var(--ai-glass-bg);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  /* 极细微透光边框界定物理边缘 */
  border: 1px solid var(--ai-border-subtle);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ai-icon-color) !important; /* 防止宿主网站强制覆写 color */
  pointer-events: auto;
  
  /* 多层复合悬浮外阴影，构建深度 */
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.3),
    0px 2px 4px rgba(0, 0, 0, 0.2),
    0px 4px 8px rgba(0, 0, 0, 0.15),
    0px 8px 16px rgba(0, 0, 0, 0.1),
    0px 16px 32px rgba(0, 0, 0, 0.05);

  /* 内阴影雕刻边缘高光反射 */
  box-shadow: inset 0 1px 1px rgba(246, 241, 213, 0.15), 
              0px 1px 2px rgba(0, 0, 0, 0.3),
              0px 4px 12px rgba(0, 0, 0, 0.15);

  transition:
    border-radius 0.15s ease-out,
    opacity 0.15s ease-out,
    box-shadow 0.15s ease-out,
    background 0.15s ease-out,
    border-color 0.15s ease-out;
  user-select: none;
  opacity: 0.9;
  transform: none;
  overflow: visible;
  position: relative;
}

.prompt-enhancer-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  opacity: 1;
  transform: scale(1);
  fill: currentColor !important; /* 强制跟随 color */
  transition:
    opacity 0.24s var(--ai-curve-asymmetric),
    transform 0.32s var(--ai-curve-asymmetric);
}

.prompt-enhancer-icon svg {
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
  display: block;
  flex: 0 0 auto;
}

/* 小星芒视觉层（默认隐藏，collapsed 时显示） */
.prompt-enhancer-btn::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--ai-collapsed-star-size);
  height: var(--ai-collapsed-star-size);
  transform: translate(-50%, -50%) scale(0.6);
  border-radius: 2px;
  /* 自适应极简色基底 */
  background: linear-gradient(
    180deg,
    var(--color-pearly-moon) 0%,
    var(--ai-dot-color) 100%
  );
  /* 四芒星裁切 */
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
  opacity: 0;
  pointer-events: none;
  animation: none;
  transition:
    opacity 0.24s var(--ai-curve-asymmetric),
    transform 0.32s var(--ai-curve-asymmetric),
    filter 0.24s var(--ai-curve-asymmetric);
}

/* ─── 收起态：迷你星芒 ✦ ─── */
.prompt-enhancer-btn.collapsed {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  opacity: 0.9;
  transform: none;
  border-radius: 8px;
  animation: none;
}

.prompt-enhancer-btn.collapsed::before {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
  filter:
    drop-shadow(0 0 2px rgba(255, 255, 255, 0.18))
    drop-shadow(0 0 4px var(--ai-collapsed-star-glow-soft));
  animation: pe-collapsed-breathe 5s ease-in-out infinite;
}

/* 收起态隐藏 SVG 图标 */
.prompt-enhancer-btn.collapsed .prompt-enhancer-icon {
  opacity: 0;
  transform: scale(0.55);
}

/* 收起态保留星芒反馈，但彻底阻断按钮本体矩形反馈 */
.prompt-enhancer-btn.collapsed:hover,
.prompt-enhancer-btn.collapsed:active,
.prompt-enhancer-btn.collapsed:focus,
.prompt-enhancer-btn.collapsed:focus-visible {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  outline: none;
}

.prompt-enhancer-btn.collapsed:hover::before,
.prompt-enhancer-btn.collapsed:focus-visible::before {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1.22);
  filter:
    drop-shadow(0 0 4px rgba(255, 255, 255, 0.3))
    drop-shadow(0 0 8px var(--ai-collapsed-star-glow-strong));
  animation: none;
}

.prompt-enhancer-btn.collapsed:active::before {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1.12);
  filter:
    drop-shadow(0 0 3px rgba(255, 255, 255, 0.24))
    drop-shadow(0 0 6px var(--ai-collapsed-star-glow-strong));
  animation: none;
}

/* 仿生呼吸动画：贴合星芒轮廓发光，避免矩形投影 */
@keyframes pe-collapsed-breathe {
  0% {
    opacity: var(--ai-collapsed-star-rest-opacity);
    transform: translate(-50%, -50%) scale(0.95);
    filter:
      drop-shadow(0 0 2px rgba(255, 255, 255, 0.16))
      drop-shadow(0 0 4px rgba(246, 241, 213, 0.12));
  }
  42% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.12);
    filter:
      drop-shadow(0 0 4px rgba(255, 255, 255, 0.28))
      drop-shadow(0 0 8px var(--ai-collapsed-star-glow-strong));
  }
  100% {
    opacity: var(--ai-collapsed-star-rest-opacity);
    transform: translate(-50%, -50%) scale(0.95);
    filter:
      drop-shadow(0 0 2px rgba(255, 255, 255, 0.16))
      drop-shadow(0 0 4px rgba(246, 241, 213, 0.12));
  }
}

/* ─── 悬停态：材质提亮 ─── */
.prompt-enhancer-btn:hover {
  border-radius: 8px;
  background: var(--ai-glass-hover); /* 环境自适应悬停提亮 */
  opacity: 1;
  transform: none;
  border-color: var(--ai-border-highlight);
  box-shadow: inset 0 1px 1px var(--ai-border-highlight), 
              0px 4px 16px rgba(0, 0, 0, 0.2);
}

.prompt-enhancer-btn:hover .prompt-enhancer-icon {
  transform: scale(1);
}

.prompt-enhancer-btn:active {
  transform: none;
  background: var(--ai-glass-bg);
  box-shadow: inset 0 1px 1px rgba(246, 241, 213, 0.1), 
              0px 1px 4px rgba(0, 0, 0, 0.25);
}

/* ─── 生成中：内边缘光束环绕 (Border Beam Effect) ─── */
.prompt-enhancer-btn.generating {
  opacity: 1;
  pointer-events: auto;
  position: relative;
  overflow: hidden;
  clip-path: none;
  /* 移除原有的跑马灯光晕，改用克制的光束 */
  animation: none;
  /* 留出微小的轨道 */
  padding: 1px;
}

/* 生成中发光器（背景光束旋转） */
.prompt-enhancer-btn.generating::before {
  content: '';
  position: absolute;
  inset: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(
    transparent 0%, 
    rgba(246, 241, 213, 0.1) 60%, 
    var(--color-pearly-moon) 100%
  );
  animation: pe-beam-spin 4s linear infinite;
  z-index: -2;
  border-radius: inherit;
}

/* 生成中主体内衬罩（遮盖光束，只露边缘） */
.prompt-enhancer-btn.generating::after {
  content: '';
  position: absolute;
  inset: 1px;
  background: var(--color-titanium-deep);
  border-radius: 7px;
  z-index: -1;
  pointer-events: none;
}

@keyframes pe-beam-spin {
  100% { transform: rotate(360deg); }
}

/* 图标微浮动 */
.prompt-enhancer-btn.generating .prompt-enhancer-icon {
  animation: pe-icon-float 2.4s ease-in-out infinite;
  opacity: 1;
  transform: scale(1);
}

.prompt-enhancer-btn.stoppable .prompt-enhancer-icon {
  animation: none;
}

@keyframes pe-icon-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

/* P2-3.6: 焦点样式（无障碍） */
.prompt-enhancer-btn:focus {
  outline: 2px solid var(--color-pearly-moon);
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
  clip-path: none;
}

.prompt-enhancer-btn.generating.streaming {
  animation: pe-streaming-pulse 1.5s ease-in-out infinite;
}

@keyframes pe-streaming-pulse {
  0%, 100% {
    opacity: 0.8;
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
  width: max-content;
  max-width: min(420px, calc(100vw - 16px));
  background: rgba(39, 38, 37, 0.85); /* 适配钛金深灰 */
  color: var(--ai-text-primary);
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  white-space: normal;
  pointer-events: auto;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.1),
    0 0 0 1px var(--ai-border-subtle),
    0 4px 16px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transform: translateY(6px);
  animation: pe-onboarding-enter 0.35s var(--ai-curve-spring) forwards;
  animation-delay: 0.5s;
  letter-spacing: -0.1px;
}

/* 气泡尾巴（小三角） */
.prompt-enhancer-onboarding::after {
  content: '';
  position: absolute;
  bottom: -4px;
  right: 14px;
  width: 10px;
  height: 10px;
  background: rgba(39, 38, 37, 0.95);
  transform: rotate(45deg);
  border-radius: 0 0 2px 0;
  border-bottom: 1px solid var(--ai-border-subtle);
  border-right: 1px solid var(--ai-border-subtle);
}

.prompt-enhancer-onboarding-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.prompt-enhancer-onboarding-text {
  font-weight: 500;
  color: var(--ai-text-primary);
  line-height: 1.4;
  white-space: nowrap;
}

.prompt-enhancer-onboarding-close {
  background: none;
  border: none;
  color: var(--ai-text-secondary);
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
  color: var(--ai-text-primary);
  background: var(--ai-border-subtle);
}

.prompt-enhancer-onboarding-close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(246, 241, 213, 0.45);
}

@keyframes pe-onboarding-enter {
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
  animation: pe-hourglass-flip 2.4s ease-in-out infinite;
}

/* 沙漏翻转动画 */
@keyframes pe-hourglass-flip {
  0% { transform: rotate(0deg); }
  20% { transform: rotate(180deg); }
  50% { transform: rotate(180deg); }
  70% { transform: rotate(360deg); }
  100% { transform: rotate(360deg); }
}

/* ─── Toast 提示 — Glassmorphism ─── */
.prompt-enhancer-toast {
  position: fixed;
  left: var(--pe-toast-left, 50%);
  top: var(--pe-toast-top, 16px);
  transform:
    translateX(var(--pe-toast-translate-x, -50%))
    translateY(var(--pe-toast-translate-y, -10px));
  background: rgba(39, 38, 37, 0.85); /* 适配钛金深灰 */
  color: var(--ai-text-primary);
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 13px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 2147483647;
  opacity: 0;
  transition: all 0.3s var(--ai-curve-spring);
  pointer-events: none;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.1),
    0 0 0 1px var(--ai-border-subtle),
    0 8px 24px rgba(0, 0, 0, 0.4);
  letter-spacing: -0.1px;
}

.prompt-enhancer-toast.show {
  transform: translateX(var(--pe-toast-translate-x, -50%)) translateY(0);
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
  background: var(--color-pearly-moon); /* 微光色 */
  animation: pe-dot-pulse 1.2s ease-in-out infinite;
}

@keyframes pe-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); box-shadow: 0 0 8px var(--color-pearly-moon); }
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

/* 打字机光标 — 品牌微光色 */
.prompt-enhancer-preview-content::after {
  content: '▋';
  animation: pe-cursor-blink 1s step-end infinite;
  color: var(--color-titanium-core);
}

.prompt-enhancer-preview-content.done::after {
  display: none;
}

@keyframes pe-cursor-blink {
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
  transition: all 0.15s var(--ai-curve-spring);
}

.prompt-enhancer-preview-btn.primary {
  background: var(--color-titanium-deep);
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.prompt-enhancer-preview-btn.primary:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  transform: translateY(-0.5px);
  background: #3A3937;
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
  background:
    radial-gradient(circle at top, rgba(246, 241, 213, 0.14), transparent 55%),
    rgba(39, 38, 37, 0.94);
  color: var(--ai-text-primary);
  padding: 22px 24px 20px;
  border-radius: 16px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 2147483647;
  opacity: 0;
  transition: all 0.35s var(--ai-curve-spring);
  pointer-events: auto;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.1),
    0 0 0 1px var(--ai-border-subtle),
    0 8px 32px rgba(0, 0, 0, 0.4);
  max-width: 384px;
  text-align: left;
}

.prompt-enhancer-trial-expired.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

.prompt-enhancer-trial-expired-icon {
  width: 40px;
  height: 40px;
  font-size: 22px;
  margin-bottom: 12px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(246, 241, 213, 0.08);
}

.prompt-enhancer-trial-expired-title {
  font-size: 16px;
  font-weight: 650;
  margin-bottom: 8px;
  letter-spacing: -0.2px;
}

.prompt-enhancer-trial-expired-desc {
  font-size: 13px;
  color: var(--ai-text-secondary);
  margin-bottom: 18px;
  line-height: 1.5;
}

.prompt-enhancer-trial-expired-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 180px;
  padding: 10px 18px;
  background: var(--color-pearly-moon);
  color: var(--color-titanium-deep);
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s var(--ai-curve-spring);
}

.prompt-enhancer-trial-expired-btn:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
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
