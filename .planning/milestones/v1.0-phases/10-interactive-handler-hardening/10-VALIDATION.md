---
phase: 10
slug: interactive-handler-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (built-in) |
| **Config file** | none — Bun test works out of the box |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test --coverage` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | H1 | unit | `bun test` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | M5 | unit | `bun test` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | L1 | unit | `bun test` | ❌ W0 | ⬜ pending |
| 10-01-04 | 01 | 1 | M1 | unit | `bun test` | ❌ W0 | ⬜ pending |
| 10-01-05 | 01 | 1 | M13 | unit | `bun test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/interactive-handler.test.ts` — stubs for H1, M5, M13, L1
- [ ] Zod schema `InteractiveBodySchema` exportable for test validation

*Existing test infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shutdown drains interactive in-flight | M1 | Requires real Socket Mode lifecycle | Start server, trigger permission, shutdown mid-flight, verify no dropped callbacks |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
