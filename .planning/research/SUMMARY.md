# Project Research Summary

**Project:** claude-slack-channel — MCP Channel Server for Slack
**Domain:** MCP stdio server bridging Claude Code to Slack via Socket Mode
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

This is a single-purpose MCP Channel server that bridges Claude Code to a Slack workspace using Slack's Socket Mode WebSocket transport. The canonical pattern — validated against Anthropic's official Telegram and Discord reference plugins, the community Slack implementation (jeremylongshore/claude-code-slack-channel), and the Channel protocol specification — is a flat TypeScript module structure running on Bun, with `@modelcontextprotocol/sdk` for the MCP server and `@slack/socket-mode` + `@slack/web-api` for Slack connectivity. The differentiating feature of this server over every existing implementation is the permission relay flow: operators approve or deny Claude's sensitive tool calls from Slack without terminal access. That feature drives the thread-tracking requirement and defines the automation-pipeline use case as the product's identity.

The recommended approach is to build in dependency order — types, config, thread tracker, channel bridge, permission relay, Slack client, server entry — with pure-function extraction throughout so business logic is unit-testable without mocking infrastructure. There are no architectural unknowns; the component graph is fully specified in prior research synthesis. The stack is similarly settled: Bun is the runtime, biome handles linting and formatting, and Zod v4 validates environment configuration at startup. All versions are verified against npm as of March 2026.

The primary risks are not design risks but implementation traps that are well-documented and preventable. Seven critical pitfalls all cluster in Phase 1: stdout corruption after MCP transport connects, startup ordering of MCP before Slack, bot-loop from incomplete event filtering, late `ack()` causing duplicate delivery, missing global error handlers, silent meta key data loss from hyphens, and missing the `instructions` field in the MCP server constructor. Every pitfall has a clear mechanical fix. The project has prior research (9 critical gaps already resolved in `docs/research-synthesis.md`) that provides high-confidence grounding for all decisions.

## Key Findings

### Recommended Stack

