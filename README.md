# Prompt Enhancer

一键润色优化你的 Prompt，让 AI 更好地理解你的意图。

## 功能特性

- 🚀 **智能优化**：基于提示词工程前沿技术，自动识别任务类型并选择最佳优化策略
- 🔒 **安全存储**：API Key 仅存储在本地，使用加密保护，不会同步或上传
- ⚡ **快捷操作**：支持 `Cmd/Ctrl+Shift+E` 一键润色
- 🌐 **多平台支持**：支持 OpenAI、Anthropic、DeepSeek 及自定义 API
- 🎯 **权限最小化**：仅在需要时请求权限，保护用户隐私

## 技术栈

- **TypeScript** - 类型安全
- **Vite + CRXJS** - 现代化构建
- **ESLint + Prettier** - 代码规范
- **Chrome Extension Manifest V3**

## 安装与使用

### 从源码构建

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
```

### 加载扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `dist` 目录

### 配置 API

1. 点击扩展图标打开设置
2. 选择 API 提供商
3. 输入 API Key
4. 保存设置

## 快捷键

| 操作 | Mac | Windows/Linux |
|------|-----|---------------|
| 润色 | `⌘⇧E` | `Ctrl+Shift+E` |
| 撤回 | `⌘Z` | `Ctrl+Z` |

## 项目结构

```
src/
├── background/           # Service Worker
│   ├── index.ts         # 入口
│   ├── analyzer.ts      # Prompt 分析器
│   ├── enhancer.ts      # 优化协调器
│   ├── prompt-builder.ts # 提示词构建器
│   └── providers/       # API 适配器
├── content/             # Content Script
│   ├── index.ts        # 入口
│   ├── ui/             # UI 组件
│   └── services/       # 业务服务
├── popup/              # 弹出页面
├── shared/             # 共享模块
│   ├── types.ts       # 类型定义
│   ├── constants.ts   # 常量
│   ├── storage.ts     # 存储服务
│   └── utils/         # 工具函数
└── manifest.ts        # Manifest 配置
```

## 安全说明

- **API Key 安全**：所有 API Key 使用 `chrome.storage.local` 存储（不会同步到云端），并进行加密混淆
- **权限最小化**：使用 `activeTab` 和可选权限，仅在需要时请求
- **HTTPS 强制**：自定义 API 地址必须使用 HTTPS 协议
- **Anthropic 警告**：使用 Anthropic API 时会显示安全提示

## 开发命令

```bash
# 类型检查
npm run type-check

# 代码检查
npm run lint

# 自动修复
npm run lint:fix

# 格式化代码
npm run format
```

## 许可证

MIT License
