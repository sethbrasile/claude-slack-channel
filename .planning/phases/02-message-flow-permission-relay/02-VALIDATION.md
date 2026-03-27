---
phase: 2
slug: message-flow-permission-relay
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (built-in, v1.2+) |
| **Config file** | none — `bun test` auto-discovers `__tests__/*.test.ts` |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test --coverage` |
| **Estimated runtime** | ~3 seconds |

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
| 02-01-01 | 01 | 1 | THRD-01, THRD-02, THRD-03 | unit | `bun test src/__tests__/threads.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | BRDG-01, BRDG-02 | unit | `bun test src/__tests__/channel-bridge.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | PERM-01, PERM-02, PERM-05 | unit | `bun test src/__tests__/permission.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | BRDG-03, PERM-03, PERM-04 | unit+manual | `bun test src/__tests__/server.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/threads.test.ts` — stubs for THRD-01, THRD-02, THRD-03
- [ ] `src/__tests__/channel-bridge.test.ts` — stubs for BRDG-01, BRDG-02
- [ ] `src/__tests__/permission.test.ts` — stubs for PERM-01, PERM-02, PERM-05

*Test content fully specified in `docs/implementation-plan.md` Tasks 4–6.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verdict messages NOT forwarded as channel notifications | PERM-03 | Requires live MCP + Slack integration | Reply `yes xxxxx` to permission prompt; verify Claude does NOT receive it as channel message |
| Permission prompt appears in active thread within 3s | PERM-04 | Timing + threading requires live Slack | Trigger permission request; verify it posts in active thread |
| Full message flow end-to-end | ALL | Requires live Claude Code + Slack | Send message in channel; verify Claude receives notification, reply posts back |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
