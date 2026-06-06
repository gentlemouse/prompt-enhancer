# 06 Harness - Lynx / Prompt Enhancer

> 本文件定义当前真实仓库如何使用 harness 做事实管理、任务收敛、验证与交接。它是对现有工程流程的补充，不替代 CI、测试和发布流程。

## Meta

- Project: Lynx / Smart Prompt Enhancer
- Repository: `gentlemouse/prompt-enhancer`
- Last updated: 2026-03-31
- Status: active

## 1. Harness 目标

本仓库引入 harness 的目标：

- 让 AI / 人类协作时有稳定的 durable context
- 把“这轮到底做什么、不做什么、怎么验收”落到文件里
- 把文档、脚本、验证和风险边界对齐到真实仓库事实
- 避免在高风险模块上无计划地扩 scope

## 2. Source of truth 分层

### Layer A - Durable context

- `README.md`
- `AGENTS.md`
- `docs/04_architecture.md`
- `docs/05_release_checklist.md`
- `docs/06_harness.md`
- 现有产品/隐私/专项文档

### Layer B - Runtime state

- `harness/progress.md`
- `harness/feature_registry.json`
- `harness/contracts/*.md`
- `harness/evaluations/*.md`

冲突处理原则：

1. 先暂停扩大改动范围
2. 在 `harness/progress.md` 记录冲突
3. 需要时回写 architecture / release / harness 文档
4. 未经确认，不改变产品意图或高风险逻辑

## 3. 角色分工

### Human Owner

- 决定优先级
- 审批高风险范围
- 对发布、隐私、权限、quota/relay 改动做最终裁决

### Planner

- 读取文档与当前 harness 状态
- 产出本轮 contract
- 明确范围、风险、回滚与验证方式

### Executor

- 只执行 contract 范围内的增量工作
- 优先使用真实命令，不发明命令名
- 完成后更新 `progress.md` 与 `feature_registry.json`
- 不能单方面宣布“已完成但未验证”

### Evaluator

- 与 executor 分离
- 独立检查 contract 验收项、脚本输出与风险边界
- 对高风险区域关注权限、配额、隐私、relay、发布影响

## 4. 自治等级

### Green

适用：

- 文档
- harness 文件
- 验证脚本
- 低风险测试代码

要求：

- 至少跑 `bash scripts/smoke.sh`
- 更新 progress / feature registry

### Yellow

适用：

- 一般业务逻辑变更
- 多文件改动
- 真实命令接线、测试接线、CI 对齐

要求：

- 先有 contract
- 完成后跑 `bash scripts/verify.sh`
- evaluator 独立复核更佳

### Red

适用：

- `src/manifest.ts`
- `src/background/`
- `src/shared/storage.ts`
- `src/shared/utils/crypto.ts`
- `src/shared/trial.ts`
- `src/shared/free-session.ts`
- `src/shared/analytics.ts`
- `proxy/worker.ts`
- `proxy/wrangler.toml`

要求：

- Human Owner 批准范围
- contract 中写清 rollback
- 不一次性大改
- 发布前对照 `docs/05_release_checklist.md`

## 5. 标准流程

### Step 1 - Planning

contract 至少包含：

- Why now
- In scope / Out of scope
- Touched paths
- Acceptance criteria
- How verified
- Risk / rollback

### Step 2 - Preflight

执行前至少完成：

1. 阅读 `AGENTS.md`
2. 阅读 `README.md`、`docs/04_architecture.md`、`docs/05_release_checklist.md`、`docs/06_harness.md`
3. 阅读 `harness/progress.md`、`harness/feature_registry.json`
4. 运行 `bash scripts/smoke.sh`

### Step 3 - Execution

- 一次只做一个 contract 的范围
- 不因为“顺手”改高风险逻辑
- 如发现真实命令或流程与文档冲突，先更新文档再继续

### Step 4 - Verification

#### Executor self-check

- 运行 `bash scripts/verify.sh`
- 记录哪些验证是 passed / failed / skipped
- 只对不存在、需要网络凭证或显式被关闭的验证写 `skipped`

#### Independent evaluation

Evaluator 重点看：

- contract 是否收敛
- verify 输出是否诚实
- 是否错误宣称已跑过不存在的命令
- 是否误碰高风险逻辑

## 6. Definition of Done

只有同时满足以下条件，任务才算 done：

1. contract 范围内内容已交付
2. 验证步骤可复现
3. `harness/progress.md` 已更新
4. `harness/feature_registry.json` 已更新
5. 涉及的 durable context 已同步
6. 没有夸大验证结果

## 7. 当前仓库的 verify 约定

`bash scripts/smoke.sh`：

- 检查关键 harness / docs 文件存在
- 运行轻量级真实命令映射

`bash scripts/verify.sh`：

- 先调用 `smoke.sh`
- 再运行仓库中真实存在的核心验证命令
- 对需要网络、凭证或外部环境的验证明确标记 `skipped`

当前仓库真实命令映射：

- lint → `npm run lint`
- typecheck → `npm run type-check`
- test → `npm run test`
- build → `npm run build`
- e2e → `npm run test:e2e`

可选外部验证：

- API verify → `npm run verify-apis`
- provider smoke → `npm run smoke:providers`

## 8. 产物要求

接入后的最小 runtime state 应保持：

- `harness/progress.md`
- `harness/feature_registry.json`
- `harness/contracts/contract_template.md`
- `harness/evaluations/evaluation_template.md`
- 至少一个真实 contract
