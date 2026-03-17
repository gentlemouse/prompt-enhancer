# 灵犀 — 智能提示词优化器

[![CI](https://github.com/gentlemouse/prompt-enhancer/actions/workflows/ci.yml/badge.svg)](https://github.com/gentlemouse/prompt-enhancer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-green.svg)](https://github.com/gentlemouse/prompt-enhancer/releases)
[![Test Coverage](https://img.shields.io/badge/coverage-97.99%25-brightgreen.svg)](#测试)

简体中文 | **[English](README.md)**

> 心有灵犀一点通

**灵犀**是一个浏览器扩展，充当你和 AI 之间的智能优化层。它读取你的提示词，判断它真正需要什么，然后在你发送之前自动完成升级——不到一秒。

支持 ChatGPT、Claude、Gemini、DeepSeek、Kimi 等 50+ 平台。无需配置即可开始使用。

---

## 它解决什么问题？

你随手在 AI 里输入一行字，得到一个平庸的回答。然后花 5 分钟重写提示词——加上角色设定、任务结构、约束条件、输出格式要求……AI 终于给出了你真正想要的结果。

**会写好提示词是一种技能，每次都精心用它，实在太累了。**

大多数"提示词优化"工具只是把你的输入变得更长。灵犀不同：它**真正理解你的提示词需要什么**，然后选择最合适的策略。

---

## 灵犀与其他工具的区别

| | 普通工具 | 灵犀 |
|---|---|---|
| 短指令，如「翻译这段话」 | 强行添加冗余结构 | 轻润色 — 只补充关键缺失 |
| 复杂请求 | 套用同一套固定模板 | 从 4 套策略中选最合适的，基于 15+ 维度信号 |
| 你精心写好的结构化提示词 | 照样重写 | 识别已有结构，只做精准微调 |
| 修正补充，如「再加上异步处理」 | 当作不完整编辑语句 | 扩写为可独立执行的完整提示词 |
| 双语用户 | 随机选一种语言 | 自动识别中英文，全程保持原始语言输出 |

---

## 工作原理：3 阶段处理流水线

```
你的提示词  →  [分析]  →  [选策略]  →  [构建]  →  优化后的提示词
```

### 第一阶段 · 多维特征分析

每条提示词在 **5 个维度同时分析：**

| 维度 | 检测内容 |
|------|---------|
| **任务类型** | 8 大类之一：代码、写作、分析、问答、规划、研究、闲聊、信息提取 |
| **复杂度** | 思维链信号、多重问题、反思标记 |
| **指令模式** | 当前输入是修正补充、短指令，还是结构化请求 |
| **结构** | 是否已包含角色/任务/约束等结构 |
| **语言** | 中文或英文 — 全程保持 |

### 第二阶段 · 策略选择引擎

基于分析结果，从 **4 套策略**中选择最合适的一个：

```
是修正补充？（「加上」「去掉」「改成」）
  → 约束追加  — 将当前指令改写为完整可执行的独立提示词

提示词很短？（< 30 字）
  → 轻润色    — 补充关键缺失，不过度扩展

已有良好结构？
  → 微调锐化  — 打磨措辞，补强完成标准，保留结构

其他情况：
  → 结构化重写 — 搭建完整角色/任务/约束/输出框架
```

### 第三阶段 · 提示词构建

选中的策略生成一个**专用系统提示词**，精确指导 LLM 如何优化你的输入——不仅针对策略，还针对具体的任务类型和推理深度做定制化调整。优化结果直接替换输入框中的原文。

---

## 真实效果演示

### 轻润色 — 短指令变聪明，但不变冗长

| | |
|---|---|
| **优化前** | `翻译这段话` |
| **优化后** | `将以下段落翻译为英文，保持原文语气和风格。如遇专业术语，在译文后用括号标注原文。` |

### 结构化重写 — 复杂需求有了清晰框架

| | |
|---|---|
| **优化前** | `帮我写个 Python 爬虫爬新闻网站` |
| **优化后** | `角色：资深 Python 开发者，擅长 Web 爬虫和数据采集。`<br><br>`任务：开发一个可配置的新闻网站爬虫，提取字段：标题、发布日期、作者、正文，并自动处理分页。`<br><br>`约束：使用 requests + BeautifulSoup；请求间隔不少于 1 秒；网络异常时优雅降级，记录日志并跳过，不中断流程。`<br><br>`输出：完整可运行的 Python 脚本，附使用示例。` |

### 微调锐化 — 好提示词更完美

| | |
|---|---|
| **优化前** | `角色：营销专家。任务：写广告文案。要求：吸引人。` |
| **优化后** | `角色：资深营销文案专家，拥有 10 年消费电子行业经验。任务：为新款无线耳机撰写 3 版广告文案。风格：活力、年轻化；篇幅：每版 50–80 字；每版包含一个明确 CTA；避免：空洞最高级形容词、竞品对比。` |

### 约束追加 — 修正需求被正确整合

| | |
|---|---|
| **优化前** | `加上错误处理，改成异步的` |
| **优化后** | `在之前代码的基础上进行以下修改：1. 将所有同步 I/O 改为 async/await；2. 添加错误处理：网络超时 → 指数退避重试 3 次；数据异常 → 记录警告日志并跳过；权限错误 → 立即抛出；3. 保持原有功能不变。` |

---

## 核心功能

- **4 套动态策略** — 根据提示词特征自动匹配最合适的优化方式
- **8 种任务类型识别** — 代码、写作、分析、问答、规划、研究、闲聊、信息提取
- **3 级推理模式** — 简单 / 深度思考 / 专家，根据复杂度信号自动切换
- **防注入保护** — 在优化过程中防止提示词注入攻击
- **10 次免费使用** — 无需配置，无需 API Key，安装即用
- **自带 Key 模式** — 接入 OpenAI / Anthropic / DeepSeek / Kimi / MiniMax / 通义千问 / 智谱 / 自定义接口，无限使用
- **50+ 平台** — ChatGPT、Claude、Gemini、DeepSeek、Kimi、通义千问等
- **隐私优先** — 仅在你主动触发时处理提示词，API Key 本地加密保存，匿名统计可关闭
- **快捷键** — `Cmd/Ctrl+Shift+E` 优化 · `Ctrl+Z` 撤回

---

## 安装

### Chrome Web Store
> 即将上线，敬请期待。

### Edge Add-ons
> 即将上线，敬请期待。

### 从源码构建

```bash
git clone https://github.com/gentlemouse/prompt-enhancer.git
cd prompt-enhancer
npm install
npm run build
```

1. 打开 `chrome://extensions/`（Chrome）或 `edge://extensions/`（Edge）
2. 启用**开发者模式**
3. 点击**加载已解压的扩展程序**
4. 选择 `dist` 文件夹

---

## 使用方式

### 免费模式（无需配置）

安装 → 打开任意 AI 聊天页面 → 按 `Cmd+Shift+E` 或点击输入框旁的 ✦ 按钮。通过 Lynx 受保护代理会话获得 10 次免费使用。

### 自带 Key 模式（无限使用）

1. 点击扩展图标 → 打开设置
2. 选择 API 提供商：OpenAI / Anthropic / DeepSeek / Kimi / 通义千问 / 自定义
3. 输入 API Key → 保存
4. 解锁无限次使用

Anthropic 默认启用 Lynx relay，经由 Worker 中转；如果你更偏好浏览器直连，可以在设置里手动关闭 relay。

### 快捷键

| 操作 | Mac | Windows / Linux |
|------|-----|-----------------|
| 优化提示词 | `⌘⇧E` | `Ctrl+Shift+E` |
| 撤回 | `⌘Z` | `Ctrl+Z` |

---

## 架构

```
src/
├── background/
│   ├── analyzer.ts         # 多维特征分析引擎（5 维度，15+ 信号）
│   ├── prompt-builder.ts   # 4 套策略模板，含任务类型专属优化指导
│   ├── enhancer.ts         # 协调器
│   └── providers/          # API 适配器：OpenAI / Anthropic / DeepSeek / Proxy
├── content/
│   ├── services/
│   │   ├── input-detector.ts   # 50+ 平台输入框智能检测
│   └── ui/                     # Shadow DOM 隔离的 UI 组件
├── shared/
│   ├── analytics.ts        # 匿名可关闭的使用统计
│   ├── fingerprint.ts      # 设备指纹（免费额度防滥用）
│   ├── trial.ts            # 免费试用管理
│   └── utils/              # 加密、重试、验证
├── popup/                  # 设置页面 + 新手引导流程
└── manifest.ts             # Chrome Extension Manifest V3
```

---

## 测试

核心模块测试覆盖率 **97.99%**，共 146 个测试用例。

| 模块 | 语句 | 分支 | 函数 | 行 |
|------|------|------|------|-----|
| analyzer.ts | 98.83% | 98.11% | 100% | 98.64% |
| prompt-builder.ts | 100% | 80% | 100% | 100% |
| analytics.ts | 95% | 86.11% | 100% | 94.52% |
| validation.ts | 100% | 100% | 100% | 100% |
| retry.ts | 96.96% | 91.3% | 100% | 96.55% |

```bash
npm run test            # 运行测试
npm run test:coverage   # 测试 + 覆盖率报告
```

---

## 开发

```bash
npm run dev            # 开发模式（热重载）
npm run build          # 生产构建
npm run lint           # ESLint 检查
npm run type-check     # TypeScript 类型检查
```

---

## 技术栈

- **TypeScript** — 严格模式，全面类型安全
- **Vite + CRXJS** — 现代化构建，HMR 热重载
- **Vitest** — 单元测试 + 覆盖率
- **ESLint + Prettier + Husky** — 代码规范 + 提交门禁
- **GitHub Actions** — CI/CD 自动化
- **Cloudflare Workers + Durable Objects** — 受保护代理、relay、额度与网关协调层
- **Chrome Extension Manifest V3**

---

## 隐私

- **按需处理提示词** — 免费模式下提示词会通过 Lynx 受保护代理会话发送；自带 Key 模式下提示词会直接发送到你选择的 AI 提供商，但 Anthropic 默认启用 relay，可手动关闭
- **API Key 加密存储** — 保存在本地 `chrome.storage.local`，不同步到云端
- **强制 HTTPS** — 自定义 API 地址必须使用 HTTPS
- **可关闭的匿名统计** — 匿名使用数据可随时 opt-out

详见 [隐私政策](docs/privacy-policy.md)。

---

## 参与贡献

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'feat: add your feature'`
4. 推送并提交 Pull Request

---

## 许可证

[MIT](LICENSE) © mouse 张
