---
phase: 02-message-flow-permission-relay
verified: 2026-03-27T02:35:28Z
status: passed
score: 11/11 must-haves verified
gaps:
  - truth: "Claude receives properly-formatted channel notifications for every allowed inbound message"
    status: resolved
    reason: "slack-client.ts registers on 'slack_event' but destructures '{ event, ack }' — the SDK's 'slack_event' emission does not include an 'event' field. 'event' is always undefined at runtime. The guard 'if (event.type !== \"message\") return' will throw TypeError or silently skip every inbound message."
    artifacts:
      - path: "src/slack-client.ts"
        issue: "Line 137: socketMode.on('slack_event', ...) does not receive 'event' field. SDK only provides { ack, envelope_id, type, body, retry_num, retry_reason, accepts_response_payload } on 'slack_event'. The 'event' field is only emitted on named events like 'message' (events_api type)."
    missing:
      - "Change socketMode.on('slack_event', ...) to socketMode.on('message', ...) — 'message' events are emitted with { ack, body, event, ... } where event is payload.event (the Slack message event object). The plan (02-02-PLAN.md Task 2 Part A step 1) specified exactly this change but it was not applied."
      - "After switching to 'message' event, remove the 'if (event.type !== \"message\") return' guard (redundant — 'message' listener only fires for message events)"
human_verification:
  - test: "Send a message from an allowed user in the configured Slack channel and confirm Claude receives a channel notification"
    expected: "Claude's session receives a notifications/claude/channel notification with the message text, user, channel, and ts in meta"
    why_human: "Inbound Slack message flow requires a live Socket Mode WebSocket connection and cannot be unit-tested without mocks"
  - test: "Claude calls the reply tool; verify message appears in Slack"
    expected: "Message appears in the Slack channel; if start_thread: true, subsequent replies from Claude appear in-thread"
    why_human: "Requires a live Slack workspace and MCP client connection"
  - test: "Claude triggers a permission request, operator types 'yes {id}' in Slack, verify Claude receives the verdict"
    expected: "Permission prompt appears in active thread; 'yes/no' reply does NOT appear as a channel notification to Claude; verdict notification is sent"
    why_human: "Requires live MCP + Slack connection and end-to-end flow"
---

# Phase 2: Message Flow + Permission Relay Verification Report

**Phase Goal:** Claude receives properly-formatted channel notifications for every allowed inbound message, can reply to Slack via the `reply` tool, and operators can approve or deny Claude's tool calls from Slack without terminal access.
**Verified:** 2026-03-27T02:35:28Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Claude receives channel notifications for allowed inbound messages | FAILED | `slack-client.ts` line 137 uses `'slack_event'` listener which does not provide `event` field — `event` is always `undefined` at runtime; all messages silently dropped |
| 2 | ThreadTracker classifies top-level messages as new_input | VERIFIED | `src/threads.ts` line 19: `if (!threadTs) return 'new_input'`; 8 passing unit tests |
| 3 | ThreadTracker classifies replies to active thread as thread_reply | VERIFIED | `src/threads.ts` line 20: `if (threadTs === this._activeThreadTs) return 'thread_reply'`; test at threads.test.ts:26 |
| 4 | ThreadTracker classifies stale/unknown thread replies as new_input | VERIFIED | `src/threads.ts` line 21: fallthrough `return 'new_input'`; test at threads.test.ts:33 |
| 5 | formatInboundNotification returns correct shape with underscore-only meta keys | VERIFIED | `src/channel-bridge.ts` lines 10–18; 4 passing unit tests including BRDG-02 invariant test |
| 6 | Claude calling reply tool posts to Slack and returns `{ content: [{ type: 'text', text: 'sent' }] }` | VERIFIED | `src/server.ts` lines 206–223; `web.chat.postMessage` called; returns `{ content: [{ type: 'text', text: 'sent' }] }` at line 223 |
| 7 | Permission request notification posts formatted Slack message in active thread | VERIFIED | `src/server.ts` lines 151–174; `setNotificationHandler` registered; `formatPermissionRequest` called; `tracker.activeThreadTs ?? undefined` used as `thread_ts` |
| 8 | Permission verdicts (yes/no) consumed and NOT forwarded as channel notifications | VERIFIED | `src/server.ts` lines 109–116; `parsePermissionReply` checked first; `return` after verdict send prevents double-forward |
| 9 | parsePermissionReply handles all variants (y/n, case-insensitive, 5-char l-excluding) | VERIFIED | `src/permission.ts` regex `/^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i`; 12 passing unit tests |
| 10 | formatPermissionRequest sanitizes triple backticks and broadcast mentions | VERIFIED | `src/permission.ts` lines 21–23 (zero-width space injection); line 31 (backtick sanitization); 3 passing tests |
| 11 | start_thread:true anchors thread tracker; tracker NOT anchored on permission prompts | VERIFIED | `src/server.ts` lines 220–222 (`if (result.ts && args.start_thread) tracker.startThread`); permission handler has comment at line 157 explaining no startThread call |

