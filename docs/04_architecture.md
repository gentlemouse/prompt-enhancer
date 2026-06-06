# 04 Architecture - Lynx / Prompt Enhancer

> 本文件记录当前仓库的真实结构、技术栈、验证入口与高风险区域，只基于仓库现状，不引入模板化假设。

## Meta

- Project: Lynx / Smart Prompt Enhancer
- Repository: `gentlemouse/prompt-enhancer`
- Default branch clue: `main`
- Last updated: 2026-03-31
- Status: active

## 1. 仓库事实

- 仓库类型：单仓 Node/TypeScript 项目，不是 monorepo，也没有 workspace 配置
- 包管理器：`npm`
- 锁文件：`package-lock.json`
- 运行形态：Chrome Extension Manifest V3 + Cloudflare Worker
- CI 平台：GitHub Actions
- 主要验证框架：ESLint、TypeScript、Vitest、Playwright

## 2. 真实目录结构

```text
src/
  background/        # prompt analysis、strategy selection、provider orchestration
  content/           # 站点适配、输入框检测、注入 UI、流式交互
  popup/             # 扩展设置页、trial/onboarding
  shared/            # storage、trial、fingerprint、analytics、constants、utils
proxy/               # Cloudflare Worker、quota/relay/session/SLO 逻辑
tests/
  e2e/               # Playwright E2E
docs/                # 产品、隐私、商店、专项调查、架构/harness 文档
scripts/             # verify-apis、provider-smoke、调试与验证脚本
.github/workflows/   # GitHub Actions CI
```

当前仓库不存在这些模板常见顶层目录：

- `app/`
- `features/`
- `lib/`
- `infra/`
- `migrations/`

但存在与这些概念相关的真实位置：

- “service” 逻辑主要在 `src/content/services/`
- “infra / deployment” 线索主要在 `proxy/` 与 `.github/workflows/`
- “migration” 线索体现在 `proxy/wrangler.toml` 的 Durable Objects `[[migrations]]`

## 3. 模块边界

### `src/background`

- 职责：分析输入、选择优化策略、调用 provider、组织试用逻辑与消息桥接
- 关键文件：
  - `analyzer.ts`
  - `prompt-builder.ts`
  - `enhancer.ts`
  - `providers/*.ts`
  - `index.ts`

### `src/content`

- 职责：在第三方页面中检测输入框、注入按钮/预览/UI、处理交互与异常展示
- 子模块：
  - `services/`：站点适配、输入检测、增强处理、流式错误映射
  - `ui/`：按钮、toast、preview、trial prompt、shadow host

### `src/popup`

- 职责：设置页、provider 配置、trial 状态展示、relay 开关、onboarding

### `src/shared`

- 职责：扩展内共享能力
- 关注点：
  - `storage.ts`：API key 本地存储与读取
  - `utils/crypto.ts`：本地加密/解密逻辑
  - `trial.ts`：免费额度同步
  - `free-session.ts`：短时 session
  - `fingerprint.ts`：设备指纹
  - `analytics.ts`：匿名统计
  - `quota-errors.ts`：额度/配额错误归一化

### `proxy`

- 职责：Cloudflare Worker 代理、free session 校验、quota reservation/commit/release、Anthropic relay、SLO dashboard
- 关键文件：
  - `worker.ts`
  - `wrangler.toml`

## 4. 真实命令映射

- 开发：`npm run dev`
- lint：`npm run lint`
- 类型检查：`npm run type-check`
- 测试：`npm run test`
- 覆盖率：`npm run test:coverage`
- 构建：`npm run build`
- E2E：`npm run test:e2e`
- E2E 调试：`npm run test:e2e:debug`
- 代理 API 校验：`npm run verify-apis`
- Provider 联调：`npm run smoke:providers`
- 打包：`npm run package`
- 版本打包：`npm run release:package`

统一脚本入口：

- `bash scripts/smoke.sh`
- `bash scripts/verify.sh`

## 5. 本地验证与 CI 分层

### 本地验证

- `husky` pre-commit 运行 `lint-staged`
- 可用脚本：
  - lint
  - type-check
  - test
  - test:coverage
  - build
  - test:e2e
  - verify-apis
  - smoke:providers

### CI 验证

GitHub Actions workflow：`.github/workflows/ci.yml`

- Job `lint-and-test`
  - `npm ci`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run test:coverage`
- Job `build`
  - `npm ci`
  - `npm run build`
  - 上传 `dist/` artifact，保留 7 天

当前 CI 未运行：

- `npm run test:e2e`
- `npm run verify-apis`
- `npm run smoke:providers`

## 6. 高风险区域

以下区域默认视为高风险：

- `src/manifest.ts`
  - 扩展权限、host permissions、content script 注入模型
- `src/background/`
  - 核心增强编排、provider 路由、权限请求、消息桥接
- `src/shared/storage.ts`
  - API key 持久化
- `src/shared/utils/crypto.ts`
  - 本地加密逻辑
- `src/shared/trial.ts`
  - 免费额度状态
- `src/shared/free-session.ts`
  - session 缓存与鉴权上下文
- `src/shared/fingerprint.ts`
  - anti-abuse 标识
- `src/shared/analytics.ts`
  - usage analytics 与隐私披露耦合
- `proxy/worker.ts`
  - relay、quota、session、SLO dashboard、运维接口
- `proxy/wrangler.toml`
  - Durable Objects、KV、secret、环境变量、migration tag

## 7. 发布与运维边界

- 扩展构建产物来自 `npm run build`
- 本地打包产物来自 `npm run package` / `npm run release:package`
- Worker 部署线索存在于 `proxy/worker.ts` 注释中的 `wrangler deploy`
- 当前仓库可见 release 线索，但未发现完整 rollback 脚本或文档
- Worker 暴露 `/dashboard` 与 `/v1/slo` 作为运维/观测入口，并有测试覆盖

## 8. 证据链线索

仓库内已存在的证据链包括：

- 单元/集成测试：`tests/**/*.test.ts`
- E2E：`tests/e2e/extension-smoke.spec.ts`
- Playwright trace：`playwright.config.ts` 中 `trace: 'on-first-retry'`
- coverage：`test:coverage` 与 `coverage/`
- CI artifact：`dist/`
- Worker dashboard / SLO：`/dashboard`、`/v1/slo`
- 隐私与商店披露文档：`docs/privacy-policy.md`、`docs/store-listing.md`、`docs/chrome-web-store-privacy-remediation.md`

## 9. 风险提示

- 本仓库不是纯前端页面项目，而是“扩展运行时 + 代理后端”混合体
- `trial / quota / fingerprint / relay / privacy disclosure` 之间存在强耦合
- 看似“只是文档或脚本整理”的变更，也不应误改真实命令映射或发布路径
