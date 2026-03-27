---
phase: 3
slug: testing-ci
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
validated: 2026-03-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (built-in, Bun v1.3.6) |
| **Config file** | `bunfig.toml` (minimal — `saveTextLockfile` only) |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test --coverage` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test --coverage && bunx tsc --noEmit && bunx biome check .`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | TEST-01 | unit | `bun test src/__tests__/slack-client.test.ts` | YES | ✅ green |
| 03-01-02 | 01 | 1 | TEST-02 | unit | `bun test src/__tests__/slack-client.test.ts` | YES | ✅ green |
| 03-01-03 | 01 | 1 | TEST-03 | unit | `bun test src/__tests__/permission.test.ts` | YES | ✅ green |
| 03-01-04 | 01 | 1 | TEST-04 | unit | `bun test src/__tests__/permission.test.ts` | YES | ✅ green |
| 03-01-05 | 01 | 1 | TEST-05 | unit | `bun test src/__tests__/channel-bridge.test.ts` | YES | ✅ green |
| 03-01-06 | 01 | 1 | TEST-06 | unit | `bun test src/__tests__/threads.test.ts` | YES | ✅ green |
| 03-01-07 | 01 | 1 | TEST-07 | unit | `bun test src/__tests__/config.test.ts` | YES | ✅ green |
| 03-01-08 | 01 | 1 | TEST-08 | unit | `bun test src/__tests__/server.test.ts` | YES | ✅ green |
| 03-01-09 | 01 | 1 | TEST-09 | static | `bunx tsc --noEmit` | N/A | ✅ green |
| 03-01-10 | 01 | 1 | TEST-10 | static | `bunx biome check .` | N/A | ✅ green |
| 03-02-01 | 02 | 2 | CICD-01 | integration | `.github/workflows/ci.yml` | YES | ✅ manual-only |
| 03-02-02 | 02 | 2 | CICD-02 | integration | `.github/workflows/release.yml` | YES | ✅ manual-only |
| 03-02-03 | 02 | 2 | CICD-03 | integration | `.github/workflows/release.yml` | YES | ✅ manual-only |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `.github/workflows/ci.yml` — covers CICD-01 (push/PR triggered CI)
- [x] `.github/workflows/release.yml` — covers CICD-02 (npm publish with provenance), CICD-03 (GitHub Release)

*All test files existed from prior phases. CI workflow files created in plan 03-02.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI triggers on push/PR | CICD-01 | Requires GitHub Actions runner | Push a commit or open PR, verify checks appear |
| npm publish with provenance | CICD-02 | Requires NPM_TOKEN secret + v* tag | Push a v* tag, verify npm package published |
| GitHub Release created | CICD-03 | Requires v* tag push | Push a v* tag, verify release with notes appears |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated

## Validation Audit 2026-03-27

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tests passing | 64 (full suite) |
| Requirements COVERED | 10 (automated + static) |
| Requirements MANUAL | 3 (GitHub Actions) |
