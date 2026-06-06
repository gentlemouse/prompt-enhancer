# 07 Release & Rollback SOP - Lynx / Prompt Enhancer

> 本文档是当前仓库的最小可执行 release / rollback SOP。它的目标是把 adoption evaluation 中尚未闭环的发布与回滚要求写清楚，支持当前状态从 `partial` 向 `ready` 收敛，但不宣称系统已经 fully production-hardened。

## Meta

- Project: Lynx / Smart Prompt Enhancer
- Date: 2026-03-31
- Status: minimum executable SOP
- Related evaluation: `harness/evaluations/2026-03-31-adoption-baseline-evaluation.md`

## Purpose / Scope

- 为当前真实仓库补齐 extension / Worker 的最小发布与回滚 SOP。
- 明确 browser extension 与 Cloudflare Worker / proxy 两个发布面的 preflight、release、verification 与 rollback 路径。
- 只基于仓库内可见事实、现有文档、现有脚本与已知验证状态，不发明不存在的自动化或外部平台细节。
- 本文档的用途是支持 `partial -> ready` 的最低门槛，不替代每次变更自己的 contract、PR 描述或人工审批。

## Deployment Surfaces

- Browser extension release
  - 面向扩展包构建、打包、提审与发布。
- Cloudflare Worker / proxy release
  - 面向 Worker 部署、proxy 行为、quota / session / relay 相关发布。

说明：

- 两个发布面可能不同步。
- 每次发布都必须先明确本次对象是 extension、worker，还是二者同时涉及。
- 两个发布面分别定义发布前检查、发布动作、发布后验证与失败回滚动作，不能互相替代。

## Non-goals

- 不定义业务代码改动流程。
- 不伪造 Chrome Web Store、Cloudflare 控制台或其他外部平台的精确按钮、页面或后台步骤。
- 不承诺所有回滚都能无损完成。
- 不把未运行的外部依赖验证写成 pass。
- 不把本文档视为高风险发布的自动批准。

## Preconditions

- adoption evaluation 已存在，并明确当前 adoption status 为 `partial`：
  - `harness/evaluations/2026-03-31-adoption-baseline-evaluation.md`
- 当前仓库的 durable context 已存在：
  - `AGENTS.md`
  - `docs/04_architecture.md`
  - `docs/05_release_checklist.md`
  - `docs/06_harness.md`
- 当前 verify 入口已存在：
  - `bash scripts/smoke.sh`
  - `bash scripts/verify.sh`
- 本 SOP 不新增命令、不修改脚本、不改高风险实现。
- 项目形态为单仓 `npm` Node/TypeScript 项目，不是 monorepo。

## Required Inputs / Artifacts

### 仓库内可控

- 当前 contract / evaluation / PR 描述中的发布范围说明。
- `bash scripts/smoke.sh` 与 `bash scripts/verify.sh` 的结果记录。
- 构建产物线索：
  - `dist/`
  - `npm run package`
  - `npm run release:package`
- 相关文档：
  - `docs/05_release_checklist.md`
  - `docs/privacy-policy.md`
  - `docs/store-listing.md`
  - `docs/chrome-web-store-privacy-remediation.md`

### 外部依赖

- `verify-apis` 所需网络与外部环境。
- `smoke:providers` 所需网络、第三方 API 凭证与 provider 可用性。
- Worker 部署时所需 `wrangler` 环境、secrets 与目标环境上下文。

### 人工确认

- 本次发布对象是否包含 extension、worker 或二者。
- 本次发布是否涉及高风险区域。
- 若涉及 worker，是否包含 migration tag / Durable Objects migrations。
- rollback owner、决策路径与例外放行批准人。

## Release Readiness Gates

以下内容属于当前仓库已知的最低放行 gate。每次发布前都要明确哪些已经满足、哪些属于例外放行。

### 已验证的内部步骤

- `bash scripts/smoke.sh` 已通过。
  - 实际覆盖：
    - `npm run lint`
    - `npm run type-check`
- `bash scripts/verify.sh` 已通过。
  - 实际覆盖：
    - `npm run test`
    - `npm run build`
    - `npm run test:e2e`
- Vitest 已知结果：
  - 24 个 test files
  - 230 个 tests
  - 全通过

### 已知 warning / 人工判断项

