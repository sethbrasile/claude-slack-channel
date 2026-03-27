---
phase: 2
slug: message-flow-permission-relay
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
validated: 2026-03-27
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
| 02-01-01 | 01 | 1 | THRD-01, THRD-02, THRD-03 | unit | `bun test src/__tests__/threads.test.ts` | YES | ✅ green |
| 02-01-02 | 01 | 1 | BRDG-01, BRDG-02 | unit | `bun test src/__tests__/channel-bridge.test.ts` | YES | ✅ green |
| 02-02-01 | 02 | 1 | PERM-01, PERM-02, PERM-05 | unit | `bun test src/__tests__/permission.test.ts` | YES | ✅ green |
| 02-02-02 | 02 | 1 | BRDG-03, PERM-03, PERM-04 | manual | — | N/A | ✅ manual-only |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/__tests__/threads.test.ts` — 8 tests for THRD-01, THRD-02, THRD-03
- [x] `src/__tests__/channel-bridge.test.ts` — 4 tests for BRDG-01, BRDG-02
- [x] `src/__tests__/permission.test.ts` — 15 tests for PERM-01, PERM-02, PERM-05

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reply tool posts to Slack and returns `{ content: [{ type: 'text', text: 'sent' }] }` | BRDG-03 | Requires live Slack Web API connection | 1. Start server with valid env 2. Trigger reply tool call 3. Verify message appears in Slack channel |
| Verdict messages NOT forwarded as channel notifications | PERM-03 | Requires live MCP + Slack integration | Reply `yes xxxxx` to permission prompt; verify Claude does NOT receive it as channel message |
| Permission prompt appears in active thread | PERM-04 | Threading requires live Slack | Trigger permission request; verify it posts in active thread |
| Full message flow end-to-end | ALL | Requires live Claude Code + Slack | Send message in channel; verify Claude receives notification, reply posts back |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
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
| Requirements COVERED | 8 (automated) |
| Requirements MANUAL | 3 (integration) |
