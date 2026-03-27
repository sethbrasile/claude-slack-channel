---
phase: 1
slug: foundation
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
validated: 2026-03-27
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test runner (built-in, `bun:test`) |
| **Config file** | None — Bun auto-discovers `*.test.ts` files |
| **Quick run command** | `bun test src/__tests__/` |
| **Full suite command** | `bun test --coverage` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test src/__tests__/`
- **After every plan wave:** Run `bun test --coverage && bunx tsc --noEmit && bunx biome check .`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CONF-01 | unit | `bun test src/__tests__/config.test.ts` | YES | ✅ green |
| 01-01-02 | 01 | 1 | CONF-02 | unit | `bun test src/__tests__/config.test.ts` | YES | ✅ green |
| 01-01-03 | 01 | 1 | CONF-03 | unit | `bun test src/__tests__/config.test.ts` | YES | ✅ green |
| 01-01-04 | 01 | 1 | CONF-04 | unit | `bun test src/__tests__/config.test.ts` | YES | ✅ green |
| 01-01-05 | 01 | 1 | CONF-05 | unit | `bun test src/__tests__/server.test.ts` | YES | ✅ green |
| 01-02-01 | 02 | 1 | SLCK-03 | unit | `bun test src/__tests__/slack-client.test.ts` | YES | ✅ green |
| 01-02-02 | 02 | 1 | SLCK-04 | unit | `bun test src/__tests__/slack-client.test.ts` | YES | ✅ green |
| 01-02-03 | 02 | 1 | SLCK-05 | unit | `bun test src/__tests__/slack-client.test.ts` | YES | ✅ green |
| 01-02-04 | 02 | 1 | SLCK-02 | unit | `bun test src/__tests__/slack-client.test.ts` | YES | ✅ green |
| 01-02-05 | 02 | 1 | MCP-01 | unit | `bun test src/__tests__/server.test.ts` | YES | ✅ green |
| 01-02-06 | 02 | 1 | MCP-02 | unit | `bun test src/__tests__/server.test.ts` | YES | ✅ green |
| 01-02-07 | 02 | 1 | MCP-03 | unit | `bun test src/__tests__/server.test.ts` | YES | ✅ green |
| 01-02-08 | 02 | 1 | MCP-04 | unit | `bun test src/__tests__/server.test.ts` | YES | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/__tests__/config.test.ts` — 15 tests for CONF-01 through CONF-04 (parseConfig, safeErrorMessage)
- [x] `src/__tests__/slack-client.test.ts` — 12 tests for SLCK-02 through SLCK-05 (shouldProcessMessage, isDuplicate, logger routing)
- [x] `src/__tests__/server.test.ts` — 7 tests for MCP-01 through MCP-04, CONF-05 (capability declaration, instructions, reply tool)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Startup order: connect before socketMode.start | MCP-05 | Requires live MCP transport + Slack connection | 1. Start server with valid env vars 2. Verify "connected" log appears 3. Verify no stdout before MCP handshake |
| Global error handlers registered | MCP-06 | Requires triggering uncaughtException | 1. Start server 2. Trigger unhandled error 3. Verify stderr log + no crash |
| Graceful shutdown on SIGTERM/SIGINT/stdin close | MCP-07 | Requires live process signal handling | 1. Start server 2. Send SIGTERM 3. Verify "[shutdown]" on stderr + clean exit |
| Socket Mode auto-reconnect | SLCK-01 | Requires network partition test | 1. Start server 2. Kill network 3. Restore 4. Verify reconnection logged |
| ack() called first in event handler | SLCK-06 | In SocketModeClient closure — integration code | 1. Start server 2. Send Slack message 3. Verify no ack timeout errors |
| unfurl_links: false on outbound messages | SLCK-07 | In server.ts CLI reply tool — integration code | 1. Post message with URL via reply tool 2. Verify no link previews appear |

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
| Requirements COVERED | 13 (automated) |
| Requirements MANUAL | 6 (integration) |
