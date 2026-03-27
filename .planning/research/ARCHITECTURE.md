# Architecture Research

**Domain:** MCP Channel server — bidirectional Slack bridge for Claude Code
**Researched:** 2026-03-26
**Confidence:** HIGH (based on protocol spec, implementation plan, and reference implementations)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Claude Code Process                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    MCP Client                              │  │
│  │  Calls tools, sends permission_request notifications,      │  │
│  │  receives channel + permission verdict notifications       │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                           │ stdio (JSON-RPC)                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│   MCP Server Process      │                                      │
│                           │                                      │
│  ┌────────────────────────▼──────────────────────────────────┐  │
│  │  server.ts — Entry Point / Wiring                         │  │
│  │  Startup ordering, signal handlers, module composition    │  │
│  └──┬──────────────────┬──────────────────────┬─────────────┘  │
│     │                  │                       │                │
│  ┌──▼──────────┐  ┌────▼──────────┐  ┌────────▼────────────┐  │
│  │ config.ts   │  │ slack-client  │  │  channel-bridge.ts  │  │
│  │ Zod env     │  │ Socket Mode   │  │  Format inbound      │  │
│  │ validation  │  │ + filtering   │  │  Slack msgs as MCP   │  │
│  └─────────────┘  └────┬──────────┘  │  channel notifs      │  │
│                         │             └────────┬────────────┘  │
│  ┌──────────────┐  ┌────▼──────────┐  ┌────────▼────────────┐  │
│  │ permission   │  │ threads.ts    │  │  types.ts            │  │
│  │ .ts          │  │ ThreadTracker │  │  Shared interfaces   │  │
│  │ Format req   │  │ state machine │  └─────────────────────┘  │
│  │ parse verdict│  └───────────────┘                           │
│  └──────────────┘                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │ WebSocket (Socket Mode)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      Slack Platform                              │
│   Socket Mode gateway → Event API → Bot workspace               │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | File | Responsibility | Communicates With |
|-----------|------|----------------|-------------------|
| Entry point | `server.ts` | Wires all modules, enforces startup order, registers signal/error handlers, owns the `reply` tool handler | All modules |
| Config | `config.ts` | Zod schema for env vars, validates token prefixes + user ID format, exits on failure | Entry point only |
| Slack client | `slack-client.ts` | Socket Mode connection + auto-reconnect, message filtering (channel ID, user allowlist, bot_id, subtype), deduplication by `ts` | Entry point, threads.ts |
| Channel bridge | `channel-bridge.ts` | Formats raw Slack message events as `notifications/claude/channel` payloads | Entry point, threads.ts |
| Permission | `permission.ts` | Formats `permission_request` notifications as Slack messages, parses `yes/no {id}` verdicts from Slack replies | Entry point, slack-client.ts |
| Thread tracker | `threads.ts` | State machine classifying inbound messages as new commands vs thread replies; manages `thread_ts` lifecycle | slack-client.ts, channel-bridge.ts |
| Shared types | `types.ts` | `ChannelConfig`, `PermissionRequest`, `PermissionVerdict` interfaces | All modules |

## Recommended Project Structure

```
src/
├── server.ts          # Entry point: wiring, startup sequence, reply tool, signal handlers
├── types.ts           # Shared TypeScript interfaces (no logic)
├── config.ts          # Zod env validation — pure function parseConfig()
├── slack-client.ts    # Socket Mode client, filtering, dedup — pure shouldProcessMessage()
├── channel-bridge.ts  # Inbound formatter — pure formatInboundNotification()
├── permission.ts      # Permission relay — pure formatPermissionRequest() + parsePermissionReply()
├── threads.ts         # ThreadTracker class (state, not pure — manages Set of active threads)
└── __tests__/
    ├── server.test.ts
    ├── config.test.ts
    ├── slack-client.test.ts
    ├── channel-bridge.test.ts
    ├── permission.test.ts
    └── threads.test.ts
```

### Structure Rationale

