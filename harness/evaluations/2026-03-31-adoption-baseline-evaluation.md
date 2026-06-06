# Adoption Evaluation - Minimal Harness Adoption Baseline

> 本报告将当前仓库“最小、非侵入式 harness 接入”的口头状态落为可审计结论。它确认最小接入已成功，但不把当前状态表述为完全闭环或 production-ready。

## Title / Metadata

- Evaluation ID: EVAL-ADOPT-001
- Title: First adoption evaluation for minimal harness adoption
- Canonical report: `harness/evaluations/2026-03-31-adoption-baseline-evaluation.md`
- Related contract: `harness/contracts/2026-03-31-adoption-baseline.md`
- Evaluator: Codex
- Date: 2026-03-31
- Result: partial

## Scope

- 仅覆盖最小、非侵入式 harness 接入是否已经落地并具备基础可用性。
- 覆盖对象限于 harness 文档、runtime state、验证脚本与相应证据记录。
- 不覆盖 `src/`、`proxy/`、`tests/` 的业务逻辑正确性审查。
- 不覆盖外部 provider 联调闭环，也不把完整 release / rollback 治理视为已完成。

## Inputs Reviewed

- `AGENTS.md`
- `docs/04_architecture.md`
- `docs/05_release_checklist.md`
- `docs/06_harness.md`
- `harness/progress.md`
- `harness/feature_registry.json`
- `harness/evaluations/evaluation_template.md`
- `harness/contracts/2026-03-31-adoption-baseline.md`
- `scripts/smoke.sh`
- `scripts/verify.sh`

## Execution Evidence

- `bash scripts/smoke.sh` 成功。
- `smoke.sh` 实际执行：
  - `npm run lint`
  - `npm run type-check`
- `bash scripts/verify.sh` 成功。
- `verify.sh` 实际执行：
  - `npm run test`
  - `npm run build`
  - `npm run test:e2e`
- Vitest 结果：24 个 test files、230 个 tests，全部通过。
- Build 结果：构建成功，但存在 `icons/icon16.png`、`icons/icon48.png`、`icons/icon128.png` duplicate emitted warning。
- Playwright 结果：`npm run test:e2e` 成功结束，但有 2 skipped。
- 可选外部验证结果：
  - `npm run verify-apis` 为 skipped。
  - `npm run smoke:providers` 为 skipped。
- 上述 skipped 的原因均为外部网络 / 凭证依赖，不应视为 pass，也不应表述为已解决。

## What Passed

- 最小 harness 接入已经落地，且未扩展到业务代码、高风险逻辑、CI 或 README 修改。
- 真实命令映射存在且验证入口可用：
  - `bash scripts/smoke.sh`
  - `bash scripts/verify.sh`
- `smoke` 主路径成功，覆盖了 `lint` 与 `type-check`。
- `verify` 主路径成功，覆盖了 `test`、`build` 与 `test:e2e`。
- 文档与 harness 状态文件已能承载独立 evaluator 结论。

## What Was Intentionally Skipped

- `npm run verify-apis`
  - 受控跳过，原因是依赖外部网络 / 凭证。
  - 当前不计为 pass，也不计为 failure。
- `npm run smoke:providers`
  - 受控跳过，原因是依赖外部网络 / 凭证。
  - 当前不计为 pass，也不计为 failure。

## Known Warnings / Non-blocking Findings

- `npm run build` 虽成功，但存在 `icons/icon16.png`、`icons/icon48.png`、`icons/icon128.png` duplicate emitted warning。
- `npm run test:e2e` 虽成功结束，但当前基线中有 2 个 skipped。
- 旧版 evaluator 报告已存在，但其结构不足以支撑本次 adoption 审计；本次已补齐为可审计版本，后续仍需持续按同一标准维护。

## Residual Risks

- 外部网络 / 凭证相关验证尚未闭环，当前无法把 adoption 结论提升为 ready。
- release / rollback SOP 仍不够明确，尤其是 extension / Worker 维度的回滚操作边界仍需单独沉淀。
- E2E 中 2 个 skipped 的意图、保留条件与长期策略尚未形成稳定说明。

## Adoption Status

- Status: `partial`
- `partial` 不是失败。
- 当前结论是：最小接入成功，但不是完全闭环。
- 这里的 `partial` 反映的是 adoption readiness，而不是否定已经完成的最小 harness 接入成果。

## Decision

- Decision: accept minimal adoption as partial
- Supplement: adoption accepted with documented gaps
- 本报告不将当前状态表述为 `complete`、`fully complete` 或 `production-ready`。

## Required Next Actions

- 补 extension / Worker 的 release 与 rollback SOP，至少明确发版入口、回滚触发条件与最小回退步骤。
- 为 `verify-apis` / `smoke:providers` 定义受控执行前提，明确所需凭证、网络条件与推荐触发时机。
- 为 build duplicate emitted warning 建立跟踪策略，明确是接受为已知 warning、还是进入后续 contract 处理。
- 为 `test:e2e` 中 2 个 skipped 补充说明，记录其原因、允许保留的条件与后续复核节点。

## Exit Criteria to Move from Partial -> Ready

- release / rollback SOP 已文档化，并能支撑 extension / Worker 的最小回滚认知。
- 外部依赖验证具备受控执行前提，并至少完成一次可复现的执行记录。
- build duplicate emitted warning 已有明确处置结论或接受依据。
- E2E skipped 已有明确解释，并被团队接受为基线或已进入后续处理计划。

## Evaluator Notes

- 本报告的作用是把 adoption 状态从口头描述转成可审计结论。
- 它确认“最小接入成功”，但不扩大为对产品功能、隐私、quota、storage、proxy 或发布准备度的完整批准。
- `harness/contracts/2026-03-31-adoption-baseline.md` 中的执行完成语义不应被直接等同为 adoption fully closed；就 adoption readiness 而言，应以本报告中的 `partial` 结论为准。