- Build 成功，但存在 `icons/icon16.png`、`icons/icon48.png`、`icons/icon128.png` duplicate emitted warning。
  - 当前视为已知 non-blocking warning。
  - 放行前必须记录 warning 存在，不能伪装为“已解决”。
- Playwright 成功结束，但有 2 skipped。
  - 放行前必须人工确认这些 skipped 的影响范围。
  - 未确认前，不应把 E2E 基线写成“完全闭环”。

### 外部依赖验证项

- `npm run verify-apis`
  - 当前因外部网络 / 凭证依赖可被记录为 skipped。
  - 若未执行，只能在受控条件下例外放行，并记录 skipped 原因、触发条件与决策人。
- `npm run smoke:providers`
  - 当前因外部网络 / 凭证依赖可被记录为 skipped。
  - 若未执行，只能在受控条件下例外放行，并记录 skipped 原因、触发条件与决策人。

## 最低放行标准

满足以下条件时，才可视为达到 `partial -> ready` 的最低门槛：

- adoption evaluation 已存在。
- release / rollback SOP 已存在。
- 本次发布对象已明确为 extension、worker 或二者之一。
- 外部依赖验证是否执行过、为何未执行，已被记录。
- rollback owner / decision path 已明确。
- 若含 Durable Objects migration，已做额外确认。

说明：

- 满足上述条件表示“达到最低 ready 门槛”。
- 这不等于 fully complete，也不等于系统已经完全自动化或完全 hardened。

## Extension Release SOP

### 发布前检查

- 仓库内可控：
  - 对照当前 contract、adoption evaluation 与 `docs/05_release_checklist.md`。
  - 核对 `bash scripts/smoke.sh` / `bash scripts/verify.sh` 的结果记录。
  - 确认 build / package 路径是否已知：
    - `npm run build`
    - `npm run package`
    - `npm run release:package`
- 人工确认：
  - 本次 extension 发布是否触及以下谨慎区：
    - `src/manifest.ts`
    - `src/background/`
    - `src/shared/analytics.ts`
    - `src/shared/storage.ts`
    - `src/shared/utils/crypto.ts`
    - `docs/privacy-policy.md`
  - 若涉及权限、隐私披露、storage / crypto、analytics，则必须确认对应披露与回滚路径。
  - 对 2 个 E2E skipped 的影响范围做人工判断并记录。

### 发布动作

- 仓库内可控：
  - 生成并核对本次扩展构建 / 打包输入。
  - 确认准备交付的版本包或提审基线来自当前已知稳定构建路径。
- 人工确认：
  - 扩展包上传、提审、发布属于外部平台步骤，需人工执行与确认。
  - 若外部依赖验证未运行，需要人工决定是否例外放行。

### 发布后验证

- 人工确认以下关键路径是否可用：
  - popup 基本可用
  - 内容脚本关键交互可用
  - 至少一个支持站点上的核心增强流程可用
  - 权限异常未放大
  - analytics / logging 未出现异常放大
  - storage / crypto / 隐私相关行为未出现明显异常

### 失败时进入 rollback

- 若出现权限异常、storage / crypto / 隐私异常、analytics / logging 异常放大，应立即进入 rollback trigger 评估。

## Worker Release SOP

### 发布前检查

- 仓库内可控：
  - 对照当前 contract、adoption evaluation 与 `docs/05_release_checklist.md`。
  - 明确本次是否涉及 worker。
  - 明确本次是否涉及 migration tag 或 Durable Objects migrations。
- 人工确认：
  - 本次 worker 发布是否触及以下谨慎区：
    - `proxy/worker.ts`
    - `proxy/wrangler.toml`
    - `src/shared/trial.ts`
    - `src/shared/free-session.ts`
    - `src/shared/quota-errors.ts`
  - 若涉及 quota / session / anti-abuse / relay 行为，需要更高审慎级别和明确 rollback owner。
- 外部依赖：
  - `wrangler` 环境、secrets、deploy 执行依赖外部环境与凭证。

### 发布动作

- 仓库内可控：
  - 确认本次 Worker 发布基线与目标环境说明已记录。
- 人工确认：
  - `wrangler` deploy 及其对应外部平台动作需人工执行。
  - 若 migration 风险未确认，不应继续推进 worker release。

### 发布后验证

- 人工确认以下项目：
  - `/dashboard` 或 `/v1/slo` 可用性
  - API / provider 行为无明显异常
  - 429 / timeout / quota 相关异常未明显放大
  - session / anti-abuse 行为无异常放大

