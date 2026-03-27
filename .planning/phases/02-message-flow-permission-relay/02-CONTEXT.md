# Phase 2: Message Flow + Permission Relay - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Claude receives properly-formatted channel notifications for every allowed inbound message, can reply to Slack via the `reply` tool, and operators can approve or deny Claude's tool calls from Slack without terminal access. Covers BRDG-01/02/03, PERM-01/02/03/04/05, THRD-01/02/03.

</domain>

<decisions>
## Implementation Decisions

### Permission request timeout
- No timeout hint in the Slack prompt — Claude Code controls its own timeout upstream; the server doesn't promise a window
- Expired permission messages are left as-is in Slack — no edits, no reactions (no callback from protocol on expiry)
- Stale permission prompts look identical to active ones — if someone replies to a stale one, the 5-char ID won't match and Claude Code ignores it
- Server is stateless about pending requests — parses and forwards all valid verdicts regardless of whether the ID matches a known request

### Thread abandonment UX
- Silent switch on abandonment — old thread just goes quiet, no farewell message from Claude
- Orphaned permission prompts in abandoned threads are left naturally — verdicts still forwarded if someone replies (stateless server)
- Replies to abandoned threads are forwarded as `new_input` — never silently dropped (user messages are never lost)
- `start_thread: true` always creates a new top-level Slack message and anchors the tracker — never reuses an existing active thread

### Claude's Discretion
- Permission prompt formatting details (emoji, backtick styling, input preview truncation length)
- Error handling for failed `chat.postMessage` calls (reply tool and permission posting)
- Exact log messages and stderr formatting for debug/info events

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WebClient` already instantiated in `slack-client.ts:128` — ready for outbound `chat.postMessage` calls
- `PermissionRequest` and `PermissionVerdict` types defined in `types.ts` — match the permission relay interface
- `shouldProcessMessage()` and `isDuplicate()` pure function pattern — established for `parsePermissionReply()`, `formatPermissionRequest()`, `formatInboundNotification()`
- `createStderrLogger()` — already routes all SDK output to stderr
- `SlackMessage` interface in `slack-client.ts:27-33` — includes `thread_ts` field for threading

### Established Patterns
- Pure function extraction with injectable dependencies (Set/filter params) for testability
- Ack-first event handling with try/catch wrapper
- TTL-based dedup map with 30-second window
- All `console.error()` logging with `[module]` prefix convention

### Integration Points
- `slack-client.ts:171` — Phase 1 stub where forwarding notification should be wired (`formatInboundNotification` + `server.notification()`)
- `server.ts:57` — Reply tool stub returns hardcoded string; needs real `webClient.chat.postMessage` implementation
- `server.ts:86` — `createSlackClient(config, server)` passes server reference; Phase 2 needs `webClient` accessible for reply tool (restructure needed)
- `server.setNotificationHandler()` — for receiving `notifications/claude/channel/permission_request` from Claude Code

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The implementation plan (`docs/implementation-plan.md`) is extremely detailed and serves as the primary design reference for this phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-message-flow-permission-relay*
*Context gathered: 2026-03-26*
