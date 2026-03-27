---
phase: 5
slug: testability-dead-code-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (built-in) |
| **Config file** | package.json (scripts.test) |
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
| 5-01-01 | 01 | 1 | H1 | unit | `bun test src/__tests__/server.test.ts` | ✅ | ⬜ pending |
| 5-01-02 | 01 | 1 | M2 | unit | `bun test src/__tests__/slack-client.test.ts` | ✅ | ⬜ pending |
| 5-01-03 | 01 | 2 | M3 | unit | `bun test src/__tests__/server.test.ts` | ✅ | ⬜ pending |
| 5-01-04 | 01 | 2 | M9 | unit | `bun test src/__tests__/config.test.ts` | ✅ | ⬜ pending |
| 5-01-05 | 01 | 2 | M10 | unit | `bun test` | ✅ | ⬜ pending |
| 5-01-06 | 01 | 2 | L5,L6 | unit | `bun test src/__tests__/slack-client.test.ts` | ✅ | ⬜ pending |
| 5-01-07 | 01 | 2 | L8 | unit | `bun test src/__tests__/permission.test.ts` | ✅ | ⬜ pending |
| 5-01-08 | 01 | 2 | L11 | unit | `bun test src/__tests__/server.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. All test files exist. No new test infrastructure needed.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