- **Flat `src/`:** Mirrors Anthropic's official Telegram/Discord reference implementations; avoids over-engineering for a focused single-server package.
- **Pure function extraction:** `shouldProcessMessage`, `formatInboundNotification`, `formatPermissionRequest`, `parsePermissionReply` are pure functions extracted for testability without mocking infrastructure.
- **`types.ts` has no logic:** Prevents circular imports; any module can import types without creating dependency chains.
- **`server.ts` as wiring layer:** Keeps startup-ordering logic centralized; no business logic lives here.

## Architectural Patterns

### Pattern 1: Pure Function Extraction for Testability

**What:** Extract logic that can be expressed as pure functions — inputs in, output out — from modules that also own side-effectful I/O (Socket Mode events, MCP notifications).

**When to use:** Any transformation that doesn't require network calls or mutable state. All formatting and filtering logic qualifies.

**Trade-offs:** Requires discipline to separate pure from side-effectful code; pays off in test coverage without mocks.

**Example:**
```typescript
// Pure — testable directly, no Socket Mode mock needed
export function shouldProcessMessage(
  event: SlackMessageEvent,
  config: { channelId: string; allowedUserIds: string[] }
): boolean {
  if (event.channel !== config.channelId) return false
  if (event.subtype === 'bot_message') return false
  if (event.bot_id) return false  // Bolt SDK gap: some bot msgs lack subtype
  if (!event.user || !config.allowedUserIds.includes(event.user)) return false
  return true
}
```

### Pattern 2: Dependency-Injected Gate Functions

**What:** Pass filtering/gate logic as a function parameter rather than importing it directly. Adapted from jeremylongshore/claude-code-slack-channel.

**When to use:** When a module needs to be configurable or testable with different filtering behavior.

**Trade-offs:** Slightly more verbose wiring in `server.ts`; dramatically easier to test edge cases without re-running the full process.

**Example:**
```typescript
// slack-client.ts
export function createSlackClient(
  config: ChannelConfig,
  shouldProcess: (event: SlackMessageEvent) => boolean,
  onMessage: (event: SlackMessageEvent) => void
): SocketModeClient { ... }
```

### Pattern 3: Enforced Startup Ordering

**What:** `server.connect(transport)` must complete before `socketMode.start()`. MCP notifications cannot be sent before the transport is ready; if Slack delivers a message before the transport is up, the process will throw.

**When to use:** Always — this is a hard protocol constraint, not optional.

**Trade-offs:** Sequential initialization adds ~100ms to startup; the alternative is race conditions and silent notification loss.

**Example:**
```typescript
// server.ts — correct ordering
const transport = new StdioServerTransport()
await server.connect(transport)          // MCP transport FIRST
await socketModeClient.start()           // Slack SECOND
```

### Pattern 4: Stderr-Only Logging

**What:** After `server.connect()`, stdout is exclusively owned by MCP JSON-RPC. All logging — including Slack SDK internal logs — must go to stderr.

**When to use:** Always — any stdout write after `connect()` corrupts the MCP protocol stream and breaks Claude Code.

**Trade-offs:** None; there is no alternative.

**Example:**
```typescript
const stderrLogger = {
  debug: (...args: unknown[]) => console.error('[slack:debug]', ...args),
  info:  (...args: unknown[]) => console.error('[slack:info]',  ...args),
  warn:  (...args: unknown[]) => console.error('[slack:warn]',  ...args),
  error: (...args: unknown[]) => console.error('[slack:error]', ...args),
}
const socketMode = new SocketModeClient({
  appToken: config.slackAppToken,
  logger: stderrLogger,
})
```

## Data Flow

### Inbound: Slack Message → Claude Notification

```
Slack user types message in channel
    ↓
Socket Mode WebSocket delivers event to process
    ↓
slack-client.ts: ack() immediately (within 3s deadline)
    ↓
shouldProcessMessage() — channel ID, user allowlist, bot_id, subtype, dedup by ts
    [pass]                              [fail → drop]
    ↓
threads.ts ThreadTracker.classify(event.ts, event.thread_ts)
    → new_command | thread_reply | abandoned_thread
    ↓
channel-bridge.ts formatInboundNotification(event, classification)
    → builds <channel source="slack" user="..." ts="..." thread_ts="..."> payload
    ↓
server.notification('notifications/claude/channel', payload)
    → sent over stdio to Claude Code
    ↓
Claude receives <channel> tag, reads it as user instruction
```

