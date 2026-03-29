# Phase 6: Shutdown & Lifecycle Hardening — Research

**Phase:** 6
**Goal:** Make shutdown idempotent and add diagnostic logging for edge cases.
**Requirements:** Deep-review findings M1, L1

---

## RESEARCH COMPLETE

## Findings

### Current State Analysis

**`src/server.ts` — `shutdown()` function (lines ~220–235):**

```typescript
async function shutdown(signal: string): Promise<void> {
  console.error(`[shutdown] ${signal}`)
  try {
    await socketMode.disconnect()
  } catch (err) { ... }
  try {
    await messageQueue // drain in-flight messages
  } catch (err) { ... }
  try {
    await server.close()
  } catch (err) { ... }
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
process.stdin.on('close', () => void shutdown('stdin close'))
```

**Problems identified:**

1. **M1 — Double invocation (no guard):** Three signals can fire simultaneously (SIGTERM + SIGINT + stdin close). Each calls `shutdown()` independently. Without a guard, `socketMode.disconnect()` and `server.close()` run multiple times, which can cause protocol errors or double `process.exit(0)`.

2. **M1 — `messageQueue` read from live variable after disconnect:** The current code reads `messageQueue` after `socketMode.disconnect()` resolves. While this is the correct ordering, the variable is still "live" — if somehow a new message arrives post-disconnect (race window), it would extend `messageQueue`. The fix: capture the queue reference immediately after disconnect resolves, before any potential extension.

   > **Note on current code:** Looking carefully, the current code already awaits `socketMode.disconnect()` first, then awaits `messageQueue`. The "race" is: between `disconnect()` resolving and the next `await messageQueue`, the live variable could theoretically change. Capturing into a local `const drained = messageQueue` immediately after disconnect ensures we drain exactly what was queued at disconnect time.

3. **L1 — Missing `ts` guard in `slack-client.ts`:** The current code:
   ```typescript
   const ts = event.ts ?? ''
   if (!ts || seenTs.has(ts)) return
   seenTs.set(ts, now + DEDUP_TTL_MS)
   ```
   - Empty-string guard (`if (!ts || ...)`) is correct — it prevents pollution of `seenTs`.
   - BUT: There is no log line when `ts` is missing/empty. The success criteria requires logging `[slack-client] event without ts` to stderr before discarding.

### What Changes Are Needed

#### Fix 1: `shutdownInitiated` guard in `server.ts`

```typescript
let shutdownInitiated = false

async function shutdown(signal: string): Promise<void> {
  if (shutdownInitiated) {
    console.error(`[shutdown] already in progress, ignoring ${signal}`)
    return
  }
  shutdownInitiated = true
  console.error(`[shutdown] ${signal}`)
  // ... rest of shutdown
}
```

#### Fix 2: Capture `messageQueue` reference after `socketMode.disconnect()`

```typescript
async function shutdown(signal: string): Promise<void> {
  if (shutdownInitiated) { ... return }
  shutdownInitiated = true
  console.error(`[shutdown] ${signal}`)
  try {
    await socketMode.disconnect()
  } catch (err) { ... }
  const drainQueue = messageQueue  // capture after disconnect resolves
  try {
    await drainQueue
  } catch (err) { ... }
  // ...
}
```

#### Fix 3: Log missing/empty `ts` in `slack-client.ts`

```typescript
const ts = event.ts ?? ''
if (!ts) {
  console.error('[slack-client] event without ts')
  return
}
if (seenTs.has(ts)) return
seenTs.set(ts, now + DEDUP_TTL_MS)
```

This satisfies:
- SC3: Events without `ts` log `[slack-client] event without ts` before discarding
- SC4: Empty-string `ts` does NOT pollute `seenTs` (we return before `seenTs.set`)

### Test Coverage Required

**New tests in `slack-client.test.ts`:**
- Event with missing `ts` (undefined): logs `[slack-client] event without ts`, does not call `onMessage`
- Event with empty-string `ts`: logs `[slack-client] event without ts`, does not call `onMessage`
- Event with empty `ts` does not add entry to `seenTs`

**Note:** The `createSlackClient` function wires everything internally (SocketModeClient event handler). The dedup logic is not directly unit-testable without refactoring the handler into a pure function. Options:
1. Extract the event handler logic into a testable pure function (preferred — matches Phase 5 approach of extracting `shouldProcessMessage`)
2. Test via integration-style mocking of `socketMode.on`

**Recommended:** Extract the ts-checking logic into a small testable function, or test the existing pattern where `shouldProcessMessage` was already exported. The simplest approach is to test the behavior through the exported functions or by extracting the ts-guard logic.

Looking at the existing tests, `shouldProcessMessage` was extracted as a pure function. The ts-handling code is inside the closure in `createSlackClient`. The cleanest fix that keeps tests simple:

**Option A:** Add a `filterByTs` helper function that handles the ts guard + logging + seenTs check. Export it for testing.

**Option B:** The ts-checking logic is simple enough to just test that `console.error` is called when `ts` is missing — but this requires calling into the Socket Mode handler, which requires mocking `SocketModeClient`.

**Decision:** The current code already handles the empty-ts guard (`if (!ts || seenTs.has(ts)) return`). We only need to:
1. Add the `console.error('[slack-client] event without ts')` call before the `return`
2. The tests can verify this via spying on `console.error` — but we'd need to invoke the message handler somehow.

The simplest testable approach: since the ts logic is inside `createSlackClient`'s closure, we can either:
- Extract into a named exported function (cleanest)
- Accept the behavior is tested indirectly

**Final decision:** Keep the change minimal — just add the `console.error` before the return. The test can be written by checking that the behavior is correct in `slack-client.test.ts` using the existing `shouldProcessMessage`-style pattern, if we extract it. If extraction is too invasive, we document the log behavior in the comment and trust the unit tests for `shouldProcessMessage`.

Given the existing test file already imports `shouldProcessMessage` and `createStderrLogger` from `slack-client.ts`, the cleanest approach is:
- The ts-guard fix is a one-line add to `slack-client.ts`
- Test coverage can be added as an integration test that invokes the handler closure via a mock — OR — note that SC3/SC4 are verified by code review + type safety since the guard is already in place and we're just adding a log line.

### Validation Architecture

**Unit tests to add:**
1. `shutdown-guard.test.ts` OR add to `server.test.ts`: Test that calling shutdown twice only executes the body once
2. `slack-client.test.ts`: Test ts-missing logging behavior (if extract helper)

**Verification approach:**
- Run `bun test` after changes — must pass all existing tests
- Code review of `shutdownInitiated` guard position
- Code review of `messageQueue` capture timing

---

## Key Constraints

1. **stdout is sacred** — All logging uses `console.error()`, never `console.log()`
2. **Single-file scope** — Changes limited to `src/server.ts` and `src/slack-client.ts`
3. **No behavior changes** — Only add guard, add log, capture reference; no functional changes
4. **Test suite must pass** — `bun test` green after changes
