---
phase: 14
slug: test-coverage-gaps
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 14 — Validation Strategy

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
| 14-01-01 | 01 | 1 | M4 | unit | `bun test` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | M10 | unit | `bun test` | ✅ | ⬜ pending |
| 14-01-03 | 01 | 1 | M11 | unit | `bun test` | ✅ | ⬜ pending |
| 14-01-04 | 01 | 1 | M12 | unit | `bun test` | ❌ W0 | ⬜ pending |
| 14-01-05 | 01 | 1 | L2 | unit | `bun test` | ❌ W0 | ⬜ pending |
| 14-01-06 | 01 | 1 | L3 | unit | `bun test` | ❌ W0 | ⬜ pending |
| 14-01-07 | 01 | 1 | L4 | unit | `bun test` | ❌ W0 | ⬜ pending |
| 14-01-08 | 01 | 1 | L5 | unit | `bun test` | ✅ | ⬜ pending |
| 14-01-09 | 01 | 1 | L9 | unit | `bun test` | ❌ W0 | ⬜ pending |
| 14-01-10 | 01 | 1 | L10 | unit | `bun test` | ✅ | ⬜ pending |
| 14-01-11 | 01 | 1 | L11 | unit | `bun test` | ✅ | ⬜ pending |
| 14-01-12 | 01 | 1 | L15-L20 | unit | `bun test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New test stubs for empty-string guard, TTL dedup, seenTs cap, broadcast mentions, userId validation, forced-exit timeout, bin entry point
- [ ] Source changes: seenTs cap (L2), broadcast mention expansion (L3), userId validation (L4), forced-exit timeout (L9), examples/ exclusion (L11)

*Existing test infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Forced-exit timeout fires | L9 | Requires hanging `server.close()` | Mock server.close to never resolve, verify process.exit called after timeout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
