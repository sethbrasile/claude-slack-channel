---
phase: 2
name: Error Handling & Testability Fixes
type: qc-fix
findings: QC-1-02, QC-1-05, QC-1-06
---

## Goal

Fix fatal error handling and make critical paths testable with real assertions.

## Findings Addressed

- **QC-1-02 (critical):** uncaughtException/unhandledRejection handlers log but don't call `process.exit(1)`, leaving process in undefined state after fatal exception. Add `process.exit(1)` after each `console.error()`.
- **QC-1-05 (high):** `recentTs` and `isDuplicate` are module-level singletons — move into `createSlackClient` closure and export `isDuplicate` as standalone function accepting the Set for testing.
- **QC-1-06 (high):** config.test.ts is empty stub — add happy-path test calling `parseConfig` with valid env, add negative tests using `spyOn(process, 'exit')` for bad token prefix, invalid user ID, missing fields. Consider making `parseConfig` throw instead of calling `process.exit(1)`.

## Scope

- docs/implementation-plan.md Task 2 (lines ~390-395) — error handlers
- docs/implementation-plan.md Task 3 (lines ~554-563) — dedup Set
- docs/implementation-plan.md Task 2 (lines ~307-319) — config tests

## Success Criteria

- [ ] Both uncaught exception handlers include `process.exit(1)`
- [ ] `recentTs` Set is scoped inside `createSlackClient` closure
- [ ] `isDuplicate` exported as testable standalone function
- [ ] config.test.ts has happy-path assertion on returned shape
- [ ] config.test.ts has negative tests for bad token prefix, invalid user ID, missing field
