---
phase: 6
slug: shutdown-lifecycle-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (bun:test) |
| **Config file** | package.json (bun test) |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | M1 (shutdown guard) | unit | `bun test src/__tests__/server.test.ts` | ✅ | ⬜ pending |
| 6-01-02 | 01 | 1 | M1 (queue capture) | unit | `bun test src/__tests__/server.test.ts` | ✅ | ⬜ pending |
| 6-01-03 | 01 | 1 | L1 (ts logging) | unit | `bun test src/__tests__/slack-client.test.ts` | ✅ | ⬜ pending |
| 6-01-04 | 01 | 1 | L1 (no seenTs pollution) | unit | `bun test src/__tests__/slack-client.test.ts` | ✅ | ⬜ pending |
| 6-01-05 | 01 | 1 | All | regression | `bun test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed — changes are additive to existing `server.test.ts` and `slack-client.test.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Second SIGTERM is a no-op with log | M1 | Process signal timing | Send SIGTERM twice rapidly; observe only one `[shutdown]` log line |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
