---
plan: 06-01
phase: 6
status: complete
completed: 2026-03-27
tasks_total: 4
tasks_complete: 4
commits:
  - 572104f
  - 8ae097e
  - 2945306
---

# Plan 06-01 Summary: Shutdown Guard + ts-Missing Logging

## What Was Built

Applied three targeted fixes to close shutdown idempotency gap (M1) and add diagnostic logging for events without a `ts` field (L1).

## Changes Made

### src/server.ts
- Added `let shutdownInitiated = false` guard before `shutdown()`
- `shutdown()` now checks guard first — second invocation logs `[shutdown] already in progress, ignoring {signal}` and returns immediately
- `shutdownInitiated = true` set synchronously before first `await` to prevent race
- `const drainQueue = messageQueue` captures queue reference immediately after `socketMode.disconnect()` resolves — prevents post-disconnect race from extending drain target
- Biome formatting fix: collapsed multi-line permission import to single line

### src/slack-client.ts
- Added `validateEventTs(ts: string | undefined): string | null` exported pure function
- Logs `[slack-client] event without ts` to stderr when ts is missing/empty, returns null
- Event handler uses `validateEventTs()` — null return triggers early return before `seenTs.set()`, preventing empty-string ts from polluting the dedup map

### src/__tests__/slack-client.test.ts
- Added `validateEventTs` to imports
- Added 4 unit tests: valid ts passthrough, undefined logging, empty string logging, structural seenTs non-pollution proof

## Self-Check

- [x] SC1: `shutdownInitiated` guard — second signal is a no-op with log line ✓
- [x] SC2: `const drainQueue = messageQueue` captured after disconnect resolves ✓
- [x] SC3: Missing/empty ts logs `[slack-client] event without ts` to stderr ✓
- [x] SC4: `seenTs.set()` never reached when ts is null — no map pollution ✓
- [x] SC5: `bun test` passes — 82 tests, 0 failures ✓
- [x] `bunx tsc --noEmit` exits 0 ✓
- [x] `bunx biome check .` exits 0 ✓

## Self-Check: PASSED
