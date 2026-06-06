# Contract - Trim validation inputs

## Meta

- Contract ID: VALIDATION-001
- Title: Trim endpoint and API key validation inputs
- Type: bug
- Status: ready_for_evaluation
- Priority: P2
- Autonomy: green
- Owner: gentlemouse
- Planner: Codex
- Executor: Codex
- Evaluator: pending
- Created at: 2026-06-06
- Target branch / environment: `codex/trim-validation-inputs`
- Related issue / PR / feature ID: PR pending

## Why now

Users often paste API keys or custom endpoints with accidental leading/trailing whitespace. The popup already trims before saving, but the shared validation utility should be resilient wherever it is reused.

## Source docs

- README: `README.md`
- Architecture: `docs/04_architecture.md`
- Release checklist: `docs/05_release_checklist.md`
- Harness: `docs/06_harness.md`

## In scope

- Normalize leading/trailing whitespace in `validateEndpoint`.
- Normalize leading/trailing whitespace in `validateApiKey`.
- Add Vitest coverage for whitespace-padded endpoints and provider keys.
- Update harness progress and feature registry.

## Out of scope

- Changing provider-specific key formats.
- Changing custom endpoint security rules.
- Changing popup storage or API key persistence behavior.
- Changing proxy, quota, trial, analytics, or extension permissions.

## Touched paths

- `src/shared/utils/validation.ts`
- `tests/validation.test.ts`
- `harness/contracts/2026-06-06-trim-validation-inputs.md`
- `harness/progress.md`
- `harness/feature_registry.json`

## Acceptance criteria

- Whitespace-only endpoint input returns the empty endpoint validation error.
- HTTPS endpoint input with surrounding whitespace validates successfully.
- OpenAI and Anthropic API keys with surrounding whitespace validate successfully.
- Existing endpoint protocol, local/private IP, path, and provider prefix checks continue to pass.

## How verified

### Commands

```bash
npm run test -- tests/validation.test.ts
bash scripts/smoke.sh
bash scripts/verify.sh
```

### Manual checks

- [x] Diff review confirms no high-risk module changes.
- [x] Popup already trims before save, so this change hardens shared validation reuse rather than changing stored values.
- [ ] Evaluator / maintainer review.

## Risk / rollback

### Main risks

- Inputs that previously failed due only to surrounding whitespace now pass after normalization.
- Whitespace-only inputs now return the empty-field error instead of the generic invalid URL error.

### Rollback

- Revert this PR to restore previous validation behavior.
- No config, data, storage, proxy, or migration rollback is required.

## Docs that must be updated

- [ ] `AGENTS.md`
- [ ] `docs/04_architecture.md`
- [ ] `docs/05_release_checklist.md`
- [ ] `docs/06_harness.md`
- [x] `harness/progress.md`
- [x] `harness/feature_registry.json`

## Handoff note for Executor

Keep the change limited to shared validation normalization and tests. Do not expand into storage, provider calls, or popup persistence behavior.

## Evaluation outcome

- Result: pending
- Report path:
- Follow-up needed: maintainer review after PR opens
