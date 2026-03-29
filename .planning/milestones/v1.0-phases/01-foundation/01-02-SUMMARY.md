---
phase: 01-foundation
plan: 02
subsystem: api
tags: [mcp, slack, socket-mode, typescript, bun, biome, zod]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: "ChannelConfig + PermissionRequest/Verdict types, parseConfig, safeErrorMessage, config.test.ts baseline"
provides:
  - "MCP server factory (createServer) with experimental claude/channel + claude/channel/permission capabilities"
  - "Prompt injection hardening in instructions field"
  - "reply tool stub registered via ListToolsRequestSchema"
  - "CLI entry point with startup ordering, uncaughtException/unhandledRejection handlers, graceful shutdown"
  - "shouldProcessMessage pure function (channel + user allowlist + bot_id + subtype filtering)"
  - "isDuplicate pure function with injectable Set for testability"
  - "createStderrLogger — all Slack SDK output redirected to stderr"
  - "createSlackClient — SocketModeClient with ack-first handler, TTL dedup"
affects:
  - 01-foundation/01-03
  - 02-channel-bridge
  - 03-reply-and-permission

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure function extraction for testability: shouldProcessMessage + isDuplicate take injected parameters"
    - "Stderr-only logging: createStderrLogger routes all Slack SDK output to console.error"
    - "Startup ordering invariant: server.connect(transport) BEFORE socketMode.start()"
    - "Ack-first event handling: ack() in its own try/catch before any processing"
    - "SDK internal access pattern for tests: (server as unknown as {_capabilities?:...})._capabilities"

key-files:
  created:
    - src/server.ts
    - src/slack-client.ts
    - src/__tests__/server.test.ts
    - src/__tests__/slack-client.test.ts
  modified: []

key-decisions:
  - "Used SDK internal _capabilities/_instructions/_requestHandlers access in tests with explicit comment noting SDK-version dependency"
  - "Replaced non-null assertion (handler!) with explicit guard (if (!handler) throw) to satisfy biome noNonNullAssertion rule"
  - "Used void webClient to preserve Phase 2 reference without unused-variable error"
  - "createSlackClient start() wrapped in async arrow to coerce Promise<AppsConnectionsOpenResponse> to Promise<void>"

patterns-established:
  - "All src/ files: console.error only, zero console.log — stdout reserved for MCP JSON-RPC"
  - "Injectable pure functions: shouldProcessMessage and isDuplicate accept seen Set/filter params for unit testing without module state"
  - "Server factory pattern: createServer(config) returns configured Server, CLI wiring in import.meta.main guard"

requirements-completed: [MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, SLCK-01, SLCK-02, SLCK-03, SLCK-04, SLCK-05, SLCK-06, SLCK-07]

# Metrics
duration: 25min
completed: 2026-03-27
---

# Phase 1 Plan 2: MCP Server + Slack Client Foundation Summary

**MCP server factory with experimental channel capabilities, prompt injection hardening, and Socket Mode client with bot-loop prevention, ack-first handling, and injectable pure functions for testing**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-27T01:30:00Z
- **Completed:** 2026-03-27T01:55:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- createServer() factory declaring experimental['claude/channel'] and experimental['claude/channel/permission'] capabilities with prompt injection hardening in instructions field
- shouldProcessMessage and isDuplicate as pure functions with injectable parameters — testable without any mocking of Slack connectivity
- createStderrLogger redirects all Slack SDK output to stderr, keeping stdout clean for MCP JSON-RPC transport
- CLI entry with mandatory startup ordering (server.connect before socketMode.start), uncaughtException/unhandledRejection guards, and graceful shutdown on SIGTERM/SIGINT/stdin close
- 36 total tests passing (15 config + 7 server + 14 slack-client), lint clean, typecheck clean, zero console.log in src/

## Task Commits

Each task was committed atomically:

1. **Task 1: server.ts — MCP server factory with capabilities + reply tool stub** - `9f305f0` (feat)
2. **Task 2: slack-client.ts — Socket Mode client + filtering + dedup** - `347eaea` (feat)

