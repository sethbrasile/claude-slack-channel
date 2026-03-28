---
phase: 09-handler-architecture-wirehandlers-extraction
plan: "01"
subsystem: api
tags: [zod, typescript, permissions, refactor]

# Dependency graph
requires:
  - phase: 04-package-documentation
    provides: finalized permission.ts with formatPermissionBlocks, formatPermissionResult, parseButtonAction
provides:
  - PermissionRequestSchema exported from permission.ts (importable by wireHandlers and tests)
  - pendingPermissions typed as Map<string, { params: PermissionRequest }>
  - formatPermissionRequest JSDoc testability comment
affects:
  - 09-02-handler-architecture-wirehandlers-extraction (depends on PermissionRequestSchema importable from permission.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema co-location: Zod schemas live in the same module as the functions they validate"
    - "Type alias over anonymous inline: use named interface (PermissionRequest) instead of repeating 4-field inline type"

key-files:
  created: []
  modified:
    - src/permission.ts
    - src/server.ts

key-decisions:
  - "PermissionRequestSchema moved to permission.ts where it co-locates with other permission validators (parsePermissionReply, parseButtonAction)"
  - "pendingPermissions uses Map<string, { params: PermissionRequest }> — PermissionRequest is the authoritative interface from types.ts"
  - "formatPermissionRequest JSDoc comment documents export-for-testability rationale before plan 02 test expansion"

patterns-established:
  - "Schema co-location: Zod validation schemas live alongside the functions that use them, not in the calling module"

requirements-completed: [M3, L7, L8]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 9 Plan 01: Handler Architecture — Schema Migration Summary

**PermissionRequestSchema migrated to permission.ts with co-located Zod import, pendingPermissions typed via PermissionRequest interface, and formatPermissionRequest documented for testability**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T00:00:00Z
- **Completed:** 2026-03-28T00:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Exported `PermissionRequestSchema` from `permission.ts` alongside other permission validation functions — schema now co-located with its domain
- Fixed `pendingPermissions` to use `Map<string, { params: PermissionRequest }>` instead of repeating the 4-field anonymous inline type
- Added JSDoc comment to `formatPermissionRequest` documenting its export-for-testability rationale
- Removed `PERMISSION_ID_RE` from `server.ts` imports (no longer needed directly — consumed by schema in permission.ts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Move PermissionRequestSchema to permission.ts and add formatPermissionRequest comment** - `4d3b78d` (feat)
2. **Task 2: Update server.ts — import PermissionRequestSchema from permission.ts and fix pendingPermissions type** - `8cafe89` (refactor)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/permission.ts` - Added `import { z } from 'zod'`, exported `PermissionRequestSchema`, added JSDoc on `formatPermissionRequest`
- `src/server.ts` - Import `PermissionRequestSchema` and `PermissionRequest` from their respective modules; replace anonymous inline type; remove inline schema definition; remove `PERMISSION_ID_RE` direct import

## Decisions Made
- `PermissionRequestSchema` placed at the end of `permission.ts` after all function exports — keeps it visually grouped with the validation layer
- Biome auto-sorted the named imports in `server.ts` alphabetically (no manual intervention needed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `PermissionRequestSchema` is now importable from `permission.ts` — prerequisite for Plan 02's `wireHandlers` extraction
- `pendingPermissions` uses the canonical `PermissionRequest` type — wire handler refactor can reference the typed map directly
- All 100 tests pass, tsc exits 0, biome exits 0

## Self-Check: PASSED

---
*Phase: 09-handler-architecture-wirehandlers-extraction*
*Completed: 2026-03-28*