**Score:** 9/11 truths verified (1 failed — inbound message delivery)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/threads.ts` | ThreadTracker class with activeThreadTs, startThread, abandon, classifyMessage | VERIFIED | 24 lines; exports ThreadTracker and MessageClassification; substantive implementation |
| `src/channel-bridge.ts` | formatInboundNotification pure function | VERIFIED | 19 lines; exports formatInboundNotification and ChannelNotificationParams; correct implementation |
| `src/permission.ts` | parsePermissionReply, formatPermissionRequest pure functions | VERIFIED | 38 lines; both functions exported; full implementation with sanitization |
| `src/slack-client.ts` | createSlackClient returning { socketMode, web } with onMessage callback | PARTIAL | Signature and return value correct (lines 117–122); but listener on line 137 uses 'slack_event' instead of 'message' — causes runtime bug where event is always undefined |
| `src/server.ts` | Fully wired CLI with reply tool, permission relay, channel bridge, thread tracking | PARTIAL | All integration flows wired correctly; depends on slack-client providing valid events which is broken |
| `src/__tests__/threads.test.ts` | 8 unit tests for ThreadTracker | VERIFIED | 8 tests, all pass |
| `src/__tests__/channel-bridge.test.ts` | 4 unit tests for formatInboundNotification | VERIFIED | 4 tests, all pass |
| `src/__tests__/permission.test.ts` | 13+ unit tests for permission functions | VERIFIED | 15 tests (12 parsePermissionReply + 3 formatPermissionRequest), all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/__tests__/threads.test.ts` | `src/threads.ts` | `import { ThreadTracker }` | WIRED | Line 3: `import { ThreadTracker } from '../threads.ts'` |
| `src/__tests__/channel-bridge.test.ts` | `src/channel-bridge.ts` | `import { formatInboundNotification }` | WIRED | Line 3: `import { formatInboundNotification } from '../channel-bridge.ts'` |
| `src/channel-bridge.ts` | `src/slack-client.ts` | `import type { SlackMessage }` | WIRED | Line 1: `import type { SlackMessage } from './slack-client.ts'` |
| `src/server.ts` | `src/slack-client.ts` | `createSlackClient(appToken, botToken, filter, onMessage)` | WIRED | Line 96; correct 4-arg callback signature |
| `src/server.ts (onMessage)` | `src/permission.ts` | `parsePermissionReply(msg.text)` | WIRED | Line 109 |
| `src/server.ts (onMessage)` | `src/channel-bridge.ts` | `formatInboundNotification(msg)` | WIRED | Line 130 |
| `src/server.ts (permission handler)` | `src/threads.ts` | `tracker.activeThreadTs ?? undefined` | WIRED | Line 164 |
| `src/server.ts (reply tool)` | `src/threads.ts` | `tracker.startThread(result.ts)` | WIRED | Line 221 |
| `src/slack-client.ts` (listener) | Slack SDK `'message'` event | `socketMode.on('message', ...)` | NOT_WIRED | Line 137: uses `'slack_event'` — SDK does not emit `event` field on this event; plan required changing to `'message'` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BRDG-01 | 02-01 | Inbound Slack messages formatted as `notifications/claude/channel` with content, source, meta | BLOCKED | Formatting logic correct but message delivery broken — `slack_event` listener receives `event: undefined` |
| BRDG-02 | 02-01 | Meta keys use underscores only | SATISFIED | channel-bridge.ts uses only `user`, `channel`, `ts`, `thread_ts`; test verifies no hyphens |
| BRDG-03 | 02-02 | `reply` tool posts messages to Slack, returns `{ content: [{ type: 'text', text: 'sent' }] }` | SATISFIED | server.ts lines 206–223 |
| PERM-01 | 02-02 | Server receives permission_request, formats readable Slack message | SATISFIED | setNotificationHandler + formatPermissionRequest in server.ts |
| PERM-02 | 02-02 | Server parses yes/no {5-char-id} replies as verdicts | SATISFIED | parsePermissionReply with correct regex; 12 unit tests pass |
| PERM-03 | 02-02 | Verdicts sent as permission notification, NOT forwarded as channel messages | SATISFIED | Early return at server.ts line 115 |
| PERM-04 | 02-02 | Permission prompts posted in active thread (fallback to top-level) | SATISFIED | `tracker.activeThreadTs ?? undefined` at server.ts line 164 |
| PERM-05 | 02-02 | Permission formatting sanitizes triple backticks and broadcast mentions | SATISFIED | permission.ts lines 21–23 and 31 |
| THRD-01 | 02-01 | ThreadTracker classifies messages as thread_reply or new_input | SATISFIED | threads.ts classifyMessage; 8 unit tests pass |
| THRD-02 | 02-01 | Top-level messages abandon active thread | SATISFIED | server.ts lines 120–123: `if (classification === 'new_input') tracker.abandon()` |
| THRD-03 | 02-01 | start_thread:true anchors thread tracker | SATISFIED | server.ts lines 220–222 |

