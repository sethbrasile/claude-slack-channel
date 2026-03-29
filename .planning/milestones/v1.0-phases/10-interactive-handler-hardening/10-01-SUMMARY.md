---
phase: 10-interactive-handler-hardening
plan: 01
subsystem: api
tags: [zod, slack, interactive, permissions, ttl, validation]

# Dependency graph
requires:
  - phase: 09-handler-architecture-wirehandlers-extraction
    provides: wireHandlers composition root, makePermissionHandler, pendingPermissions Map
provides:
  - InteractiveBodySchema Zod schema + InteractiveBody type in slack-client.ts
  - isDuplicateTs pure function + MAX_SEEN_TS constant in slack-client.ts
  - PendingPermissionEntry interface in types.ts
  - makePermissionHandler with TTL sweep (10 min) + size cap (100 entries)
  - wireHandlers + CLI block updated to use Map<string, PendingPermissionEntry>
affects:
  - 10-02 (makeInteractiveHandler extraction builds on InteractiveBodySchema)
  - Any future plan using pendingPermissions

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Zod safeParse for interactive payload validation (replaces manual `as` casts)
    - TTL sweep + size cap pattern for pendingPermissions (mirrors seenTs dedup pattern)
    - Pure function extraction (isDuplicateTs) for testability without mocking SDK

key-files:
  created: []
  modified:
    - src/slack-client.ts
    - src/types.ts
    - src/server.ts
    - src/__tests__/slack-client.test.ts
    - src/__tests__/server.test.ts

key-decisions:
  - "InteractiveBodySchema uses safeParse + stderr log on failure — invalid payloads rejected with diagnostic, not silently swallowed"
  - "isDuplicateTs extracted as pure function with explicit seenTs + now params — matches validateEventTs/shouldProcessMessage testing seam pattern"
  - "MAX_SEEN_TS=10_000 matches isDuplicateTs tests already present in working tree from prior session"
  - "PENDING_PERMISSIONS_TTL_MS=10min, PENDING_PERMISSIONS_MAX_SIZE=100 — constants named for grep-ability as specified in plan"

patterns-established:
  - "Zod safeParse with console.error on failure for external payload validation"
  - "TTL sweep before insert + size cap eviction for bounded maps"

requirements-completed: [M5, L1]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 10 Plan 01: Interactive Handler Hardening — Validation + TTL/Cap Summary

**Zod validation for Slack interactive payloads (replacing `as` casts) and TTL/size-bounded pendingPermissions Map**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-28T23:19:00Z
- **Completed:** 2026-03-28T23:25:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Exported `InteractiveBodySchema` (Zod) and `InteractiveBody` type from `slack-client.ts`; `onInteractive` handler now uses `safeParse` with logged rejection instead of unsafe `as` casts
- Exported `isDuplicateTs` pure function + `MAX_SEEN_TS=10_000` constant; message dedup logic now routes through the testable pure function
- Added `PendingPermissionEntry` interface to `types.ts`; `makePermissionHandler` now sweeps expired entries and evicts oldest on overflow before every insertion
- 123 tests pass (up from 111 — 12 new tests: 7 InteractiveBodySchema, 5 isDuplicateTs/MAX_SEEN_TS)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add InteractiveBodySchema to slack-client.ts + tests** - `ff4e124` (feat)
2. **Task 2: Add PendingPermissionEntry type + TTL/cap to makePermissionHandler** - `57a7192` (feat)

**Plan metadata:** (docs commit, see below)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `src/slack-client.ts` — Added `InteractiveBodySchema`, `InteractiveBody`, `isDuplicateTs`, `MAX_SEEN_TS`; replaced manual `as` casts with safeParse; refactored dedup to use `isDuplicateTs`
- `src/types.ts` — Added `PendingPermissionEntry` interface
- `src/server.ts` — Updated `makePermissionHandler` with TTL sweep + size cap; updated `wireHandlers` and CLI block to use `PendingPermissionEntry`; added constants; fixed pre-existing biome format issues
- `src/__tests__/slack-client.test.ts` — Added 7 `InteractiveBodySchema` tests + 5 `isDuplicateTs`/`MAX_SEEN_TS` tests; updated imports
- `src/__tests__/server.test.ts` — Updated `pendingPermissions` type to `PendingPermissionEntry`

## Decisions Made
- `InteractiveBodySchema` uses `safeParse` with `console.error` on failure — invalid payloads are rejected with a diagnostic log, not silently swallowed.
- `isDuplicateTs` extracted as pure function matching the `validateEventTs`/`shouldProcessMessage` testing seam pattern — no SocketModeClient mock needed in tests.
- `MAX_SEEN_TS=10_000` added to satisfy pre-existing `isDuplicateTs` tests already present in the working tree from a prior session.
- `PENDING_PERMISSIONS_TTL_MS` and `PENDING_PERMISSIONS_MAX_SIZE` named as module-level constants for grep-ability, matching plan spec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added isDuplicateTs pure function + MAX_SEEN_TS constant**
- **Found during:** Task 1 (InteractiveBodySchema implementation)
- **Issue:** Pre-existing working tree test file already contained `isDuplicateTs` and `MAX_SEEN_TS` tests referencing symbols not yet exported from `slack-client.ts`. `tsc` was failing for the test file until these were implemented.
- **Fix:** Exported `isDuplicateTs` pure function (wrapping the inline seenTs dedup logic) and `MAX_SEEN_TS=10_000` constant. Refactored `createSlackClient` message handler to call `isDuplicateTs` instead of duplicating the logic inline.
- **Files modified:** `src/slack-client.ts`, `src/__tests__/slack-client.test.ts`
- **Verification:** 5 new isDuplicateTs tests pass; `bunx tsc --noEmit` exits 0
- **Committed in:** `ff4e124` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed pre-existing biome format issues in permission.ts and server.ts**
- **Found during:** Task 2 verification (`bunx biome check .`)
- **Issue:** Pre-existing working tree modifications to `permission.ts` (trailing spaces before inline comments) and `server.ts` (multi-line replaceAll chain) failed biome format check.
- **Fix:** Removed trailing spaces from comment alignment; collapsed chained replaceAll to single line per biome's 80-column formatter.
- **Files modified:** `src/permission.ts`, `src/server.ts`
- **Verification:** `bunx biome check .` exits 0
- **Committed in:** `57a7192` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes necessary for tsc/biome compliance. The isDuplicateTs extraction improved testability. No scope creep.

## Issues Encountered
- `git stash` during tsc baseline check reverted working tree changes, requiring re-application of Task 1 edits. The stash interaction revealed pre-existing test additions (`isDuplicateTs` tests) that weren't in HEAD, clarifying the scope of work needed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can now use `InteractiveBodySchema` when extracting `makeInteractiveHandler`
- `PendingPermissionEntry` is ready for use in interactive handler logic
- All 123 tests pass; tsc and biome clean

---
*Phase: 10-interactive-handler-hardening*
*Completed: 2026-03-28*
