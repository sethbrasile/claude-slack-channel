---
phase: 7
slug: config-security-tightening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (built-in) |
| **Config file** | package.json (no separate config) |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test && bunx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test && bunx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | M4 | unit | `bun test src/__tests__/config.test.ts` | ✅ | ⬜ pending |
| 7-01-02 | 01 | 1 | L9 | unit | `bun test src/__tests__/config.test.ts` | ✅ | ⬜ pending |
| 7-01-03 | 01 | 1 | M5 | unit | `bun test` | ✅ | ⬜ pending |
| 7-01-04 | 01 | 1 | M6 | unit | `bun test src/__tests__/permission.test.ts` | ✅ | ⬜ pending |
| 7-01-05 | 01 | 1 | M8 | type-check | `bunx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed — only additions to existing test files.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
