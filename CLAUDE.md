# claude-slack-channel

Open-source Claude Code Channel MCP server for Slack. Bridges Claude Code sessions to Slack channels via Socket Mode for bidirectional interactive control.

## Tech Stack

- TypeScript, Bun runtime
- `@modelcontextprotocol/sdk` — MCP server framework
- `@slack/socket-mode` + `@slack/web-api` — Slack connectivity
- `zod` — config validation and Channel protocol notification schemas
- `@biomejs/biome` — linting and formatting

## Architecture

Single-purpose MCP server implementing the Claude Code Channel protocol (`experimental/claude/channel`). Runs as a stdio subprocess spawned by Claude Code.

**Inbound (Slack → Claude):** Socket Mode receives messages, filters by channel ID + sender allowlist + bot_id, deduplicates by ts, forwards as `notifications/claude/channel` notifications.

**Outbound (Claude → Slack):** Claude calls the `reply` MCP tool, server posts to Slack via Web API with `unfurl_links: false`.

**Permission relay:** Claude Code sends `notifications/claude/channel/permission_request`, server formats and posts to Slack. User replies `yes/no {id}`, server parses and sends `notifications/claude/channel/permission` verdict back.

**Threading:** Managed by `ThreadTracker` state machine. Questions from Claude start threads. Replies go in threads. Top-level messages are new commands (active thread abandoned). See `src/threads.ts`.

## Critical Rules

- **stdout is sacred.** After `server.connect()`, stdout is owned by MCP JSON-RPC. ALL logging MUST use `console.error()`. This includes the Slack SDK logger.
- **Startup ordering.** `server.connect(transport)` must complete before `socketMode.start()`. Notifications cannot be sent before transport is ready.
- **Meta keys: underscores only.** The Channel protocol silently drops meta keys with hyphens.

## Project Structure

```
src/
├── server.ts          # MCP server entry + CLI, wires all modules
├── types.ts           # Shared TypeScript interfaces
├── config.ts          # Zod-based env var validation
├── slack-client.ts    # Socket Mode connection + message filtering + dedup
├── channel-bridge.ts  # Format Slack messages as Channel notifications
├── detail-store.ts    # Server-side storage for compact detail messages
├── permission.ts      # Permission relay formatting + verdict parsing
├── threads.ts         # Thread tracking and message classification
└── __tests__/         # Bun test suite
```

## Running

```bash
SLACK_CHANNEL_ID=C0XXX SLACK_BOT_TOKEN=xoxb-... SLACK_APP_TOKEN=xapp-... ALLOWED_USER_IDS=U0XXX bun run src/server.ts
```

With Claude Code:
```bash
claude --dangerously-load-development-channels server:slack
```

Requires Claude Code v2.1.80+ and claude.ai login (not API key).

## Testing

```bash
bun test              # unit tests
bun test --coverage   # with coverage
bunx tsc --noEmit     # type check
bunx biome check .    # lint
```

## Documentation

- `docs/implementation-plan.md` — Full task breakdown with research-informed corrections
- `docs/research-synthesis.md` — Synthesized research: protocol spec, Slack patterns, Bun setup
- `docs/slack-best-practices.md` — Slack SDK patterns, security, threading
- `docs/typescript-bun-setup-research.md` — Bun project configuration, testing, CI
