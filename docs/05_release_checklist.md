# 05 Release Checklist - Lynx / Prompt Enhancer

> 每次发版前对照当前仓库真实流程核查，不依赖记忆，也不把不存在的流程写成已存在。

## Meta

- Project: Lynx / Smart Prompt Enhancer
- Owner clue: gentlemouse / mouse 张
- Date: 2026-03-31
- Environment: browser extension + Cloudflare Worker
- Related workflow: `.github/workflows/ci.yml`

## 1. 范围确认

- [ ] 本次发布范围与 README / 当前 issue / contract 一致
- [ ] 没有把文档整理、脚本整理和高风险业务逻辑混在一次发布里
- [ ] 影响范围已识别：扩展前端、provider 适配、Worker、商店披露、隐私文档

## 2. 代码质量与验证

- [ ] `bash scripts/smoke.sh`
- [ ] `bash scripts/verify.sh`
- [ ] `npm run test:coverage` 已运行并检查结果
- [ ] `npm run test:e2e` 已运行，或明确记录未运行原因
- [ ] 如涉及代理联调，`npm run verify-apis` 已运行，或明确记录 skipped 原因
- [ ] 如涉及 BYOK provider 变更，`npm run smoke:providers` 已运行，或明确记录 skipped 原因
- [ ] 无明显 debug log、临时代码、临时开关或脏产物

## 3. 高风险项核查

- [ ] `src/manifest.ts` 权限变更已单独 review（如适用）
- [ ] `src/background/` 核心增强逻辑改动已单独 review（如适用）
- [ ] `src/shared/storage.ts` / `utils/crypto.ts` 改动已评估（如适用）
- [ ] `trial / free-session / fingerprint / quota` 改动已评估回归风险（如适用）
- [ ] `proxy/worker.ts` 或 `proxy/wrangler.toml` 改动已检查 secrets、配额与回滚方式（如适用）
- [ ] `analytics`、隐私披露与实现保持一致
- [ ] 未把敏感信息写入日志、截图、录屏或文档

## 4. UI / UX

- [ ] 扩展 popup 关键路径可用
- [ ] 内容脚本按钮、toast、trial prompt 关键交互可用
- [ ] 至少检查一个中文场景和一个英文场景（如适用）
- [ ] 至少检查一个支持站点上的核心增强流程（如适用）

## 5. CI 与产物

- [ ] GitHub Actions `CI` workflow 通过
- [ ] `dist/` 构建成功
- [ ] 如需要共享构建结果，确认 artifact `extension-dist` 已生成
- [ ] 如需本地打包，`npm run package` 或 `npm run release:package` 的使用方式已确认

## 6. 部署与发布

- [ ] 明确本次是否同时涉及扩展包与 Worker
- [ ] 已对照 `docs/07_release_rollback_sop.md` 确认本次发布面、外部人工步骤与回滚路径
- [ ] 如涉及 Worker，已确认 `wrangler` 环境变量 / secrets / migration tag
- [ ] 如涉及商店提审，已同步检查 `docs/store-listing.md` 与隐私披露
- [ ] 如涉及隐私/权限变更，已同步检查 `docs/privacy-policy.md` 与 `docs/chrome-web-store-privacy-remediation.md`

## 7. 回滚认知

- [ ] 扩展版本回滚方式已明确
- [ ] Worker 配置或代码回滚方式已明确
- [ ] 如涉及 Durable Objects / quota 流程变更，已明确是否存在数据/状态回滚限制

说明：

当前最小 release / rollback SOP 见 `docs/07_release_rollback_sop.md`；如本次发布涉及高风险区域，仍需在 contract 或 PR 描述中补充本次变更特有的回滚步骤。

## 8. 发布后观察

- [ ] 如涉及 Worker，检查 `/dashboard` 或 `/v1/slo` 可用性
- [ ] 检查关键错误率、429、timeout、quota 相关指标是否异常
- [ ] 检查扩展核心路径是否可用
- [ ] 记录发布后发现的问题与后续 contract
