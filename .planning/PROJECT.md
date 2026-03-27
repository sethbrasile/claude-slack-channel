# claude-slack-channel

## What This Is

An open-source Claude Code Channel MCP server that bridges Claude Code sessions to Slack via Socket Mode for bidirectional interactive control. Designed for unattended automation pipelines where Claude operates autonomously but needs human approval for sensitive tool calls via Slack. Single channel, single operator architecture.

## Core Value

Claude can execute unattended automation pipelines with human-in-the-loop permission relay — operators approve or deny tool calls from Slack without needing terminal access.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] MCP server implementing Channel protocol (`experimental/claude/channel`)
- [ ] Slack Socket Mode connectivity with auto-reconnect
- [ ] Inbound message filtering (channel ID, user allowlist, bot_id, subtype)
- [ ] Message deduplication (at-least-once delivery from Socket Mode)
- [ ] Channel bridge formatting inbound Slack messages as Channel notifications
- [ ] Permission relay: format requests, parse yes/no verdicts, return to Claude
- [ ] Thread tracking state machine (classify messages as replies vs new input)
- [ ] Reply tool for Claude to post messages to Slack
- [ ] Zod-based config validation at startup (token prefixes, user ID format)
- [ ] Biome linting and formatting from day one
- [ ] Full unit test coverage for all pure functions
- [ ] CI pipeline (GitHub Actions: typecheck, lint, test with coverage)
- [ ] npm release workflow with provenance attestation
- [ ] README with comparison to community implementation, acknowledgments
- [ ] Slack app manifest for reproducible setup
- [ ] Manual integration test checklist
- [ ] Contributing guide, changelog, issue templates, examples

### Out of Scope

- Multi-channel support — single `SLACK_CHANNEL_ID` by design, pipelines need deterministic routing
- Multi-user pairing code flow — `ALLOWED_USER_IDS` env var is sufficient for automation operators
- Rich tool surface (react, edit_message, fetch_messages, download_attachment) — focused `reply` only
- File exfiltration guard — noted in research as potential future enhancement
- Integration tests against real Slack API — manual testing covers this for v1

## Context

- **GitHub:** sethbrasile/claude-slack-channel (public repo, personal account)
- **Protocol:** Claude Code Channel protocol (`experimental/claude/channel`), requires Claude Code v2.1.80+
- **Reference implementations:** Anthropic's official Telegram/Discord plugins (Bun, flat structure, pairing code flow) and jeremylongshore/claude-code-slack-channel (community, multi-channel, rich tools)
- **Research:** 9 critical gaps identified and resolved in implementation plan (stdout corruption, startup ordering, bot_id filtering, graceful shutdown, dedup, unfurl suppression, etc.)
- **Known protocol issues:** Notifications can be silently undelivered with multiple MCP servers; meta keys with hyphens silently dropped

## Constraints

- **Runtime:** Bun (>=1.2.0) — TypeScript runs directly, no compilation step
- **Transport:** stdio only — MCP servers are spawned as subprocesses by Claude Code
- **stdout:** Sacred after `server.connect()` — all logging must use `console.error()` (stderr)
- **Startup order:** `server.connect(transport)` must complete before `socketMode.start()`
- **Meta keys:** Underscores only — hyphens silently dropped by Channel protocol
- **Ack timing:** Slack requires event acknowledgment within 3 seconds

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Socket Mode over HTTP | No public URL needed, works through NAT/firewalls, pre-authenticated WebSocket | — Pending |
| Biome over ESLint | Single binary for formatting + linting, no plugin chain, faster | — Pending |
| Zod for config validation | Typed output, prefix validation, clear error messages vs ad-hoc string checks | — Pending |
| Single `reply` tool only | Focused scope for automation pipelines; rich tools are out of scope | — Pending |
| `@types/bun` over `bun-types` | Current official recommendation; auto-loaded by TypeScript | — Pending |
| Pure function extraction for testability | `shouldProcessMessage`, `parsePermissionReply`, `formatPermissionRequest` etc. are pure functions testable without mocking | — Pending |

---
*Last updated: 2026-03-26 after initialization*