### 失败时进入 rollback

- 若出现 session / quota / anti-abuse 异常，或 provider / API 行为异常，应立即进入 rollback trigger 评估。

## Post-release Verification

发布后必须检查以下项目，并记录哪些属于仓库内已有证据链、哪些依赖人工观察：

- Extension 侧：
  - popup、内容脚本与核心增强流程
  - 权限异常
  - analytics / logging 异常
  - storage / crypto / 隐私相关异常
- Worker 侧：
  - `/dashboard` 或 `/v1/slo`
  - 429 / timeout / quota 相关异常
  - provider / API 行为异常
- 证据链说明：
  - 仓库内已有证据链包括 `smoke`、`verify`、Vitest、Playwright、`dist/`、dashboard / SLO 线索。
  - 外部发布后的真实流量与平台行为仍依赖人工观察与记录。

## Rollback Triggers

出现以下任一情况，应暂停继续放量并进入 rollback 评估：

- 扩展权限异常。
- session / quota / anti-abuse 异常。
- analytics / logging 异常放大。
- storage / crypto / 隐私相关异常。
- Worker 发布后 API / provider 行为异常。
- Durable Objects migration 风险未确认或确认后不可接受。
- build warning 或 skipped E2E 在上线后表现为真实用户影响。

## Extension Rollback SOP

- 立即停止继续推进当前扩展版本发布。
- 回退到上一个已知稳定的扩展版本包 / 提审基线。
- 人工确认以下内容是否需要同步回退：
  - 权限相关变更
  - storage / crypto 相关变更
  - 隐私披露相关文档
- 记录以下信息：
  - 触发原因
  - 影响范围
  - 决策人
  - 回退目标版本

说明：

- 扩展回退是人工主导回退，不是自动化保证。
- 本文档不伪造商店后台按钮名或审核流细节。

## Worker Rollback SOP

- 立即停止继续推进当前 worker 变更。
- 回退到上一个已知稳定的 worker 部署基线。
- 人工确认以下内容是否需要同步处理：
  - secrets / env
  - migration tag
  - 与 quota / session / anti-abuse 相关的部署边界
- 回退后验证：
  - `/dashboard` 或 `/v1/slo` 是否恢复
  - 关键 API / provider 路径是否恢复
- 记录以下信息：
  - 触发原因
  - 影响范围
  - 决策人
  - 回退目标部署基线

说明：

- Worker 回退不应被表述为总能无损完成。

## Durable Objects / Migration Caution

- 若涉及 `proxy/wrangler.toml` 中的 Durable Objects migrations，不应把 rollback 描述成“总能无损回退”。
- migration 类变更需要更高审慎等级与单独确认。
- 在 migration 风险未确认前，不应把 worker release 判定为 ready。
- 若本次发布包含 migration，应在 contract、PR 描述或发布记录中单独说明风险、批准人与回退限制。

## External Dependency Validation Policy

- `verify-apis` 与 `smoke:providers` 默认属于外部依赖验证。
- 它们被 skipped 时，不自动视为 failure，但也不能写成 pass。
- 若本次发布触及代理、provider、quota、session 或 worker 行为：
  - 未执行外部依赖验证只能作为受控例外放行。
  - 必须记录 skipped 原因、执行前提、批准人与风险说明。
- 若本次发布未触及相关面：
  - 可记录为未执行但不阻断。
  - 仍需诚实记录 skipped 原因。

## Evidence & Record-keeping

每次 release / rollback 至少记录以下信息：

- 相关 contract / evaluation
- 执行过的内部命令与结果
- skipped 的外部验证项与原因
- warning 记录
- 发布对象
- rollback owner / decision path
- 如适用的 migration 结论

推荐记录落点：

- `harness/progress.md`
- 相关 contract / evaluation
- PR 描述或发布说明

说明：

- 本 SOP 不引入新的状态文件。
- 记录必须诚实区分 passed / skipped / warning / 人工确认。

## Ownership / Handoff Notes

- Human Owner 对高风险发布与回滚做最终裁决。
- 执行者不能把本 SOP 当成高风险发布的自动批准。
- 若本次发布触及高风险区域，仍需在 contract 或 PR 描述中补充本次变更特有的回滚步骤。
- 本 SOP 的目标是让 adoption 在发布与回滚认知上满足最低 ready 门槛，而不是宣称整体系统已经 fully production-hardened。
