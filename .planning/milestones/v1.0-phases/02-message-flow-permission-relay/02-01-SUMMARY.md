---
phase: 02-message-flow-permission-relay
plan: 01
subsystem: messaging
tags: [thread-tracking, message-classification, channel-protocol, slack, tdd]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: SlackMessage interface from slack-client.ts

provides:
  - ThreadTracker class: classifies Slack messages as thread_reply or new_input
  - formatInboundNotification pure function: shapes SlackMessage into ChannelNotificationParams
  - 12 unit tests covering all classification scenarios and meta key invariants

affects:
  - 02-02 (permission relay): both modules wired into server.ts message dispatch
  - 03-integration: ThreadTracker state used to route replies vs new commands

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD red-green cycle with per-phase commits
    - Pure functions for testability (no module state in formatInboundNotification)
    - Private backing field with public getter for encapsulated state (ThreadTracker._activeThreadTs)

key-files:
  created:
    - src/threads.ts
    - src/channel-bridge.ts
    - src/__tests__/threads.test.ts
    - src/__tests__/channel-bridge.test.ts
  modified: []

key-decisions:
  - "ThreadTracker uses null-safe get activeThreadTs — no defensive null guards needed at call sites"
  - "ChannelNotificationParams meta.thread_ts absent (not null/undefined) when no thread — avoids protocol noise"
  - "Import order in test files follows Biome organizeImports convention: type imports before value imports within same module"

patterns-established:
  - "TDD: RED commit before GREEN commit, named test(02-01): RED — and feat(02-01):"
  - "Biome organizeImports: type imports sort before value imports from same module path"

requirements-completed: [THRD-01, THRD-02, THRD-03, BRDG-01, BRDG-02]

# Metrics
duration: 12min
completed: 2026-03-26
---

# Phase 2 Plan 01: ThreadTracker and formatInboundNotification Summary

**ThreadTracker state machine and formatInboundNotification pure function implementing the bidirectional message flow foundation — 48 tests passing, underscore-only meta keys enforced**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-26
- **Completed:** 2026-03-26
- **Tasks:** 2 (4 commits: 2 RED + 2 GREEN)
- **Files modified:** 4

## Accomplishments

- ThreadTracker classifies top-level messages as new_input, thread replies as thread_reply, stale thread replies as new_input, and all messages when inactive as new_input
- formatInboundNotification produces correct content/source/meta shape with thread_ts included only when present and all meta keys using underscores
- Full test suite expanded from 36 to 48 tests — all pass, typecheck clean, lint clean

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: ThreadTracker failing tests** - `d9e9667` (test)
2. **Task 1 GREEN: ThreadTracker state machine** - `8d550e7` (feat)
3. **Task 2 RED: formatInboundNotification failing tests** - `592e95a` (test)
4. **Task 2 GREEN: formatInboundNotification + lint fixes** - `64c383d` (feat)

_Note: TDD tasks have separate RED and GREEN commits per cycle_

## Files Created/Modified

- `src/threads.ts` - ThreadTracker class with activeThreadTs getter, startThread, abandon, classifyMessage
- `src/channel-bridge.ts` - formatInboundNotification pure function converting SlackMessage to ChannelNotificationParams
- `src/__tests__/threads.test.ts` - 8 unit tests for all ThreadTracker classification scenarios
- `src/__tests__/channel-bridge.test.ts` - 4 unit tests including BRDG-02 meta key hyphen invariant

## Decisions Made

- ChannelNotificationParams.meta.thread_ts is absent (key not present) when no thread — not set to undefined or null. This avoids sending noise to the Channel protocol.
- Biome organizeImports requires type imports to sort before value imports from the same module path — applied in both test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed import ordering in test files to satisfy Biome**
- **Found during:** Task 2 (channel-bridge.ts GREEN phase)
- **Issue:** Both test files had non-alphabetical import order within same-module type/value imports — Biome `organizeImports` reported 2 errors blocking clean lint gate
- **Fix:** Applied `bunx biome check --write .` to auto-sort imports in both test files
- **Files modified:** `src/__tests__/channel-bridge.test.ts`, `src/__tests__/threads.test.ts`
- **Verification:** `bunx biome check .` exits 0
- **Committed in:** `64c383d` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - import ordering)
**Impact on plan:** Trivially scoped to import ordering. No behavior change.

## Issues Encountered

None — implementation matched plan exactly. ThreadTracker and formatInboundNotification are both simple enough that GREEN phase needed no iteration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ThreadTracker and formatInboundNotification ready to wire into server.ts message dispatch loop
- Plan 02-02 can import both modules immediately
- No blockers

---
*Phase: 02-message-flow-permission-relay*
*Completed: 2026-03-26*

## Self-Check: PASSED

All created files and task commits verified present on disk.
