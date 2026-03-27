---
phase: 3
slug: testing-ci
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
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
| 03-01-01 | 01 | 1 | TEST-01 | unit | `bun test src/__tests__/slack-client.test.ts` | YES | pending |
| 03-01-02 | 01 | 1 | TEST-02 | unit | `bun test src/__tests__/slack-client.test.ts` | YES | pending |
| 03-01-03 | 01 | 1 | TEST-03 | unit | `bun test src/__tests__/permission.test.ts` | YES | pending |
| 03-01-04 | 01 | 1 | TEST-04 | unit | `bun test src/__tests__/permission.test.ts` | YES | pending |
| 03-01-05 | 01 | 1 | TEST-05 | unit | `bun test src/__tests__/channel-bridge.test.ts` | YES | pending |
| 03-01-06 | 01 | 1 | TEST-06 | unit | `bun test src/__tests__/threads.test.ts` | YES | pending |
| 03-01-07 | 01 | 1 | TEST-07 | unit | `bun test src/__tests__/config.test.ts` | YES | pending |
| 03-01-08 | 01 | 1 | TEST-08 | unit | `bun test src/__tests__/server.test.ts` | YES | pending |
| 03-01-09 | 01 | 1 | TEST-09 | static | `bunx tsc --noEmit` | N/A | pending |
| 03-01-10 | 01 | 1 | TEST-10 | static | `bunx biome check .` | N/A | pending |
| 03-02-01 | 02 | 2 | CICD-01 | integration | GitHub Actions (manual verify) | NO — Wave 0 | pending |
| 03-02-02 | 02 | 2 | CICD-02 | integration | GitHub Actions (manual verify) | NO — Wave 0 | pending |
| 03-02-03 | 02 | 2 | CICD-03 | integration | GitHub Actions (manual verify) | NO — Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `.github/workflows/ci.yml` — covers CICD-01
- [ ] `.github/workflows/release.yml` — covers CICD-02, CICD-03

*All test files already exist. No test framework installation needed. Only CI workflow files are missing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI triggers on push/PR | CICD-01 | Requires GitHub Actions runner | Push a commit or open PR, verify checks appear |
| npm publish with provenance | CICD-02 | Requires NPM_TOKEN secret | Push a v* tag, verify npm package published |
| GitHub Release created | CICD-03 | Requires v* tag push | Push a v* tag, verify release with notes appears |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
