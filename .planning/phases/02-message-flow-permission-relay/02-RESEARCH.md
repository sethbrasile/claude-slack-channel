# Phase 2: Message Flow + Permission Relay - Research

**Researched:** 2026-03-26
**Domain:** MCP Channel protocol, Slack Socket Mode events, thread state management, permission relay
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Permission request timeout:** No timeout hint in the Slack prompt — Claude Code controls its own timeout upstream; the server doesn't promise a window
- **Expired permission messages:** Left as-is in Slack — no edits, no reactions (no callback from protocol on expiry)
- **Stale permission prompts:** Look identical to active ones — if someone replies to a stale one, the 5-char ID won't match and Claude Code ignores it
- **Server is stateless about pending requests:** Parses and forwards all valid verdicts regardless of whether the ID matches a known request
- **Thread abandonment UX:** Silent switch — old thread just goes quiet, no farewell message from Claude
- **Orphaned permission prompts:** Verdicts still forwarded if someone replies (stateless server)
- **Replies to abandoned threads:** Forwarded as `new_input` — never silently dropped
- **`start_thread: true`:** Always creates a new top-level Slack message and anchors the tracker — never reuses an existing active thread

### Claude's Discretion

- Permission prompt formatting details (emoji, backtick styling, input preview truncation length)
- Error handling for failed `chat.postMessage` calls (reply tool and permission posting)
- Exact log messages and stderr formatting for debug/info events

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRDG-01 | Inbound Slack messages formatted as `notifications/claude/channel` with content, source, and meta fields | `formatInboundNotification` pure function; `server.notification()` API verified in MCP SDK |
| BRDG-02 | Meta keys use underscores only (hyphens silently dropped by protocol) | Confirmed in CONTEXT.md + research-synthesis.md; `thread_ts` not `thread-ts` |
| BRDG-03 | Outbound `reply` tool posts messages to Slack and returns `{ content: [{ type: 'text', text: 'sent' }] }` | `WebClient.chat.postMessage` API; existing stub in `server.ts:57` |
| PERM-01 | Server receives `notifications/claude/channel/permission_request` and formats readable Slack message | `server.setNotificationHandler` API verified; Zod schema for inbound params |
| PERM-02 | Server parses `yes/no {5-char-id}` replies as permission verdicts (case insensitive, y/n shorthand) | `parsePermissionReply` regex pattern fully specified in implementation plan |
| PERM-03 | Permission verdicts sent as `notifications/claude/channel/permission` and NOT forwarded as channel messages | Early-return guard in message handler — mutual exclusivity enforced by code structure |
| PERM-04 | Permission prompts posted in active thread (falls back to top-level if no active thread) | `tracker.activeThreadTs ?? undefined` pattern in `chat.postMessage` thread_ts arg |
| PERM-05 | Permission request formatting sanitizes triple backticks and strips Slack broadcast mentions | Zero-width space injection pattern (`\u200b`) verified in implementation plan |
| THRD-01 | ThreadTracker classifies incoming messages as `thread_reply` or `new_input` | `ThreadTracker.classifyMessage(thread_ts)` pure class method |
| THRD-02 | Top-level messages abandon the active thread and start a new command context | `tracker.abandon()` on `new_input` classification |
| THRD-03 | `start_thread: true` on outbound replies anchors thread tracker to new message | `tracker.startThread(result.ts)` after successful `chat.postMessage` with `start_thread: true` |

</phase_requirements>

## Summary

Phase 2 wires together four new modules — `channel-bridge.ts`, `permission.ts`, `threads.ts`, and a refactored `server.ts` — to complete the bidirectional message flow between Slack and Claude Code. All implementation patterns are fully specified in `docs/implementation-plan.md` (Tasks 4–7), which was written by the Phase 1 research and planning team and remains architecturally accurate.

The key integration challenge is restructuring `createSlackClient` to return `{ socketMode, web }` (exposing the raw clients) instead of the current `{ start, stop }` facade. This refactor allows `server.ts` to call `web.chat.postMessage` for outbound replies and to directly control `socketMode.disconnect()` for graceful shutdown. The message handler callback pattern replaces the `_server` parameter that was passed to Phase 1's stub.

