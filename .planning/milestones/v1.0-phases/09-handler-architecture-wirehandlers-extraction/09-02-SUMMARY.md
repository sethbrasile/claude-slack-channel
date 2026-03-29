---
phase: 09-handler-architecture-wirehandlers-extraction
plan: "02"
subsystem: api
tags: [typescript, refactor, handlers, composition, testing]

# Dependency graph
requires:
  - phase: 09-handler-architecture-wirehandlers-extraction
    plan: "01"
    provides: PermissionRequestSchema exported from permission.ts, pendingPermissions typed via PermissionRequest
provides:
  - makeReplyHandler exported from server.ts (unit-testable handler factory)
  - wireHandlers exported from server.ts (composition root for handler registration)
  - makePermissionHandler (unexported internal, tested indirectly via wireHandlers)
affects:
  - library consumers calling createServer(config, { web, tracker }) — now also get permission handler (M2 closed)
  - 09-03 and beyond — handler logic fully composable and testable without CLI block

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Handler factory pattern: makeXHandler(deps) returns async handler fn — composable, injectable, testable"
    - "Composition root: wireHandlers() is the single place handler registration happens"
    - "Single-body principle: handler logic defined once, invoked from both library and CLI paths"

key-files:
  created: []
  modified:
    - src/server.ts
    - src/__tests__/server.test.ts

key-decisions:
  - "makeReplyHandler exported for direct unit testing (M14) — bypasses createServer and CLI block entirely"
  - "makePermissionHandler NOT exported — internal detail, tested indirectly via wireHandlers; library consumers only need wireHandlers"
  - "wireHandlers() is the composition root for both handler types; called from createServer(with deps) and CLI block once each"
  - "CLI block createServer(config) passes no deps — if (deps?.web && deps?.tracker) branch skips; wireHandlers called once from CLI block; no double registration"
  - "onMessage closure stays in CLI block unchanged — closes over mutable let messageQueue variable, not moveable into wireHandlers"

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 9 Plan 02: Handler Architecture — wireHandlers Extraction Summary

**Extracted duplicate reply handler into makeReplyHandler(), composed both handlers into wireHandlers(), and added direct unit tests bypassing the CLI block entirely**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T18:55:52Z
- **Completed:** 2026-03-28T18:58:56Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extracted the ~50-line reply handler body into `makeReplyHandler(web, tracker, config)` — now appears exactly once; eliminates the verbatim duplicate (H2 closed)
- Extracted permission notification handler into `makePermissionHandler` (unexported internal factory)
- Composed both into `wireHandlers(server, web, tracker, config, pendingPermissions)` as the single composition root for handler registration
- Updated `createServer()` library path: `if (deps?.web && deps?.tracker)` block replaced by `wireHandlers(...)` call — library consumers now also receive the permission handler (M2 closed)
- CLI block: removed two inline `setRequestHandler`/`setNotificationHandler` calls; replaced with single `wireHandlers(server, web, tracker, config, pendingPermissions)` call
- Added 13 new unit tests in two describe blocks:
  - `'makeReplyHandler — direct unit tests (M14)'`: success path, unknown tool, missing text, broadcast stripping, startThread invocation — all callable without entering CLI block
  - `'wireHandlers — handler registration (M2)'`: verifies both handlers registered; confirms `createServer(config, {web, tracker})` registers permission handler
- Test count grew from 100 to 108; all pass

## Task Commits

Each task committed atomically:

1. **Task 1: Extract makeReplyHandler, makePermissionHandler, wireHandlers** — `036f3b0` (refactor)
2. **Task 2: Add unit tests for makeReplyHandler and wireHandlers** — `8456fb5` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/server.ts` — Added module-scope `makeReplyHandler` (exported), `makePermissionHandler` (internal), `wireHandlers` (exported); replaced inline handler blocks in `createServer` and CLI block; removed duplicate 50-line reply handler body
- `src/__tests__/server.test.ts` — Updated import to include `makeReplyHandler`, `wireHandlers`; added two new describe blocks with 13 tests

## Decisions Made

- `makeReplyHandler` return type declared inline as `Promise<{ content: ...; isError?: boolean }>` — avoids importing `CallToolResult` from SDK when the structural type is sufficient and reduces coupling
- `onMessage` closure remains in CLI block — it closes over the mutable `let messageQueue` variable and cannot be lifted into `wireHandlers` without changing the queue architecture

## Deviations from Plan

None — plan executed exactly as written. Biome auto-reformatted two long lines in server.test.ts (cast expressions); applied via `bunx biome check --write .`.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- `makeReplyHandler`, `makePermissionHandler`, `wireHandlers` are all in module scope and composable
- All 108 tests pass, tsc exits 0, biome exits 0
- Requirements H2, M2, M14 closed by this plan

## Self-Check: PASSED
