# claude-slack-channel

## What This Is

An open-source Claude Code Channel MCP server that bridges Claude Code sessions to Slack via Socket Mode for bidirectional interactive control. Operators approve or deny tool calls from Slack — no terminal access needed. Single channel, single operator architecture. Ships as an npm package (`bunx claude-slack-channel`).

## Core Value

Claude can execute unattended automation pipelines with human-in-the-loop permission relay — operators approve or deny tool calls from Slack without needing terminal access.

## Requirements

### Validated

- ✓ MCP server implementing Channel protocol (`experimental/claude/channel`) — v1.0
- ✓ Slack Socket Mode connectivity with auto-reconnect — v1.0
- ✓ Inbound message filtering (channel ID, user allowlist, bot_id, subtype) — v1.0
- ✓ Message deduplication (at-least-once delivery from Socket Mode) — v1.0
- ✓ Channel bridge formatting inbound Slack messages as Channel notifications — v1.0
- ✓ Permission relay: format requests, parse yes/no verdicts, return to Claude — v1.0
- ✓ Interactive button-based permission approval — v1.0
- ✓ Thread tracking state machine (classify messages as replies vs new input) — v1.0
- ✓ Reply tool for Claude to post messages to Slack — v1.0
- ✓ Zod-based config validation at startup (token prefixes, user ID format) — v1.0
- ✓ Biome linting and formatting — v1.0
- ✓ 135 unit tests covering all pure functions — v1.0
- ✓ CI pipeline (GitHub Actions: typecheck, lint, test with coverage) — v1.0
- ✓ npm release workflow with provenance attestation — v1.0
- ✓ Supply chain hardening (SHA-pinned actions, audit gates, token scrubbing) — v1.0
- ✓ README with comparison to community implementation, acknowledgments — v1.0
- ✓ Slack app manifest for reproducible setup — v1.0
- ✓ Contributing guide, changelog, issue templates, examples — v1.0

### Active

(None — define with `/gsd:new-milestone`)

### Out of Scope

- Multi-channel support — single `SLACK_CHANNEL_ID` by design, pipelines need deterministic routing
- Multi-user pairing code flow — `ALLOWED_USER_IDS` env var is sufficient for automation operators
- Rich tool surface (react, edit_message, fetch_messages, download_attachment) — focused `reply` only; rich tools increase attack surface
- File exfiltration guard — noted in research as potential future enhancement
- Integration tests against real Slack API — manual testing covers this for v1
- Typing indicators — adds round-trip for every inbound; automation pipelines don't benefit
- `reply_broadcast: true` — adds noise; strips some message attachments

## Context

- **GitHub:** sethbrasile/claude-slack-channel (public repo, personal account)
- **Protocol:** Claude Code Channel protocol (`experimental/claude/channel`), requires Claude Code v2.1.80+
- **npm:** `claude-slack-channel` (published with provenance attestation)
- **Tech stack:** TypeScript, Bun (>=1.2.0), `@modelcontextprotocol/sdk`, `@slack/socket-mode` + `@slack/web-api`, Zod, Biome
- **Codebase:** ~2,400 LOC TypeScript, 135 tests, 13 source files
- **Reference implementations:** Anthropic's official Telegram/Discord plugins (Bun, flat structure, pairing code flow) and jeremylongshore/claude-code-slack-channel (community, multi-channel, rich tools)
- **Known protocol issues:** Notifications can be silently undelivered with multiple MCP servers; meta keys with hyphens silently dropped
- **Tech debt (v1.0):** 3 minor items — example version pin staleness, README test count, orphaned exports

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
| Socket Mode over HTTP | No public URL needed, works through NAT/firewalls, pre-authenticated WebSocket | ✓ Good — zero infrastructure beyond Slack app |
| Biome over ESLint | Single binary for formatting + linting, no plugin chain, faster | ✓ Good — simpler toolchain |
| Zod for config validation | Typed output, prefix validation, clear error messages vs ad-hoc string checks | ✓ Good — caught real config errors early |
| Single `reply` tool only | Focused scope for automation pipelines; rich tools are out of scope | ✓ Good — clean attack surface |
| `@types/bun` over `bun-types` | Current official recommendation; auto-loaded by TypeScript | ✓ Good |
| Pure function extraction for testability | All core logic testable without mocking SDK internals | ✓ Good — 135 tests with no Slack API mocks |
| wireHandlers composition root | Single handler registration point for both CLI and library paths | ✓ Good — eliminated duplication, enabled testing |
| Interactive buttons for permissions | Better UX than text-only `yes/no {id}` replies | ✓ Good — both text and button paths work |
| SHA-pinned GitHub Actions | Immutable references prevent supply chain attacks via mutable tags | ✓ Good — defense in depth |
| `npm publish --provenance` over `bun publish` | bun publish lacks provenance attestation | ✓ Good — supply chain transparency |

---
*Last updated: 2026-03-29 after v1.0 milestone*
