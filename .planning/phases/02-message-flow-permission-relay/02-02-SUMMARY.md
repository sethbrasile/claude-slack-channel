---
phase: 02-message-flow-permission-relay
plan: 02
subsystem: permission-relay
tags: [permission-relay, slack-client-refactor, server-wiring, tdd, bidirectional-flow]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: createSlackClient, createServer, ChannelConfig
  - phase: 02-01
    provides: ThreadTracker, formatInboundNotification

provides:
  - parsePermissionReply pure function: parses yes/no {id} verdicts with l-exclusion alphabet
  - formatPermissionRequest pure function: formats permission prompts with mention/backtick sanitization
  - createSlackClient refactored: callback pattern returning { socketMode, web }
  - server.ts CLI: fully wired reply tool, permission relay, channel bridge, thread tracking

affects:
  - 03-integration: full bidirectional flow operational — integration tests can exercise end-to-end

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD red-green for permission pure functions
    - Callback injection in createSlackClient for inbound message dispatch
    - Zod inline schema for setNotificationHandler (PermissionRequestSchema)
    - Double-cast (as unknown as Record<string, unknown>) for server.notification() params

key-files:
  created:
    - src/permission.ts
    - src/__tests__/permission.test.ts
  modified:
    - src/slack-client.ts
    - src/server.ts

key-decisions:
  - "createSlackClient returns { socketMode, web } — caller controls lifecycle and owns web for outbound calls"
  - "Permission verdict mutual exclusivity enforced via early return in onMessage callback — not forwarded as channel notification"
  - "server.notification() params require double cast (as unknown as Record<string, unknown>) — PermissionVerdict and ChannelNotificationParams lack index signature"
  - "Permission request handler registered after createSlackClient — web must exist when handler fires; closure reference ensures correctness"
  - "ThreadTracker NOT anchored in permission handler — tracker stays bound to original command thread so yes/no reply classifies as thread_reply"

# Metrics
duration: ~5min
completed: 2026-03-27
---

# Phase 2 Plan 02: Permission Relay + Server Wiring Summary

**Bidirectional message flow complete — permission relay (parsePermissionReply + formatPermissionRequest), refactored createSlackClient callback pattern, and fully wired server.ts CLI with reply tool, permission relay, channel bridge, and thread tracking — 63 tests passing**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-27
- **Completed:** 2026-03-27
- **Tasks:** 2 (3 commits: 1 RED + 1 GREEN + 1 feat)
- **Files modified:** 4

## Accomplishments

- `parsePermissionReply` handles all 10 test cases: yes/no/y/n verbs, case insensitive, 5-char l-excluding alphabet, whitespace trimming, null on invalid input
- `formatPermissionRequest` produces properly formatted Slack message with triple-backtick sanitization (zero-width space injection) and broadcast mention stripping
- `createSlackClient` refactored from `(config, _server)` returning `{ start, stop }` to `(appToken, botToken, filter, onMessage)` returning `{ socketMode, web }` — pure callback pattern
- `server.ts` CLI fully wired: inbound verdict check → early return before channel forward; reply tool posts to Slack with start_thread anchor guard; permission request handler posts in active thread
- Full test suite: 63 tests pass, TypeScript clean, Biome clean

## Task Commits

Each task committed atomically:

1. **Task 1 RED: failing permission tests** — `c9d5231` (test)
2. **Task 1 GREEN: parsePermissionReply + formatPermissionRequest** — `d2c49b2` (feat)
3. **Task 2: slack-client refactor + server wiring** — `6e83ab3` (feat)

## Files Created/Modified

- `src/permission.ts` — parsePermissionReply and formatPermissionRequest pure functions
- `src/__tests__/permission.test.ts` — 15 tests covering all 10 parsePermissionReply cases and 3 formatPermissionRequest sanitization cases
- `src/slack-client.ts` — createSlackClient refactored to callback pattern; removed old `(config, _server)` signature; onMessage callback dispatched after dedup; returns `{ socketMode, web }`
- `src/server.ts` — CLI block rewritten: createSlackClient → setNotificationHandler for permission_request → setRequestHandler for reply tool; startup ordering preserved; socketMode.disconnect() + server.close() on shutdown

## Decisions Made

- `createSlackClient` returns `{ socketMode, web }` so the caller (server.ts CLI) controls start/stop lifecycle and owns `web` for both reply tool and permission relay outbound calls.
- Permission verdicts (yes/no {id}) are consumed exclusively in the onMessage callback via `parsePermissionReply` and NOT forwarded as channel notifications — enforced by early return.
- `server.notification()` in the MCP SDK requires params with index signature `[x: string]: unknown`. Since `PermissionVerdict` and `ChannelNotificationParams` are typed structs without this, they need double casting: `as unknown as Record<string, unknown>`.
- The `ThreadTracker` is NOT anchored in the permission request handler — anchoring happens only on `start_thread: true` in the reply tool, ensuring the tracker stays bound to the user's command thread so yes/no replies route correctly as `thread_reply`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type errors on server.notification() params**
- **Found during:** Task 2
- **Issue:** `PermissionVerdict` and `ChannelNotificationParams` lack `[x: string]: unknown` index signature required by the MCP SDK's `server.notification()` params type
- **Fix:** Double cast via `as unknown as Record<string, unknown>` at both call sites
- **Files modified:** `src/server.ts`
- **Committed in:** `6e83ab3`

**2. [Rule 1 - Bug] TypeScript type narrowing error on regex match groups**
- **Found during:** Task 1 GREEN
- **Issue:** `match[1]` and `match[2]` typed as `string | undefined` after `text.match()` — TypeScript could not narrow them without explicit checks
- **Fix:** Added `!match?.[1] || !match[2]` guard before accessing match groups
- **Files modified:** `src/permission.ts`
- **Committed in:** `93ffa7d`

**3. [Rule 1 - Bug] Biome organizeImports ordering in server.ts**
- **Found during:** Task 2
- **Issue:** Local imports not in alphabetical order — `config.ts` before `channel-bridge.ts`
- **Fix:** `bunx biome check --write .` auto-sorted
- **Files modified:** `src/server.ts`
- **Committed in:** `6e83ab3`

---

**Total deviations:** 3 auto-fixed (Rule 1 - type/lint correctness)
**Impact on plan:** No behavior change. All fixes were TypeScript/Biome correctness requirements.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None.

## Next Phase Readiness

- Full bidirectional flow operational: Claude → reply tool → Slack, Slack → channel notification → Claude, permission_request → Slack → yes/no → permission verdict → Claude
- Phase 3 integration tests can exercise the complete flow end-to-end
- No blockers

---
*Phase: 02-message-flow-permission-relay*
*Completed: 2026-03-27*

## Self-Check: PASSED

- src/permission.ts: FOUND
- src/__tests__/permission.test.ts: FOUND
- src/slack-client.ts: FOUND
- src/server.ts: FOUND
- 02-02-SUMMARY.md: FOUND
- Commit c9d5231 (RED): FOUND
- Commit d2c49b2 (GREEN): FOUND
- Commit 6e83ab3 (feat): FOUND