### Outbound: Claude → Slack Reply

```
Claude decides to respond
    ↓
Claude calls MCP tool: reply({ text: "...", thread_ts: "..." })
    ↓
server.ts CallToolRequestSchema handler
    ↓
WebClient.chat.postMessage({
  channel: config.channelId,
  text: args.text,
  thread_ts: args.thread_ts,   // optional — omit for top-level
  unfurl_links: false,
  unfurl_media: false,
})
    ↓
Message appears in Slack channel (or thread)
```

### Permission Relay: Claude → Human → Claude

```
Claude Code needs permission for a sensitive tool call
    ↓
Claude Code sends notification: notifications/claude/channel/permission_request
    {request_id, tool_name, description, input_preview}
    ↓
server.ts onNotification handler receives it
    ↓
permission.ts formatPermissionRequest(request) → Slack message text
    ↓
WebClient.chat.postMessage() — posts permission request to channel
    ↓
Human types: "yes abc123" or "no abc123" in Slack
    ↓
Socket Mode delivers message → shouldProcessMessage() passes
    ↓
permission.ts parsePermissionReply(text) → { request_id, behavior } | null
    [verdict found]                              [not a verdict → forward to Claude as message]
    ↓
server.notification('notifications/claude/channel/permission', {
  request_id, behavior: 'allow' | 'deny'
})
    ↓
Claude Code receives verdict, proceeds or aborts tool call
```

### ThreadTracker State Machine

```
New message arrives (no thread_ts):
    ThreadTracker: register ts as active command thread
    Classification: "new_command"
    → channel-bridge sends without thread_ts (top-level)

Reply arrives (has thread_ts matching active command):
    ThreadTracker: ts already registered
    Classification: "thread_reply"
    → channel-bridge sends with thread_ts preserved

Reply arrives (has thread_ts but no active command):
    ThreadTracker: ts not in active set
    Classification: "abandoned_thread"
    → drop or forward as new command depending on config

New message arrives while thread is active:
    ThreadTracker: previous thread marked abandoned, new ts registered
    Classification: "new_command" (active thread abandoned)
```

## Scaling Considerations

This is a single-operator automation tool. Scaling is not a primary concern — one Slack workspace, one channel, one Claude Code session.

| Scale | Architecture Adjustment |
|-------|-------------------------|
| Single operator (design target) | Flat modules, in-memory dedup Set, no persistence needed |
| Multiple operators, same channel | `ALLOWED_USER_IDS` already supports multiple IDs; ThreadTracker may need per-user tracking |
| Multiple channels | Out of scope by design; would require config refactor and multi-channel routing |

### Scaling Priorities

1. **Dedup TTL management:** The in-memory Set for dedup grows unbounded without TTL cleanup. Implement a 30-second sliding window. This is the only stateful concern that could cause issues over long uptime.
2. **Permission request correlation:** If Claude sends multiple permission requests in rapid succession, the reply parser must match by `request_id` not just message order. Already handled by design.

## Anti-Patterns

### Anti-Pattern 1: Starting Socket Mode Before MCP Transport

**What people do:** Start Slack Socket Mode first because it's the "main" connection, then connect MCP.

**Why it's wrong:** If Slack delivers a message before `server.connect()` completes, calling `server.notification()` throws. The notification is silently lost.

**Do this instead:** Always `await server.connect(transport)` first. Socket Mode second.

### Anti-Pattern 2: Logging to stdout After connect()

**What people do:** Use `console.log()` for debugging inside Slack event handlers.

**Why it's wrong:** stdout is owned by MCP JSON-RPC after `server.connect()`. Any non-protocol write corrupts the stream and breaks Claude Code's ability to communicate with the server.

**Do this instead:** Use `console.error()` for all logging. Redirect the Slack SDK logger to stderr explicitly via a custom logger object passed to `SocketModeClient`.

### Anti-Pattern 3: Checking Only `subtype` for Bot Filtering

