---
phase: 11
slug: cicd-supply-chain-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (built-in) + GitHub Actions YAML validation |
| **Config file** | none — built into bun |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test --coverage && bunx tsc --noEmit && bunx biome check .` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test --coverage && bunx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | H3, M8, M9 | yaml-lint | `bunx tsc --noEmit` | ✅ | ⬜ pending |
| 11-01-02 | 01 | 1 | M6, M7 | yaml-lint | `bunx tsc --noEmit` | ✅ | ⬜ pending |
| 11-02-01 | 02 | 1 | M15 | unit | `bun test src/__tests__/slack-client.test.ts` | ✅ | ⬜ pending |
| 11-02-02 | 02 | 1 | L12 | yaml-lint | `bunx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SHA pins match expected action versions | H3 | Requires external GitHub API | Visually verify SHA comments match action tags |
| Release workflow step ordering | M6, M7 | Structural YAML check | Verify audit → lint → typecheck → test → publish order |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
