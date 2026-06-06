# AGENTS.md

## 1. 项目概览

这是 `Lynx / prompt-enhancer` 的 Agent 协作指南。

- 项目类型：单仓 Node/TypeScript 浏览器扩展项目，包含 Cloudflare Worker 代理
- 仓库目标：在不破坏现有扩展行为、隐私约束和配额机制的前提下，支持人类与 AI 协作者安全推进文档、脚本、测试与低风险改动
- 当前阶段：真实产品仓库，已存在 CI、测试、打包与发布线索

## 2. 开始前必须阅读

开始任何改动前，请优先阅读：

1. `README.md`
2. `docs/04_architecture.md`
3. `docs/05_release_checklist.md`
4. `docs/06_harness.md`

开始本轮任务前，还必须检查：

- `harness/progress.md`
- `harness/feature_registry.json`
- 当前 task 对应的 contract（如存在）

如果文档和代码现状冲突：

- 在说明中明确指出冲突
- 不要自行脑补产品意图
- 优先保持现有代码行为与发布路径稳定

## 3. 通用工作规则

- 先小步修改，再做结构整理
- 未经明确批准，不修改以下高风险区域的业务逻辑：
  - `src/background/`
  - `src/shared/free-session.ts`
  - `src/shared/trial.ts`
  - `src/shared/storage.ts`
  - `src/shared/analytics.ts`
  - `src/manifest.ts`
  - `proxy/worker.ts`
  - `proxy/wrangler.toml`
- 不要覆盖已有 README、docs、CI；优先补充或合并
- 修改行为后，需要同步更新相关文档和 harness 状态
- 没有跑完 `bash scripts/verify.sh` 或等价验证前，不得宣布完成

## 4. 真实命令

当前仓库真实存在的命令如下：

- 开发：`npm run dev`
- lint：`npm run lint`
- 类型检查：`npm run type-check`
- 单元/集成测试：`npm run test`
- 覆盖率：`npm run test:coverage`
- 构建：`npm run build`
- E2E：`npm run test:e2e`
- E2E 调试：`npm run test:e2e:debug`
- 代理 API 校验：`npm run verify-apis`
- Provider 联调：`npm run smoke:providers`
- 打包：`npm run package`
- 版本打包：`npm run release:package`

协作默认入口：

- 快速检查：`bash scripts/smoke.sh`
- 提交前验证：`bash scripts/verify.sh`

如果命令名与常见模板不一致：

- 以 `package.json` 中真实脚本为准
- 不要把 `typecheck` 写成已存在命令；本仓库真实命令是 `type-check`
- 不要把 `e2e` 写成已存在命令；本仓库真实命令是 `test:e2e`

## 5. 目录地图

- `src/background/`：分析、增强编排、provider 适配器与后台桥接
- `src/content/`：网页注入、输入框检测、UI 与流式交互
- `src/popup/`：扩展设置页与 onboarding
- `src/shared/`：存储、试用额度、设备指纹、analytics、通用常量与工具
- `proxy/`：Cloudflare Worker、Durable Objects、配额与 relay 逻辑
- `tests/`：Vitest 测试与 Playwright E2E
- `docs/`：产品、隐私、商店、专项调研与架构/harness 文档
- `scripts/`：开发辅助、provider smoke、verify 脚本
- `.github/workflows/`：GitHub Actions CI

## 6. 默认可编辑与高风险区域

默认可编辑：

- `docs/`
- `harness/`
- `scripts/`
- 测试代码
- 低风险 UI 文案与样式

默认高风险：

- 扩展权限、注入与消息桥接
- 免费会话、设备指纹、配额与 anti-abuse
- API key 存储与加密
- analytics / 隐私相关逻辑
- Worker relay、SLO dashboard、配额 Durable Objects
- 打包与部署配置

涉及高风险区域时：

- 必须先给 plan / contract
- 说明影响面与回滚思路
- 优先拆成小 PR

## 7. 文档更新规则

以下情况必须同步更新文档：

- 架构边界、模块职责、验证入口变化 → `docs/04_architecture.md`
- 发布步骤、验证 gate、回滚认知变化 → `docs/05_release_checklist.md`
- agent 协作协议、状态文件约定变化 → `docs/06_harness.md`
- 本轮状态与下一步建议变化 → `harness/progress.md`
- 功能状态、验收项、验证命令变化 → `harness/feature_registry.json`

## 8. 审查重点

优先关注：

- 功能正确性与跨平台扩展行为
- permissions / privacy / quota / relay 是否有回归
- 是否引入 breaking changes
- 是否缺少关键测试
- 文档与实现是否一致
- verify 输出是否诚实，不夸大已验证范围