**What people do:** Filter `event.subtype === 'bot_message'` and consider bot-loop prevention done.

**Why it's wrong:** The Bolt SDK has a documented gap where some bot-sourced messages carry `event.bot_id` but NOT `subtype: 'bot_message'`. Bots writing to the channel (including Claude's own replies) will be forwarded back to Claude, creating an infinite loop.

**Do this instead:** Check both `event.subtype === 'bot_message'` AND `event.bot_id` before processing.

### Anti-Pattern 4: Calling ack() After Processing

**What people do:** Process the event fully, then call `ack()`.

**Why it's wrong:** Slack requires acknowledgment within 3 seconds. Any slow processing (MCP notification, permission lookup) will cause Slack to retry delivery, creating duplicate events.

**Do this instead:** Call `ack()` as the very first line in every event handler, wrapped in try/catch. Process asynchronously after.

### Anti-Pattern 5: Meta Keys with Hyphens

**What people do:** Use `thread-ts` as a meta key in channel notification payloads because it matches Slack's field naming.

**Why it's wrong:** The Channel protocol silently drops meta keys containing hyphens. The value is lost without any error.

**Do this instead:** Use underscores only: `thread_ts`, `user_id`, `channel_id`.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Slack Socket Mode | Persistent WebSocket via `@slack/socket-mode` `SocketModeClient` | Disconnects hourly are normal; SDK auto-reconnects. Custom stderr logger required to prevent stdout corruption. |
| Slack Web API | REST via `@slack/web-api` `WebClient` | Used only for `chat.postMessage`. Always include `unfurl_links: false`. Rate limit: Tier 3 (50 req/min default). |
| Claude Code MCP | stdio JSON-RPC via `@modelcontextprotocol/sdk` `StdioServerTransport` | Transport owns stdout exclusively after `connect()`. Notifications require transport to be connected. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `server.ts` → `slack-client.ts` | Direct function call (wiring) | `server.ts` passes callbacks into slack-client; no events/emitters |
| `slack-client.ts` → `threads.ts` | Direct method call on `ThreadTracker` instance | Classify before forwarding to channel-bridge |
| `slack-client.ts` → `channel-bridge.ts` | Direct function call with event + classification | Pure function, no state |
| `slack-client.ts` → `permission.ts` | Direct function call for verdict parsing | Pure function — returns null if message is not a verdict |
| `permission.ts` → Slack Web API | Via WebClient passed from `server.ts` | Shared WebClient instance |
| `server.ts` → MCP SDK | `server.notification()` and tool handler registration | Must be called after `server.connect()` |

## Build Order Implications

Components have clear dependencies. Build in this order:

1. **`types.ts`** — No dependencies. All other modules import from here.
2. **`config.ts`** — Imports `types.ts` only. Pure function, fully testable.
3. **`threads.ts`** — Imports `types.ts` only. Self-contained state machine.
4. **`channel-bridge.ts`** — Imports `types.ts` + uses `threads.ts` output. Pure formatter.
5. **`permission.ts`** — Imports `types.ts` only. Pure formatter + parser.
6. **`slack-client.ts`** — Imports all domain modules. Wires Socket Mode with filtering/dedup/classification.
7. **`server.ts`** — Imports all modules. Wires MCP server + Slack client. Entry point.

Each step is independently testable before the next is built. The test suite for a component can be written before its dependencies (except types).

## Sources

- `docs/research-synthesis.md` — Protocol spec, Slack SDK patterns, reference implementations (HIGH confidence)
- `docs/implementation-plan.md` — Detailed component specs with code examples (HIGH confidence)
- `.planning/PROJECT.md` — Architecture decisions, constraints, out-of-scope declarations (HIGH confidence)
- [Channels Reference](https://code.claude.com/docs/en/channels-reference) — Protocol specification
- [jeremylongshore/claude-code-slack-channel](https://github.com/jeremylongshore/claude-code-slack-channel) — Community reference for patterns
- [Anthropic official Telegram/Discord plugins](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/telegram) — Official reference for flat structure

---
*Architecture research for: MCP Channel server for Slack*
*Researched: 2026-03-26*
