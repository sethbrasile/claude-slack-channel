---
phase: 07-config-security-tightening
plan: "01"
subsystem: config, security
tags: [zod, typescript, regex, token-redaction, slack-sdk]

requires:
  - phase: 05-testability-dead-code-cleanup
    provides: Stable server.ts structure with injectable deps that this phase's casts build on

provides:
  - SLACK_CHANNEL_ID validated with /^[CG][A-Z0-9]+$/ regex at startup
  - safeErrorMessage applied to Slack SDK error logger output
  - PERMISSION_ID_RE pre-built constant exported from permission.ts
  - Double-cast comments documenting SDK type constraint in server.ts
  - safeErrorMessage regex broadened from [\w-]+ to [^\s]+ for token coverage
  - Tests for SLACK_CHANNEL_ID format validation (invalid format + G-prefix)

affects: [server, config, permission, slack-client, testing]

tech-stack:
  added: []
  patterns:
    - Pre-build regex constants at module load time (exported from their canonical module)
    - safeErrorMessage applied at SDK logger boundary for defense-in-depth
    - Zod schema regex validation for Slack-format IDs

key-files:
  created: []
  modified:
    - src/config.ts
    - src/permission.ts
    - src/server.ts
    - src/slack-client.ts
    - src/__tests__/config.test.ts

key-decisions:
  - "M8 direct cast (as Record<string, unknown>) rejected by tsc — TypeScript requires intermediate unknown for types without index signatures; documented with comment instead of removing double cast"
  - "PERMISSION_ID_RE exported alongside PERMISSION_ID_PATTERN for backward compatibility; server.ts drops PERMISSION_ID_PATTERN import"
  - "safeErrorMessage applied only to error log level as specified (debug/info/warn out of scope)"

patterns-established:
  - "Pre-built anchored regex pattern: construct once at module load, export as named constant"
  - "SDK type constraint comment pattern: explain why as unknown as is required rather than silently leaving it"

requirements-completed: ["M4", "M5", "M6", "M8", "L9"]

duration: 15min
completed: 2026-03-27
---

# Phase 7-01: Config & Security Tightening Summary

**Five defense-in-depth security fixes: SLACK_CHANNEL_ID format validation, Slack SDK error token redaction, pre-built PERMISSION_ID_RE constant, double-cast documentation, and broadened token regex suffix**

## Performance

- **Duration:** ~15 min
- **Tasks:** 7
- **Files modified:** 5

## Accomplishments

- `SLACK_CHANNEL_ID` now validated with `/^[CG][A-Z0-9]+$/` — invalid channel IDs cause immediate startup failure with a clear error message
- `createStderrLogger.error()` now maps all args through `safeErrorMessage` before logging — Slack SDK error output cannot expose tokens
- `PERMISSION_ID_RE` exported from `permission.ts` as a pre-built constant; `server.ts` uses it directly eliminating runtime regex construction
- `safeErrorMessage` suffix broadened from `[\w-]+` to `[^\s]+` for full non-whitespace token coverage
- Added 2 new tests: G-prefix channel ID acceptance and invalid format rejection

## Task Commits

1. **Tasks 7-01-01 + 7-01-02: M4 + L9 (config.ts)** - `671afb5` (fix)
2. **Task 7-01-03: M5 (slack-client.ts)** - `ce8c1fe` (fix)
3. **Task 7-01-04: M6 (permission.ts + server.ts)** - `da0ec5f` (fix)
4. **Task 7-01-05: M8 (server.ts double cast comments)** - `57d169e` (fix)
5. **Task 7-01-06 + 7-01-07: test extensions + final verification** - `8950bc3` (test)

## Files Created/Modified

- `src/config.ts` — SLACK_CHANNEL_ID regex validation + [^\s]+ suffix in safeErrorMessage
- `src/slack-client.ts` — createStderrLogger error method applies safeErrorMessage
- `src/permission.ts` — exports PERMISSION_ID_RE constant
- `src/server.ts` — uses PERMISSION_ID_RE from import; double casts documented with comments
- `src/__tests__/config.test.ts` — 2 new tests for SLACK_CHANNEL_ID format validation

## Decisions Made

**M8 direct cast rejected by tsc:** The plan proposed replacing `as unknown as Record<string, unknown>` with `as Record<string, unknown>`. TypeScript rejects the direct cast because neither `PermissionVerdict` nor `ChannelNotificationParams` has an index signature, and the types don't sufficiently overlap. The intermediate `unknown` is required by the TypeScript type system. Resolution: kept the double cast but added explanatory comments to both locations documenting why the intermediate `unknown` is required.

## Deviations from Plan

### Auto-fixed Issues

**1. M8 direct cast not viable — comments added instead**
- **Found during:** Task 7-01-05 (tsc verification)
- **Issue:** `as Record<string, unknown>` caused TS2352 errors on both notification params casts
- **Fix:** Restored `as unknown as Record<string, unknown>` with comments explaining the SDK constraint
- **Files modified:** src/server.ts
- **Verification:** `bunx tsc --noEmit` exits 0
- **Committed in:** 57d169e

---

**Total deviations:** 1 auto-fixed (plan assumption about TypeScript cast validity was incorrect)
**Impact on plan:** The spirit of M8 (make the casts understandable) is achieved via comments. The double cast is the correct TypeScript idiom when types lack index signatures.

## Issues Encountered

None beyond the M8 tsc finding documented above.

## Next Phase Readiness

All 5 security findings resolved. Phase 7 is complete. Phase 6 (Shutdown & Lifecycle Hardening) is the only remaining QC fix phase.

---
*Phase: 07-config-security-tightening*
*Completed: 2026-03-27*
