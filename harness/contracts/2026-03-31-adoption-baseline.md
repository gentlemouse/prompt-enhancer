# Contract - Adoption Baseline

## Meta

- Contract ID: ADOPT-001
- Title: 为 Lynx 仓库接入最小 harness 骨架
- Type: docs
- Status: passed
- Priority: P0
- Autonomy: yellow
- Owner: gentlemouse
- Planner: Codex
- Executor: Codex
- Evaluator: Codex
- Created at: 2026-03-31
- Target branch / environment: local working tree
- Related issue / PR / feature ID: ADOPT-001

## Why now

当前仓库已有完整业务代码、CI 和验证命令，但缺少统一的 AGENTS / architecture / release / harness 运行层。先完成最小骨架接入，可以让后续 AI / 人类协作围绕真实项目事实工作，而不是围绕模板假设工作。

## Source docs

- README: `README.md`
- Architecture: `docs/04_architecture.md`
- Release checklist: `docs/05_release_checklist.md`
- Harness: `docs/06_harness.md`

## In scope

- [x] 对真实仓库执行 adoption audit
- [x] 新增最小 durable context 与 runtime state 文件
- [x] 建立统一的 `smoke.sh` / `verify.sh`
- [x] 创建首个 adoption contract

## Out of scope

- [x] 不修改业务代码与高风险逻辑
- [x] 不重写 README、CI 或隐私文档
- [x] 不补完整 release / rollback SOP

## Touched paths

- `AGENTS.md`
- `docs/04_architecture.md`
- `docs/05_release_checklist.md`
- `docs/06_harness.md`
- `harness/`
- `scripts/`

## Acceptance criteria

- [x] 新增文件均基于真实仓库事实实例化
- [x] 不把不存在的命令、目录或验证结果写成已存在
- [x] `bash scripts/smoke.sh` 与 `bash scripts/verify.sh` 可运行

## How verified

### Commands

```bash
bash scripts/smoke.sh
bash scripts/verify.sh
```

### Manual checks

- [x] 对照当前仓库与只读模板仓库逐项比对
- [x] 检查真实命令名、CI 入口与高风险区域映射
- [x] 独立 evaluation 报告已补充

## Risk / rollback

### 主要风险

- 文档或脚本误写真实命令名
- verify 误把外部网络/凭证验证写成默认已通过

### 回滚方案

- 代码回滚：删除本次新增的 docs / harness / scripts / AGENTS 文件
- 配置回滚：无
- 数据回滚（如适用）：不适用

## Docs that must be updated

- [x] `AGENTS.md`
- [x] `docs/04_architecture.md`
- [x] `docs/05_release_checklist.md`
- [x] `docs/06_harness.md`
- [x] `harness/progress.md`
- [x] `harness/feature_registry.json`

## Handoff note for Executor

本轮仅允许接入文档、状态文件和验证脚本，不要顺手改 `src/` 或 `proxy/` 的高风险逻辑。

## Evaluation outcome

- Result: pass
- Report path: `harness/evaluations/2026-03-31-adoption-baseline-evaluation.md`
- Follow-up needed: 明确 release / rollback SOP，并确认外部网络校验在团队流程中的默认 gate