The MCP SDK's `assertNotificationCapability` method only validates standard MCP notification methods — `notifications/claude/channel` and `notifications/claude/channel/permission` fall through the switch without error, so custom channel notifications work without any SDK modification. The `setNotificationHandler` method accepts any Zod schema keyed by a `method` literal for receiving inbound permission requests from Claude Code.

**Primary recommendation:** Follow the implementation plan Tasks 4–7 in sequence. Each task is self-contained with TDD (failing tests first), pure function implementations, and a commit. Task 7 (server wiring) is the integration point that brings everything together.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | Already installed | MCP server, notification sending, notification handler registration | Official Anthropic SDK |
| `@slack/socket-mode` | Already installed | Inbound message events via WebSocket | Only Socket Mode SDK for Node/Bun |
| `@slack/web-api` | Already installed | Outbound `chat.postMessage` for reply tool and permission prompts | Official Slack Web API client |
| `zod` | Already installed | Schema validation for permission request params from Claude Code | Already used for config; validates `input_preview` as optional |

### No New Dependencies
All libraries needed for Phase 2 are already installed from Phase 1. Phase 2 is purely implementation work.

## Architecture Patterns

### Recommended File Structure After Phase 2

```
src/
├── server.ts          # Rewired: integrates all modules, sets up CallTool + Notification handlers
├── slack-client.ts    # Refactored: returns { socketMode, web } + callback-based onMessage
├── channel-bridge.ts  # NEW: formatInboundNotification pure function
├── permission.ts      # NEW: parsePermissionReply + formatPermissionRequest pure functions
├── threads.ts         # NEW: ThreadTracker class (state machine)
├── config.ts          # Unchanged
├── types.ts           # Unchanged
└── __tests__/
    ├── channel-bridge.test.ts   # NEW
    ├── permission.test.ts       # NEW
    ├── threads.test.ts          # NEW
    ├── slack-client.test.ts     # Unchanged (existing tests still pass)
    ├── server.test.ts           # Unchanged
    └── config.test.ts           # Unchanged
```

### Pattern 1: Pure Function Extraction (established in Phase 1)

**What:** Each domain concern is a pure function with injectable dependencies, tested without module state.
**When to use:** For all business logic (formatting, parsing, classification).
**Example:**
```typescript
// src/channel-bridge.ts
export function formatInboundNotification(msg: SlackMessage): ChannelNotificationParams {
  const meta: Record<string, string> = {
    user: msg.user,
    channel: msg.channel,
    ts: msg.ts,
  }
  if (msg.thread_ts) {
    meta.thread_ts = msg.thread_ts  // underscore only — hyphens silently dropped
  }
  return { content: msg.text, source: 'slack', meta }
}
```

### Pattern 2: Callback-Based Slack Client (refactor from Phase 1)

**What:** `createSlackClient` accepts an `onMessage` async callback and returns `{ socketMode, web }` instead of a `{ start, stop }` facade.
**When to use:** Allows `server.ts` to own the `web` client for outbound `chat.postMessage` and to call `socketMode.disconnect()` in shutdown.
**Example:**
```typescript
export function createSlackClient(
  appToken: string,
  botToken: string,
  filter: MessageFilter,
  onMessage: MessageHandler
): { socketMode: SocketModeClient; web: WebClient }
```

This requires updating `server.ts` to pass config fields individually rather than the `ChannelConfig` object, and removing the `_server: Server` parameter that was a Phase 1 stub.

### Pattern 3: Mutual Exclusivity — Permission vs Channel

**What:** Inbound messages are checked for permission verdicts FIRST. If matched, they are consumed and NOT forwarded as channel notifications.
**When to use:** Every inbound message. Order is critical.
**Example:**
```typescript
async (msg) => {
  const verdict = parsePermissionReply(msg.text)
  if (verdict) {
    await server.notification({
      method: 'notifications/claude/channel/permission',
      params: verdict,
    })
    return  // do NOT forward as channel notification
  }
  // ... classify and forward as channel notification
}
```

### Pattern 4: setNotificationHandler for Inbound Permission Requests