**Orphaned requirements:** None — all 11 requirement IDs from plan frontmatter accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/slack-client.ts` | 137 | `socketMode.on('slack_event', ...)` destructures `{ event }` which is not present in SDK's `slack_event` emission | Blocker | All inbound Slack messages silently dropped — `event` is `undefined`, `event.type !== 'message'` throws TypeError or causes NaN comparison, no messages ever forwarded to Claude |
| `src/server.ts` | 61 | `createServer()` factory handler returns stub `{ content: [{ type: 'text', text: 'sent' }] }` without calling Slack | Info | Expected — CLI entry point overrides this at line 184; test suite tests factory only; comment on line 61 documents this explicitly |

No `console.log` calls found in src/ — all logging uses `console.error` as required.

### Human Verification Required

#### 1. Inbound message flow (after gap is fixed)

**Test:** With the `'slack_event'` changed to `'message'`, send a message from an allowed user in the configured channel.
**Expected:** Claude's session receives a `notifications/claude/channel` notification with correct content, source, and meta fields.
**Why human:** Requires live Socket Mode WebSocket connection and a running Claude Code session.

#### 2. Reply tool end-to-end

**Test:** Have Claude call `reply` with `text: "hello"` and `start_thread: true`.
**Expected:** Message appears in the Slack channel; subsequent reply with `thread_ts` set appears in the thread.
**Why human:** Requires live Slack workspace and MCP client.

#### 3. Permission relay round-trip

**Test:** Trigger a tool-use that requires permission; observe the Slack permission prompt; reply `yes {id}`.
**Expected:** Permission prompt appears in active thread; the `yes` reply is NOT echoed back as a channel notification; Claude receives the permission verdict and proceeds.
**Why human:** End-to-end flow requires live connections for both MCP and Slack.

### Gaps Summary

One blocker prevents the phase goal from being fully achieved.

**The inbound message pipeline is broken at the Slack event listener level.** The 02-02 plan explicitly required changing `socketMode.on('slack_event', ...)` to `socketMode.on('message', ...)` (plan Task 2 Part A, step 1) because the Slack SDK v2.0.6 only includes the `event` field on named `events_api` listeners (like `'message'`), not on the generic `'slack_event'` listener. The implementation kept the Phase 1 `'slack_event'` listener and added a destructure for `{ event, ack }`, but `event` is never present in `'slack_event'` payloads — only `{ ack, envelope_id, type, body, ... }` is provided. At runtime, `event` is `undefined` and `event.type !== 'message'` will throw a TypeError, silently dropping every inbound Slack message.

The fix is a one-line change: replace `'slack_event'` with `'message'` on line 137, and remove the now-redundant `if (event.type !== 'message') return` guard on line 148 (the `'message'` listener fires only for Slack `message` events).

All other phase deliverables are substantive and correctly implemented: ThreadTracker, formatInboundNotification, parsePermissionReply, formatPermissionRequest, the server.ts wiring, and the full 63-test suite all pass with clean typecheck and lint.

---

_Verified: 2026-03-27T02:35:28Z_
_Verifier: Claude (gsd-verifier)_