The stack is fully resolved with verified package versions. Bun (>=1.3.11) is both the runtime and test runner — it runs TypeScript directly with no compilation step, and is now the runtime Anthropic uses for its own official channel plugins. The MCP SDK (`@modelcontextprotocol/sdk` ^1.28.0) provides `McpServer`, `StdioServerTransport`, and `server.notification()`. Slack connectivity splits across two packages: `@slack/socket-mode` ^2.0.5 for the persistent WebSocket inbound connection and `@slack/web-api` ^7.15.0 for `chat.postMessage` outbound. Zod v4 (`^4.3.6`) handles env var validation. Biome v2 (`@biomejs/biome` ^2.4.8`) replaces ESLint + Prettier.

**Core technologies:**
- Bun >=1.3.11: runtime + test runner — TypeScript natively, fastest cold start for stdio subprocess, Anthropic's preferred runtime
- `@modelcontextprotocol/sdk` ^1.28.0: MCP server framework — official SDK, provides `McpServer`, `StdioServerTransport`, tool registration, `server.notification()`
- `@slack/socket-mode` ^2.0.5: inbound Slack WebSocket — no public URL required, SDK handles auto-reconnect
- `@slack/web-api` ^7.15.0: outbound Slack REST — required alongside socket-mode for `chat.postMessage`
- `zod` ^4.3.6: config validation — typed output, fast-fail at startup with field-level errors
- `@biomejs/biome` ^2.4.8: lint + format — single binary, no plugin chain, CI-safe with `bunx biome ci .`

**What NOT to use:** `@slack/bolt` (too much abstraction for this use case), `bun-types` (deprecated), `console.log` anywhere after `server.connect()`, emit options in tsconfig (`outDir`, `rootDir`, `declaration`), `"module": "ESNext"` (use `"Preserve"`).

See `.planning/research/STACK.md` for full version compatibility matrix and alternatives analysis.

### Expected Features

All v1 features are P1 — there is no optional list for launch. The MVP checklist is large but each item is low-to-medium complexity. The permission relay (HIGH complexity) is the one feature that justifies the project's existence over existing implementations; without it, there is no reason to build this.

**Must have (table stakes) — server does not function without these:**
- Channel capability declaration (`claude/channel` + `claude/channel/permission`) — protocol requirement
- `reply` tool — Claude's only way to post to Slack
- Socket Mode connectivity with auto-reconnect — server goes dark hourly without this
- Inbound filtering (channel ID + user allowlist) — security baseline
- Bot-loop prevention (dual `subtype` + `bot_id` check) — without this, first reply loops
- Message deduplication (Set with 30s TTL) — Socket Mode is at-least-once delivery
- Startup ordering enforcement (`server.connect()` before `socketMode.start()`)
- Stderr-only logging — stdout corruption kills the MCP protocol stream
- Global error handlers (`uncaughtException` + `unhandledRejection`)
- Graceful shutdown (SIGTERM + SIGINT + stdin close)
- `ack()` within 3 seconds — Slack retries unacked events
- Zod config validation at startup — token prefix validation, user ID regex
- Prompt injection hardening in `instructions` field
- `unfurl_links: false` + `unfurl_media: false` on all `chat.postMessage` calls
- MCP `instructions` field — Claude must understand the channel context
- Permission relay — the core differentiator
- Thread state machine (`ThreadTracker`) — required for permission relay routing
- Slack app manifest (`slack-app-manifest.yaml`) — users cannot set up correctly without it
- Unit tests on all pure functions — CI is meaningless without this
- CI pipeline (typecheck + lint + test)
- README with comparison table and acknowledgments

**Should have (add after v1 validation):**
- npm release workflow with provenance attestation — lowers adoption barrier
- Contributing guide, changelog, issue templates
- Examples directory for pipeline integrations
- Manual integration test checklist

**Defer (v2+):**
- Typing indicators — no evidence automation operators want this signal
- File exfiltration guard — out of scope for automation context
- Integration tests against mock Slack WebSocket server

**Deliberately out of scope (anti-features):** multi-channel support, pairing code flow, rich tool surface beyond `reply`, multi-user architecture with per-channel opt-in.

See `.planning/research/FEATURES.md` for dependency graph and full prioritization matrix.

### Architecture Approach

The architecture is a flat `src/` module structure with strict dependency ordering and pure-function extraction as the central testability strategy. No event emitters, no dependency injection framework, no abstraction layers — direct function calls with callbacks passed at the `server.ts` wiring layer. This mirrors the Anthropic official reference implementations and is correct for a focused single-operator tool.

**Major components (build in this order):**
1. `types.ts` — shared interfaces, no logic, no dependencies; prevents circular imports
2. `config.ts` — Zod env validation, pure `parseConfig()` function, exits on failure
3. `threads.ts` — `ThreadTracker` state machine classifying messages as new command / thread reply / abandoned thread
4. `channel-bridge.ts` — pure `formatInboundNotification()` formatter; converts Slack events to `<channel source="slack">` payloads
5. `permission.ts` — pure `formatPermissionRequest()` + `parsePermissionReply()`; formats requests and parses `yes/no {id}` verdicts
6. `slack-client.ts` — Socket Mode connection + filtering + dedup; wires domain modules; exposes `shouldProcessMessage()` as pure function
7. `server.ts` — entry point; enforces startup ordering; registers `reply` tool handler; owns signal/error handlers; no business logic

Three data flows govern all behavior: inbound (Slack message → Claude notification), outbound (Claude `reply` tool call → `chat.postMessage`), and the permission relay loop (Claude `permission_request` → Slack → human verdict → Claude).

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, component boundary specifications, and anti-pattern documentation.

### Critical Pitfalls

All 8 critical pitfalls are in Phase 1. Addressing them during initial scaffold — not as polish — is the prevention strategy.

1. **stdout corruption** — Use `console.error()` exclusively after `server.connect()`; provide a custom `createStderrLogger()` to `SocketModeClient`; grep for `console.log` in CI
2. **Startup ordering** — `await server.connect(transport)` then `await socketMode.start()` — never concurrent, never reversed; `Promise.all()` is the anti-pattern to avoid
3. **Bot loop from incomplete filtering** — check both `event.subtype === 'bot_message'` AND `event.bot_id`; the Bolt SDK `ignoreSelf` middleware has a documented gap on `bot_id`-only messages
4. **Late `ack()` causing duplicate delivery** — `ack()` must be the first awaited call in every event handler, wrapped in its own try/catch separate from business logic
5. **Missing global error handlers** — register `uncaughtException` and `unhandledRejection` before `server.connect()`; unhandled WebSocket rejections silently kill the subprocess
6. **Meta key hyphens causing silent data loss** — Channel protocol drops meta keys with hyphens with no error; use underscores everywhere: `permission_id`, `thread_ts`, `tool_name`
7. **Missing `instructions` field** — without it, Claude ignores `<channel>` tags or responds erratically; must include prompt injection hardening in the instructions text
8. **`ack()` error handling** — `ack()` can throw on WebSocket close; without its own try/catch, this propagates as an unhandled rejection (see pitfall 5)

See `.planning/research/PITFALLS.md` for recovery strategies, integration gotchas, and the "Looks Done But Isn't" verification checklist.

## Implications for Roadmap

### Phase 1: MCP + Slack Foundation

**Rationale:** Every other feature depends on a working MCP transport and Slack WebSocket connection. The 8 critical pitfalls all live here — they must be designed in from the start, not retrofitted. This phase produces a functioning skeleton that forwards Slack messages to Claude.

**Delivers:** Working MCP server that receives Slack messages and forwards them to Claude as channel notifications; Claude can call `reply` tool to post back; no permission relay yet.

**Addresses:** Channel capability declaration, `reply` tool, Socket Mode connectivity, inbound filtering, bot-loop prevention, message deduplication, startup ordering, stderr-only logging, global error handlers, graceful shutdown, `ack()` handling, Zod config validation, MCP `instructions` field, `unfurl_links: false`

**Avoids:** stdout corruption (pitfall 1), startup ordering race (pitfall 2), bot loop (pitfall 3), late ack (pitfall 4), silent process crash (pitfall 6), unhandled ack throw (pitfall 8)

**Build order:** types.ts → config.ts → slack-client.ts (with `shouldProcessMessage`) → server.ts (minimal wiring, no channel bridge yet)

### Phase 2: Channel Bridge + Permission Relay

**Rationale:** With the transport layer stable, the message format and the differentiating permission flow can be built on top of it. `ThreadTracker` is a prerequisite for permission relay because verdict routing requires knowing which thread a `yes/no {id}` reply belongs to.

**Delivers:** Full bidirectional channel bridge; permission relay for operator approval of Claude's sensitive tool calls; thread-aware message classification.

**Addresses:** Thread state machine (ThreadTracker), channel-bridge message formatting, permission relay (format request + parse verdict), meta key underscore enforcement, prompt injection hardening in notification payloads, `reply_broadcast: false` (never use), verdict parser case-insensitivity

**Avoids:** Meta key hyphens causing silent data loss (pitfall 5), missing instructions field (pitfall 7), thread state corruption

**Build order:** threads.ts → channel-bridge.ts → permission.ts → server.ts (wire channel bridge + permission relay)

### Phase 3: Testing + CI

**Rationale:** Pure-function architecture was designed to make this phase cheap. Tests cover the same components in the same order they were built. CI is a prerequisite for the npm publish workflow in Phase 4.

**Delivers:** Full unit test coverage on all pure functions; GitHub Actions CI pipeline (typecheck + biome lint + bun test --coverage); "Looks Done But Isn't" verification checklist passed.

**Addresses:** Unit test coverage for `shouldProcessMessage`, `parseConfig`, `ThreadTracker`, `formatInboundNotification`, `formatPermissionRequest`, `parsePermissionReply`; CI pipeline; dedup behavior under reconnect simulation

**Research flags:** None — standard Bun test patterns, well-documented.

### Phase 4: Package + Documentation

**Rationale:** npm publish with provenance and the Slack app manifest lower adoption barrier significantly. README comparison table is needed for community discoverability. These are independent of each other and can be parallelized.

**Delivers:** npm-publishable package (`npx claude-slack-channel`); `slack-app-manifest.yaml` for reproducible Slack app setup; README with comparison table vs. community implementation and acknowledgments; GitHub Actions release workflow with `--provenance`.

**Addresses:** npm publish workflow, Slack app manifest, README, contributing guide, changelog

**Research flags:** None — established npm publish patterns, Bun-compatible.

### Phase Ordering Rationale

- **Phase 1 before everything:** startup ordering and stdout safety are architectural invariants, not features — they must exist in the first line of code committed.
- **Phase 2 requires Phase 1:** `server.notification()` cannot be called before the transport is connected; `ThreadTracker` must exist before permission relay can route verdicts.
- **Phase 3 requires Phase 2:** tests cover the full component set; writing tests before the components exist has no value here because the pure-function signatures were designed in research, not discovered during development.
- **Phase 4 is independent of Phase 3 in logic** but depends on Phase 3 passing in practice — do not publish before CI is green.

### Research Flags

Phases with standard, well-documented patterns (skip `/gsd:research-phase`):
- **Phase 1:** Slack Socket Mode + MCP stdio patterns are fully documented in prior synthesis (`docs/research-synthesis.md`). Stack versions are verified. No unknowns.
- **Phase 3:** Bun test runner patterns are in `docs/typescript-bun-setup-research.md`. GitHub Actions with `oven-sh/setup-bun@v2` is standard.
- **Phase 4:** npm provenance attestation via GitHub Actions is well-documented.

Phases that may benefit from targeted research during planning:
- **Phase 2 (permission relay):** The `capabilities` declaration key format for `experimental['claude/channel/permission']` has MEDIUM confidence — derived from the protocol spec but not independently verified against SDK source. Validate against a running Claude Code session before finalizing the notification payload shape.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry (March 2026); Bun, MCP SDK, Slack SDK, Zod, Biome confirmed |
| Features | HIGH | Based on official Anthropic plugins, Channel protocol spec, and community implementation; MVP list is exhaustive |
| Architecture | HIGH | Component boundaries validated by reference implementations; data flow diagrams match protocol spec |
| Pitfalls | HIGH | All 8 critical pitfalls verified against official docs, SDK source, and known issue threads; most have filed bug reports as evidence |

**Overall confidence:** HIGH

### Gaps to Address

- **`capabilities` key format for permission capability:** MEDIUM confidence. The exact key `experimental['claude/channel/permission']` is derived from the protocol spec naming convention but not verified against SDK source. Verify in Phase 2 by testing against a live Claude Code session before building the full permission relay flow.
- **Multiple MCP server interaction:** Known issues #36472 and #36802 document that notifications can be silently undelivered when multiple MCP servers are active. This affects testing in environments with other MCP servers. Address by using a dedicated Claude Code session for integration validation in Phase 3.
- **Zod v4 `safeParse` error format:** The exact shape of `ZodError` in v4 differs from v3 (new `issues` array structure). If config error messages need user-facing formatting, verify the v4 error shape before implementing the startup failure message.

## Sources

### Primary (HIGH confidence)
- `docs/research-synthesis.md` — Channel protocol spec, 9 critical gaps, Slack SDK patterns (prior project research)
- `docs/implementation-plan.md` — Full component specifications with verified code examples
- [Claude Code Channels Reference](https://code.claude.com/docs/en/channels-reference) — canonical protocol spec
- [Anthropic official Telegram plugin](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/telegram) — reference implementation
- [Anthropic official Discord plugin](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/discord) — reference implementation
- [jeremylongshore/claude-code-slack-channel](https://github.com/jeremylongshore/claude-code-slack-channel) — community Slack implementation

### Secondary (MEDIUM confidence)
- [bolt-js issue #1906](https://github.com/slackapi/bolt-js/issues/1906) — WebSocket disconnect crash behavior
- [node-slack-sdk issue #1652](https://github.com/slackapi/node-slack-sdk/issues/1652) — intermittent Socket Mode silence

### Package version verification (HIGH confidence, March 2026)
- [npm: @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — v1.28.0
- [npm: @slack/socket-mode](https://www.npmjs.com/package/@slack/socket-mode) — v2.0.5
- [npm: @slack/web-api](https://www.npmjs.com/package/@slack/web-api) — v7.15.0
- [npm: @biomejs/biome](https://www.npmjs.com/package/@biomejs/biome) — v2.4.8
- [npm: zod](https://www.npmjs.com/package/zod) — v4.3.6
- [npm: @types/bun](https://www.npmjs.com/package/@types/bun) — v1.3.11

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