_Note: TDD tasks combined RED+GREEN into single commits per task (slack-client.ts stub was necessary to unblock server.ts import in RED phase)_

## Files Created/Modified
- `src/server.ts` - MCP Server factory + CLI entry with startup ordering and graceful shutdown
- `src/slack-client.ts` - shouldProcessMessage, isDuplicate, createStderrLogger, createSlackClient
- `src/__tests__/server.test.ts` - Unit tests for capabilities, instructions, reply tool registration
- `src/__tests__/slack-client.test.ts` - Unit tests for filtering (7 cases), dedup (3 cases), stderr logger (4 cases)

## Decisions Made
- Accessed SDK internals (`_capabilities`, `_instructions`, `_requestHandlers`) in tests with inline comment noting SDK-version dependency risk
- Used explicit guard (`if (!handler) throw`) instead of non-null assertion to satisfy biome `noNonNullAssertion` lint rule
- `webClient` in `createSlackClient` preserved with `void webClient` comment for Phase 2 use to avoid premature dead-code concerns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created slack-client.ts stub before server.test.ts RED phase**
- **Found during:** Task 1 (server.ts RED phase)
- **Issue:** server.ts imports createSlackClient from slack-client.ts which didn't exist yet, causing bun test to error on module resolution before any test could fail
- **Fix:** Created minimal slack-client.ts stub exporting the interfaces and empty createSlackClient to unblock RED phase for server.test.ts; the stub was later replaced with the full implementation in Task 2
- **Files modified:** src/slack-client.ts
- **Verification:** bun test server.test.ts failed with 1 error (no createServer export) — correct RED state
- **Committed in:** 9f305f0 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed two TypeScript errors in slack-client.ts**
- **Found during:** Task 2 verification (bunx tsc --noEmit)
- **Issue 1:** `_webClient` declared but never read (TS6133 noUnusedLocals). Issue 2: `socketMode.start()` returns `Promise<AppsConnectionsOpenResponse>` not `Promise<void>` (TS2322)
- **Fix:** Renamed to `webClient`, added `void webClient` comment preserving for Phase 2; wrapped `start()` in async arrow coercing to `Promise<void>`
- **Files modified:** src/slack-client.ts
- **Verification:** bunx tsc --noEmit exits 0
- **Committed in:** 347eaea (Task 2 commit)

**3. [Rule 1 - Bug] Fixed biome noNonNullAssertion lint error in server.test.ts**
- **Found during:** Task 2 verification (bunx biome check .)
- **Issue:** `handler!` non-null assertion on line 81 of server.test.ts violates biome noNonNullAssertion rule
- **Fix:** Added explicit `if (!handler) throw new Error('handler not registered')` guard before use
- **Files modified:** src/__tests__/server.test.ts
- **Verification:** bunx biome check . exits 0 with no errors
- **Committed in:** 347eaea (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All auto-fixes necessary for correct RED phase isolation, type safety, and lint compliance. No scope creep.

## Issues Encountered
- Biome formatter required several style fixes (import ordering, line length, trailing commas) — all auto-applied via `bunx biome check --write .`

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- All transport-layer invariants locked in: stdout purity, startup ordering, bot-loop prevention, ack-first handlers
- Phase 2 channel-bridge can wire notifications to the server — `createSlackClient` accepts `server` parameter already
- WebClient is created and referenced, ready for `chat.postMessage` in Phase 2 reply tool implementation
- Concern: Phase 2 will need to verify `notifications/claude/channel` payload format against live Claude Code session

---
*Phase: 01-foundation*
*Completed: 2026-03-27*

## Self-Check: PASSED
- src/server.ts: FOUND
- src/slack-client.ts: FOUND
- src/__tests__/server.test.ts: FOUND
- src/__tests__/slack-client.test.ts: FOUND
- 01-02-SUMMARY.md: FOUND
- Commit 9f305f0: FOUND
- Commit 347eaea: FOUND
