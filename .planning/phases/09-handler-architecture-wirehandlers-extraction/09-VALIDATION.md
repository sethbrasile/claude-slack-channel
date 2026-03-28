---
phase: 9
slug: handler-architecture-wirehandlers-extraction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (built-in) |
| **Config file** | none — built into bun |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test --coverage && bunx tsc --noEmit` |
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
| 09-01-01 | 01 | 1 | H2 | unit | `bun test src/__tests__/server.test.ts` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | M2 | unit | `bun test src/__tests__/server.test.ts` | ✅ | ⬜ pending |
| 09-01-03 | 01 | 1 | M3 | unit | `bun test src/__tests__/permission.test.ts` | ✅ | ⬜ pending |
| 09-01-04 | 01 | 1 | M14 | type | `bunx tsc --noEmit` | ✅ | ⬜ pending |
| 09-01-05 | 01 | 1 | L7 | review | `bun test` | ✅ | ⬜ pending |
| 09-01-06 | 01 | 1 | L8 | type | `bunx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| L7: formatPermissionRequest export scope review | L7 | Design decision | Verify comment explains export-for-testability rationale |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
