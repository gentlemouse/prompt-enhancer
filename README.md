# Prompt Enhancer

[![CI](https://github.com/gentlemouse/prompt-enhancer/actions/workflows/ci.yml/badge.svg)](https://github.com/gentlemouse/prompt-enhancer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-green.svg)](https://github.com/gentlemouse/prompt-enhancer/releases)
[![Test Coverage](https://img.shields.io/badge/coverage-97.99%25-brightgreen.svg)](#testing)

> 一键润色优化你的 Prompt，让 AI 更好地理解你的意图。

在 ChatGPT、Claude、Gemini、DeepSeek 等 50+ AI 平台上统一增强你的提示词——安装即用，无需配置。

<!-- 
## Screenshots
TODO: 添加扩展截图和 GIF 演示
![Demo](docs/assets/demo.gif)
-->

## Features

- **智能策略引擎** — 5 套动态优化策略（轻润色 / 结构化重写 / 意图澄清 / 微调锐化 / 约束追加），根据 8 种任务类型 × 3 级推理模式自动匹配
- **开箱即用** — 安装后直接使用，每天 10 次免费增强，无需配置 API Key
- **会话记忆** — 5 轮滑动窗口，智能区分"新话题"vs"追问"vs"修正"
- **跨平台覆盖** — 支持 ChatGPT、Claude、Gemini、DeepSeek、Kimi、通义千问等 50+ AI 站点
- **隐私优先** — API Key 加密本地存储，不采集任何 prompt 内容，可选匿名统计支持 opt-out
- **快捷操作** — `Cmd/Ctrl+Shift+E` 一键润色，`Ctrl+Z` 撤回

## Install

### Chrome Web Store

<!-- TODO: 审核通过后替换为实际链接 -->
> 即将上线，敬请期待。

### Edge Add-ons

<!-- TODO: 审核通过后替换为实际链接 -->
> 即将上线，敬请期待。

### 从源码构建

```bash
git clone https://github.com/gentlemouse/prompt-enhancer.git
cd prompt-enhancer
npm install
npm run build
```

1. 打开 `chrome://extensions/`（Chrome）或 `edge://extensions/`（Edge）
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目的 `dist` 目录

## Usage

### 免费模式（无需配置）

安装后直接在任何 AI 聊天页面使用，每天 10 次免费增强。

### 自备 API Key（无限使用）

1. 点击扩展图标打开设置
2. 选择 API 提供商（OpenAI / Anthropic / DeepSeek / 自定义）
3. 输入 API Key → 保存
4. 解锁无限次增强

### 快捷键

| 操作 | Mac | Windows/Linux |
|------|-----|---------------|
| 润色 | `⌘⇧E` | `Ctrl+Shift+E` |
| 撤回 | `⌘Z` | `Ctrl+Z` |

## Architecture

```
src/
├── background/              # Service Worker
│   ├── analyzer.ts          # 多维特征分析 + 策略选择引擎
│   ├── prompt-builder.ts    # 5 套策略模板
│   ├── enhancer.ts          # 协调器
│   └── providers/           # API 适配器（OpenAI/Anthropic/DeepSeek/Proxy）
├── content/                 # Content Script
│   ├── services/
│   │   ├── input-detector.ts   # 输入框智能检测
│   │   └── session-memory.ts   # 会话记忆（滑动窗口）
│   └── ui/                  # Shadow DOM 隔离的 UI 组件
├── shared/                  # 共享模块
│   ├── analytics.ts         # 匿名行为统计
│   ├── fingerprint.ts       # 设备指纹（防滥用）
│   ├── trial.ts             # 免费试用管理
│   └── utils/               # 加密、重试、验证
├── popup/                   # 设置页面 + 新手引导
└── manifest.ts              # Chrome Extension Manifest V3
```

## Development

```bash
npm run dev            # 开发模式（热重载）
npm run build          # 生产构建
npm run test           # 运行测试
npm run test:coverage  # 测试 + 覆盖率报告
npm run lint           # ESLint 检查
npm run type-check     # TypeScript 类型检查
```

### Testing

核心模块测试覆盖率 **97.99%**（146 个测试用例）：

| 模块 | 语句 | 分支 | 函数 | 行 |
|------|------|------|------|-----|
| analyzer.ts | 98.83% | 98.11% | 100% | 98.64% |
| prompt-builder.ts | 100% | 80% | 100% | 100% |
| session-memory.ts | 100% | 100% | 100% | 100% |
| analytics.ts | 95% | 86.11% | 100% | 94.52% |
| validation.ts | 100% | 100% | 100% | 100% |
| retry.ts | 96.96% | 91.3% | 100% | 96.55% |

## Tech Stack

- **TypeScript** — 严格模式，全面类型安全
- **Vite + CRXJS** — 现代化构建，HMR 热重载
- **Vitest** — 单元测试 + 覆盖率
- **ESLint + Prettier + Husky** — 代码规范 + 提交门禁
- **GitHub Actions** — CI/CD 自动化
- **Cloudflare Workers** — API 代理层（免费额度服务）
- **Chrome Extension Manifest V3**

## Privacy

- 不采集任何 prompt 内容
- API Key 加密存储在本地（`chrome.storage.local`），不同步到云端
- 自定义 API 地址强制 HTTPS
- 匿名使用统计可随时 opt-out
- 详见 [隐私政策](docs/privacy-policy.md)

## Contributing

欢迎贡献！请先阅读以下指南：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## License

[MIT](LICENSE) © mouse 张