**What:** `server.setNotificationHandler(schema, handler)` registers a handler for notifications arriving FROM Claude Code TO the server.
**When to use:** For receiving `notifications/claude/channel/permission_request`.
**Example:**
```typescript
const PermissionRequestSchema = z.object({
  method: z.literal('notifications/claude/channel/permission_request'),
  params: z.object({
    request_id: z.string(),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string().optional().default(''),
  }),
})

server.setNotificationHandler(PermissionRequestSchema, async ({ params }) => {
  const text = formatPermissionRequest(params)
  await web.chat.postMessage({
    channel: config.channelId,
    text,
    thread_ts: tracker.activeThreadTs ?? undefined,
    unfurl_links: false,
    unfurl_media: false,
  })
})
```

**Critical:** `setNotificationHandler` must be called AFTER `server.connect(transport)`. The implementation plan registers it in the CLI entry point, not in `createServer()`, because it requires access to the `tracker` and `web` client instances.

### Pattern 5: Socket Mode Event Name

**What:** Listen on `socketMode.on('message', ...)` for Slack `message` events (events_api type).
**Why critical:** The SDK emits two event types:
- `socketMode.on('message', ...)` — fires for `events_api` messages where `event.type === 'message'`. Provides `{ ack, event, body }` where `event` is `payload.event`.
- `socketMode.on('slack_event', ...)` — fires for ALL events. Provides `{ ack, body }` but NO `event` field directly.

The existing Phase 1 stub uses `slack_event`, but the implementation plan correctly uses `'message'` for direct `event` field access. The refactored `slack-client.ts` switches to `'message'`.

### Anti-Patterns to Avoid

