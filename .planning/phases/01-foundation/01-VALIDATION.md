---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
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
| 01-01-01 | 01 | 1 | CONF-01 | unit | `bun test src/__tests__/config.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | CONF-02 | unit | `bun test src/__tests__/config.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | CONF-03 | unit | `bun test src/__tests__/config.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | CONF-04 | unit | `bun test src/__tests__/config.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | SLCK-03 | unit | `bun test src/__tests__/slack-client.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | SLCK-04 | unit | `bun test src/__tests__/slack-client.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | SLCK-05 | unit | `bun test src/__tests__/slack-client.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | SLCK-06 | unit | `bun test src/__tests__/slack-client.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-05 | 02 | 1 | SLCK-02 | unit | `bun test src/__tests__/slack-client.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-06 | 02 | 1 | MCP-01 | unit | `bun test src/__tests__/server.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-07 | 02 | 1 | MCP-02 | unit | `bun test src/__tests__/server.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-08 | 02 | 1 | MCP-03 | unit | `bun test src/__tests__/server.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-09 | 02 | 1 | MCP-07 | unit | `bun test src/__tests__/server.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/config.test.ts` — stubs for CONF-01 through CONF-04 (parseConfig, safeErrorMessage)
- [ ] `src/__tests__/slack-client.test.ts` — stubs for SLCK-02 through SLCK-06 (shouldProcessMessage, isDuplicate, logger routing)
- [ ] `src/__tests__/server.test.ts` — stubs for MCP-01 through MCP-03, MCP-07 (capability declaration, instructions, shutdown)
- [ ] `src/__tests__/` directory — does not exist yet; create in Wave 1 task 01-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Startup order: connect before socketMode.start | MCP-05 | Requires live MCP transport + Slack connection | 1. Start server with valid env vars 2. Verify "connected" log appears 3. Verify no stdout before MCP handshake |
| Global error handlers registered | MCP-06 | Requires triggering uncaughtException | 1. Start server 2. Trigger unhandled error 3. Verify stderr log + no crash |
| Socket Mode auto-reconnect | SLCK-01 | Requires network partition test | 1. Start server 2. Kill network 3. Restore 4. Verify reconnection logged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
