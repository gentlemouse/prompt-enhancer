# Progress Log

> 这是当前仓库的运行时交接文件。它记录现在做到哪、刚完成什么、下一步最值当做什么。

## Snapshot

- Project: Lynx / Smart Prompt Enhancer
- Current phase: Harness adoption baseline
- Last updated: 2026-03-31
- Owner clue: gentlemouse / mouse 张

## Current baseline

### 已有基础

- 真实业务仓库已具备 `README.md`、`docs/`、`package.json`、锁文件、GitHub Actions CI
- 存在真实工程命令：`dev`、`lint`、`type-check`、`test`、`build`、`test:e2e`
- 存在真实测试与证据链：Vitest、Playwright、coverage、CI artifact、Worker dashboard/SLO
- 存在高风险区域：扩展权限、trial/quota/fingerprint、analytics、storage/crypto、Worker relay

### 本轮接入内容

- 新增 `AGENTS.md`
- 新增 `docs/04_architecture.md`
- 新增 `docs/05_release_checklist.md`
- 新增 `docs/06_harness.md`
- 新增 `harness/feature_registry.json`
- 新增 contract / evaluation 模板
- 新增首个 adoption contract
- 新增 `scripts/smoke.sh` / `scripts/verify.sh`

## Latest change log

### Entry 005 - validation input trim hardening

- Goal: 让共享验证工具在处理复制粘贴的 endpoint / API key 时自动忽略前后空白
- Completed:
  - 新增 contract `harness/contracts/2026-06-06-trim-validation-inputs.md`
  - `validateEndpoint` 在解析 URL 前 trim 输入
  - `validateApiKey` 在长度和 provider 前缀检查前 trim 输入
  - 补充 endpoint、OpenAI key、Anthropic key 的空白输入回归测试
- Open questions:
  - 是否需要在 UI 层展示“已自动去除前后空白”的提示
- Risk notes:
  - 本轮不修改存储、provider 调用、proxy、trial、analytics 或 extension permissions
  - 行为变化仅限前后空白归一化；空白字符串现在返回 empty-field 错误

### Entry 001 - adoption audit + 最小骨架接入

- Goal: 在不修改高风险业务逻辑的前提下，把模板中的最小 harness 骨架实例化到真实仓库
- Completed:
  - 审计真实仓库的命令、目录结构、CI、风险区、发布线索
  - 读取只读模板仓库，并提取 `AGENTS` / architecture / release / harness / scripts 骨架
  - 基于真实仓库事实新增 architecture / release / harness 文档
  - 新增最小 runtime state 与 verify 脚本
  - 创建首个 adoption contract
- Open questions:
  - 是否需要新增独立 evaluation 报告来闭合本轮接入？
  - `verify-apis` 与 `smoke:providers` 在团队流程中应默认何时运行？
  - 是否需要把 rollback SOP 单独沉淀成文档？
- Risk notes:
  - 本轮只接入骨架，不应被误认为已梳理完整发布/回滚体系
  - `scripts/verify.sh` 会尽量运行真实命令，但外部网络/凭证相关检查仍可能被跳过

### Entry 002 - 独立 evaluation 完成

- Goal: 为 `ADOPT-001` 补齐独立验收报告，闭合本轮 harness 接入流程
- Completed:
  - 新增评估报告 `harness/evaluations/2026-03-31-adoption-baseline-evaluation.md`
  - 回写 contract 的 evaluation outcome
  - 复核 `smoke` / `verify` 的真实输出与 skipped 类别
- Open questions:
  - `verify-apis` 与 `smoke:providers` 应该在什么场景下成为默认 gate？
  - `test:e2e` 内部 skipped 用例是否是团队预期基线？
- Risk notes:
  - 独立 evaluation 已完成，但仍不是人工 reviewer 的正式发布批准
  - rollback SOP 仍需单独沉淀

### Entry 003 - adoption evaluation 审计化补齐

- Goal: 把最小 harness 接入状态从“已补 evaluation”升级为可审计 adoption 结论
- Completed:
  - 重写 canonical evaluation 报告，补齐 scope、evidence、warnings、residual risks、decision 与 exit criteria
  - 明确当前 adoption status 为 `partial`
  - 纠偏“evaluation 已完成”与“adoption 已完全闭环”之间的语义差异
- Open questions:
  - extension / Worker 的 release 与 rollback SOP 应如何最小落盘
  - `verify-apis` 与 `smoke:providers` 的受控执行前提应如何定义
  - `test:e2e` 中 2 个 skipped 的长期保留策略是什么
- Risk notes:
  - 当前 `partial` 不表示失败，但也不应被解释为 ready 或 production-ready
  - 下一步仍应聚焦 release / rollback、外部依赖验证策略，以及 skipped / warning 的治理边界

### Entry 004 - release / rollback SOP 补齐

- Goal: 为 extension / Worker 补齐最小可执行的 release 与 rollback SOP
- Completed:
  - 新增 `docs/07_release_rollback_sop.md`
  - 在 `docs/05_release_checklist.md` 增加 SOP 引用与回滚路径核对项
  - 明确当前 adoption 仍为 `partial`，但 `partial -> ready` 的最低门槛已更清晰
- Open questions:
  - `verify-apis` 与 `smoke:providers` 的受控执行前提与批准路径应如何长期固化
  - 哪些发布场景必须把外部依赖验证从“例外放行”升级为默认 gate
- Risk notes:
  - 本轮仅补齐最小 SOP，不代表发布流程已经完全自动化
  - 下一步应优先聚焦外部依赖验证策略，而不是扩展到业务代码改动

## Recommended next 3 contracts

### Contract A - 补独立 evaluation

目标：补一份 evaluator 视角的 adoption 验收报告，闭合首轮 harness 流程。

### Contract B - 明确 release / rollback SOP

目标：把当前扩展包发布、Worker 部署和回滚认知沉淀成更可执行的文档。

### Contract C - 校准高风险功能清单

目标：把 permissions、quota、relay、privacy、analytics 拆成更细的 feature registry 条目。

## Session handoff checklist

下一位执行者开始前，请先：

1. 阅读 `AGENTS.md`
2. 阅读 `docs/04_architecture.md`
3. 阅读 `docs/05_release_checklist.md`
4. 阅读 `docs/06_harness.md`
5. 查看本文件与 `harness/feature_registry.json`
6. 选择现有 contract 或新建 contract
7. 运行 `bash scripts/smoke.sh`

## Blockers

- 当前无阻塞最小 harness 使用的 blocker
- 真正的 blocker 主要会来自外部网络校验、Provider 凭证和发布/回滚流程细节