- **Using `slack_event` for message handling:** Provides `body` not `event` — requires `body.event` access which is less idiomatic. Use `'message'` to get `event` directly.
- **Calling `tracker.startThread()` on permission prompts:** Permission prompts go IN the active thread. Starting a new thread here would break the yes/no reply classification — those replies must remain `thread_reply` to the original command thread.
- **Registering `setNotificationHandler` inside `createServer()`:** The handler needs access to `tracker` and `web` which are created after `server.connect()`. Wire it in the CLI entry point.
- **Forgetting the `return` after forwarding a verdict:** Without `return`, the message would ALSO be sent as a `notifications/claude/channel` event.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Broadcast mention sanitization | Custom mention stripper | Zero-width space injection (`\u200b`) before `!` | Handles `<!channel>`, `<!here>`, `<!everyone>` universally |
| Triple-backtick escaping | Custom renderer | Replace ` ``` ` with ` ``\u200b` ` ` | Zero-width space breaks Slack code block parsing |
| Permission ID alphabet | Custom charset | Regex `[a-km-z]{5}` | Protocol spec excludes `l` to avoid 1/I/l mobile confusion |

**Key insight:** The permission ID alphabet exclusion of `l` is a protocol spec requirement, not a suggestion. Any regex that allows `l` will fail to parse valid IDs when they don't contain it and incorrectly accept invalid ones.

## Common Pitfalls

### Pitfall 1: `createSlackClient` Signature Change Breaks Existing Consumers

**What goes wrong:** The refactored `createSlackClient` removes the `_server: Server` parameter and adds `onMessage: MessageHandler`. `server.ts` also changes how it calls the function (passing `config.slackAppToken` + `config.slackBotToken` + filter object + callback instead of the whole `config` object).
**Why it happens:** Phase 1 left a stub: `createSlackClient(config, server)`. Phase 2 must change the signature.
**How to avoid:** Update `slack-client.ts` signature, then immediately update `server.ts` to match. The TypeScript compiler catches the mismatch at typecheck time.
**Warning signs:** `bunx tsc --noEmit` errors mentioning `createSlackClient` argument count.

### Pitfall 2: Permission Handler Registered Before Transport Ready

**What goes wrong:** `server.setNotificationHandler()` for `permission_request` registered before `server.connect(transport)` — the handler exists but cannot send the acknowledgment; outbound `server.notification()` calls inside the handler will throw "Not connected".
**Why it happens:** Registering handlers feels like setup, so devs do it before connect.
**How to avoid:** All handlers that call `server.notification()` or `web.chat.postMessage` MUST be registered after `await server.connect(transport)`.
**Warning signs:** `Error: Not connected` in stderr during permission request handling.

### Pitfall 3: `thread_ts` as `null` vs `undefined` in `chat.postMessage`

**What goes wrong:** Passing `thread_ts: null` to `chat.postMessage` may cause a Slack API error. The fallback should produce `undefined`, not `null`.
**Why it happens:** `ThreadTracker.activeThreadTs` returns `string | null`. The null coalescing `?? undefined` pattern converts null → undefined correctly.
**How to avoid:** Use `tracker.activeThreadTs ?? undefined` (not a falsy check — `|| undefined` would also convert empty string).
**Warning signs:** Slack API error `invalid_arguments` on `chat.postMessage` calls.

### Pitfall 4: `result.ts` Missing from `chat.postMessage` Response

**What goes wrong:** `tracker.startThread(result.ts)` called unconditionally — TypeScript flags `result.ts` as `string | undefined` because some Slack responses may omit it.
**Why it happens:** Slack Web API types are loose; `ts` is optional in the response type.
**How to avoid:** Guard with `if (result.ts && args.start_thread)` before calling `tracker.startThread()`.
**Warning signs:** TypeScript error "Argument of type 'string | undefined' is not assignable to parameter of type 'string'".

### Pitfall 5: `setNotificationHandler` Schema Must Have Method Literal

**What goes wrong:** The Zod schema passed to `setNotificationHandler` must have a `method` field with a string literal type, or `getMethodLiteral` (internal SDK function) will fail to extract the key.
**Why it happens:** The SDK uses the `method` field as a Map key for routing.
**How to avoid:** Always include `method: z.literal('notifications/claude/channel/permission_request')` in the schema.
**Warning signs:** Runtime error or handler never fires when permission requests arrive.

## Code Examples

Verified patterns from implementation plan (primary source) and MCP SDK inspection:

### Notification Send (server → Claude Code)
```typescript
// Source: docs/implementation-plan.md Task 7
await server.notification({
  method: 'notifications/claude/channel',
  params: formatInboundNotification(msg),
})
```

### Notification Receive (Claude Code → server)
```typescript
// Source: docs/implementation-plan.md Task 7 + MCP SDK protocol.js:913
server.setNotificationHandler(PermissionRequestSchema, async ({ params }) => {
  // params is typed per PermissionRequestSchema
})
```

### ThreadTracker State Machine
```typescript
// Source: docs/implementation-plan.md Task 6
const classification = tracker.classifyMessage(msg.thread_ts)
if (classification === 'new_input') {
  tracker.abandon()
}
// ... proceed to send notification with classification context
```

### Broadcast Mention Sanitization
```typescript
// Source: docs/implementation-plan.md Tasks 5 and 7
// Strips <!channel>, <!here>, <!everyone> to prevent workspace-wide pings
const safe = text.replaceAll('<!', '<\u200b!')
```

### Permission ID Regex
```typescript
// Source: docs/implementation-plan.md Task 5
// Protocol spec: 5 lowercase letters from a-z EXCLUDING 'l'
const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createSlackClient(config, server)` facade | `createSlackClient(appToken, botToken, filter, onMessage)` callback | Phase 2 refactor | Exposes `web` for reply tool; decouples Slack from MCP server object |
| `socketMode.on('slack_event', ...)` | `socketMode.on('message', ...)` | Phase 2 refactor | Provides `event` directly vs requiring `body.event` navigation |
| Reply tool stub (hardcoded string) | `web.chat.postMessage` with `unfurl_links: false` | Phase 2 | Real outbound messages to Slack |
| `server.ts` handles only `ListTools` + `CallTool` | + `setNotificationHandler` for `permission_request` | Phase 2 | Bidirectional permission relay complete |

## Open Questions

1. **`capabilities` key format for `notifications/claude/channel/permission`**
   - What we know: The server declares `experimental['claude/channel/permission']: {}`. The STATE.md flags MEDIUM confidence on whether this is the correct format Claude Code uses to recognize permission capability.
   - What's unclear: Does Claude Code check `capabilities.experimental['claude/channel/permission']` or a different path?
   - Recommendation: The existing Phase 1 server.ts already declares it this way, and Phase 1 tests pass. Proceed with current format; validate against a live Claude Code session during Task 8 manual integration test.

2. **`server.notification()` capability assertion for custom methods**
   - What we know: Inspected MCP SDK `assertNotificationCapability` — it only validates standard MCP methods via a switch statement with no default case. Custom `notifications/claude/*` methods pass through without error.
   - What's unclear: Whether future SDK versions might add stricter validation.
   - Recommendation: HIGH confidence this works. No action needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in, v1.2+) |
| Config file | none — `bun test` auto-discovers `__tests__/*.test.ts` |
| Quick run command | `bun test` |
| Full suite command | `bun test --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRDG-01 | `formatInboundNotification` formats content/source/meta | unit | `bun test src/__tests__/channel-bridge.test.ts` | ❌ Wave 0 |
| BRDG-02 | Meta keys are underscores not hyphens | unit | `bun test src/__tests__/channel-bridge.test.ts` | ❌ Wave 0 |
| BRDG-03 | Reply tool returns `{ content: [{ type: 'text', text: 'sent' }] }` | unit | `bun test src/__tests__/server.test.ts` | ✅ (extend) |
| PERM-01 | `formatPermissionRequest` includes request_id, tool_name, description, input_preview | unit | `bun test src/__tests__/permission.test.ts` | ❌ Wave 0 |
| PERM-02 | `parsePermissionReply` handles yes/no/y/n, case insensitive, 5-char ID | unit | `bun test src/__tests__/permission.test.ts` | ❌ Wave 0 |
| PERM-03 | Verdict messages are NOT forwarded as channel notifications | manual | manual integration test only | — |
| PERM-04 | Permission prompt uses `tracker.activeThreadTs` | unit | `bun test src/__tests__/threads.test.ts` | ❌ Wave 0 |
| PERM-05 | Sanitizes triple backticks + broadcast mentions | unit | `bun test src/__tests__/permission.test.ts` | ❌ Wave 0 |
| THRD-01 | `ThreadTracker.classifyMessage` returns `thread_reply` or `new_input` | unit | `bun test src/__tests__/threads.test.ts` | ❌ Wave 0 |
| THRD-02 | Top-level messages trigger `abandon()` | unit | `bun test src/__tests__/threads.test.ts` | ❌ Wave 0 |
| THRD-03 | `start_thread: true` anchors tracker via `startThread(result.ts)` | unit | `bun test src/__tests__/threads.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test`
- **Per wave merge:** `bun test --coverage && bunx tsc --noEmit && bunx biome check .`
- **Phase gate:** Full suite green + manual Slack integration test before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/channel-bridge.test.ts` — covers BRDG-01, BRDG-02
- [ ] `src/__tests__/permission.test.ts` — covers PERM-01, PERM-02, PERM-05
- [ ] `src/__tests__/threads.test.ts` — covers THRD-01, THRD-02, PERM-04

All test content is fully specified in `docs/implementation-plan.md` Tasks 4–6. These are not gaps to discover — they are the TDD step-1 of each task.

## Sources

### Primary (HIGH confidence)
- `docs/implementation-plan.md` — Complete implementation spec for Tasks 4–7, all code patterns, all test cases
- `docs/research-synthesis.md` — Synthesized research from Phase 1 planning
- `node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.js` (lines 789, 913) — `notification()` and `setNotificationHandler()` verified in installed SDK
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js` (lines 173–208) — `assertNotificationCapability` switch statement — custom methods pass through

### Secondary (MEDIUM confidence)
- `node_modules/@slack/socket-mode/dist/src/SocketModeClient.js` (lines 287–317) — `'message'` vs `'slack_event'` event emission verified in installed SDK
- `docs/slack-best-practices.md` — Slack SDK patterns from Phase 1 research

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries installed and verified in node_modules
- Architecture: HIGH — implementation plan is the primary source, fully verified against installed SDK
- Pitfalls: HIGH — identified by direct inspection of SDK source + known CONTEXT.md decisions
- Protocol behavior: MEDIUM — `notifications/claude/channel/permission` capability format unverified against live Claude Code (STATE.md known concern)

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (stable ecosystem; MCP SDK and Slack SDK versions pinned in package.json)
