---
phase: 14-test-coverage-gaps
plan: 01
subsystem: testing
tags: [typescript, bun, slack, mcp, dedup, permissions, shutdown]

# Dependency graph
requires:
  - phase: 09-handler-architecture-wirehandlers-extraction
    provides: makeReplyHandler exported, wireHandlers composition root
  - phase: 10-interactive-handler-hardening
    provides: InteractiveBodySchema, PendingPermissionEntry
provides:
  - isDuplicateTs pure function exported from slack-client.ts (testable seam)
  - MAX_SEEN_TS = 10_000 upper-bound cap exported
  - InteractiveBodySchema Zod validation exported (Rule 3 auto-fix)
  - threads.ts classifyMessage with explicit empty-string guard
  - permission.ts stripMentions covers both <! and <@ patterns
  - permission.ts formatPermissionResult validates userId format
  - server.ts makeReplyHandler strips both broadcast and user mentions
  - server.ts shutdown() has 5-second forced-exit timeout with unref()
  - package.json examples removed from npm files array
affects: [14-02-test-coverage-gaps, future testing phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure function extraction for testability (isDuplicateTs follows validateEventTs/shouldProcessMessage pattern)"
    - "Zod safeParse replaces manual 'as' casts for external payload validation"
    - "Forced-exit timer with unref() for graceful shutdown hardening"

key-files:
  created: []
  modified:
    - src/slack-client.ts
    - src/__tests__/slack-client.test.ts
    - src/threads.ts
    - src/permission.ts
    - src/server.ts
    - package.json

key-decisions:
  - "isDuplicateTs exported as testing seam only — DEDUP_TTL_MS stays module-private"
  - "userId validation in formatPermissionResult logs warning but does not throw — avoids breaking update flow"
  - "InteractiveBodySchema added as Rule 3 auto-fix (pre-written tests blocked module load)"
  - "5-second forced-exit timer uses unref() so clean exit can proceed without waiting"

patterns-established:
  - "Exported pure functions (isDuplicateTs, validateEventTs, shouldProcessMessage) as lightweight testing seams without mocking SocketModeClient"

requirements-completed: [L2, L3, L4, L9, L11, M4, M12]

# Metrics
duration: 65min
completed: 2026-03-28
---

# Phase 14 Plan 01: Source Hardening Fixes Summary

**Six source-level prerequisite fixes: isDuplicateTs extraction with 10k cap, mention-stripping for user mentions, userId validation, forced-exit shutdown timer, and examples removed from npm package**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-03-28T23:22:49Z
- **Completed:** 2026-03-28T23:25:03Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extracted `isDuplicateTs` as an exported pure function with TTL sweep and MAX_SEEN_TS=10_000 cap — replaces inline dedup block in message handler
- Added `InteractiveBodySchema` Zod validation replacing manual `as` casts in interactive handler (Rule 3 auto-fix)
- Applied 5 targeted fixes: empty-string guard in threads.ts, expanded mention-stripping in permission.ts and server.ts, userId validation logging, forced-exit shutdown timer, examples removed from npm tarball
- Brought test suite from 90→123 tests passing with 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract isDuplicateTs + add InteractiveBodySchema** - `ff4e124` (feat — pre-existing from prior session)
2. **Task 2: Four targeted source fixes** - `03d6e7f` (fix)

## Files Created/Modified
- `src/slack-client.ts` - Added `isDuplicateTs` pure function, `MAX_SEEN_TS` constant, `InteractiveBodySchema` Zod schema, `InteractiveBody` type; replaced inline dedup and manual `as` casts
- `src/__tests__/slack-client.test.ts` - Added imports for `isDuplicateTs`, `MAX_SEEN_TS`, `InteractiveBodySchema`; added 5 isDuplicateTs tests + 7 InteractiveBodySchema tests
- `src/threads.ts` - Added explicit `if (threadTs === '')` guard before falsy check in classifyMessage
- `src/permission.ts` - Expanded `stripMentions` to cover `<@` user mentions; added userId format validation in `formatPermissionResult`
- `src/server.ts` - Expanded `makeReplyHandler` to strip both `<!` and `<@`; added forced-exit setTimeout in shutdown()
- `package.json` - Removed `"examples"` from npm `files` array

## Decisions Made
- `isDuplicateTs` is exported only as a testing seam — `DEDUP_TTL_MS` stays module-private
- `formatPermissionResult` userId validation logs a warning but does not throw — avoids breaking the permission update flow for unexpected userId formats
- Forced-exit timer uses `unref()` so a clean exit (no hang) doesn't wait for the timer
- `examples` removed from npm tarball to keep package lean; directory remains in git for GitHub users

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added InteractiveBodySchema to unblock pre-written tests**
- **Found during:** Task 1 (extract isDuplicateTs)
- **Issue:** `src/__tests__/slack-client.test.ts` imported `InteractiveBodySchema` (written ahead for Phase 10) but the export didn't exist, causing module load failure and preventing ALL slack-client tests from running
- **Fix:** Added `InteractiveBodySchema` Zod schema and `InteractiveBody` type to `slack-client.ts`; replaced manual `as` casts in interactive handler with `safeParse` + stderr log on validation failure
- **Files modified:** src/slack-client.ts
- **Verification:** All 7 InteractiveBodySchema tests pass; bun test clean
- **Committed in:** `ff4e124` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix essential — test suite was broken before this. No scope creep; InteractiveBodySchema was already planned for Phase 10 and the tests were pre-written.

## Issues Encountered
- Bun module cache caused false `isDuplicateTs is not defined` errors during test runs after `bun pm cache rm`. Resolved with `--no-install` flag; cache was re-populated on next normal run.

## Next Phase Readiness
- All source prerequisites for Plan 02 (test coverage) are in place
- `isDuplicateTs` and `MAX_SEEN_TS` importable for dedup coverage tests
- `classifyMessage` empty-string behavior explicit and testable
- `stripMentions` `<@` coverage verifiable in permission.test.ts
- `shutdown` forced-exit timer testable in server.test.ts (with timer mocking)
- 123 tests passing, tsc clean, biome clean — baseline established for Plan 02

---
*Phase: 14-test-coverage-gaps*
*Completed: 2026-03-28*
