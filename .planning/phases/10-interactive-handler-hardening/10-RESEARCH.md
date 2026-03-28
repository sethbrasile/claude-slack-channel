# Phase 10: Interactive Handler Hardening — Research

**Researched:** 2026-03-28
**Domain:** TypeScript async concurrency, Zod validation, TTL-bounded Maps, Bun test patterns
**Confidence:** HIGH

---

## Summary

Phase 10 is a targeted hardening pass on the interactive button-click handler and `pendingPermissions` map. The codebase already has the foundation in place: `wireHandlers()` composition root (Phase 9), Zod validation on permission requests, and a `messageQueue` Promise-chain for serializing `onMessage` callbacks. The work here closes three remaining gaps: (1) the interactive callback runs *outside* `messageQueue` — a double-click or Slack retry can trigger two concurrent executions on the same `request_id`; (2) the interactive body is cast with `as` without Zod validation; and (3) `pendingPermissions` has no TTL or size cap.

The deep review (2026-03-28) labels these as findings H1 (race condition), M1 (shutdown drain gap), M5 (no Zod validation on interactive payload), M13 (zero test coverage for interactive handler), and L1 (unbounded `pendingPermissions`). Phase 6 findings M1 and L1 map directly to the same issues: Phase 6 fixed `shutdown()` idempotency but did not fix the interactive handler's exclusion from `messageQueue` drain, and L1 (pendingPermissions no TTL) was deferred.

The Phase 9 wireHandlers extraction already exported `makeReplyHandler` as a testability pattern. Phase 10 follows the same pattern: extract the interactive callback body into an exported `makeInteractiveHandler(...)` factory, route interactive callbacks through `messageQueue`, add a Zod schema for the interactive body in `slack-client.ts`, and add TTL + size cap to `pendingPermissions`.

**Primary recommendation:** Route interactive callbacks through `messageQueue` (solves race + shutdown drain in one change), add `InteractiveBodySchema` Zod validation in `slack-client.ts`, extract `makeInteractiveHandler` for testability, and implement TTL + cap on `pendingPermissions`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| H1 | Interactive button-click callbacks run outside `messageQueue` — race condition on double-click | Route `onInteractive` callback through `messageQueue` in server.ts CLI block, mirroring the `onMessage` pattern |
| M1 | Interactive handler not drained on shutdown | Routing through `messageQueue` (same fix as H1) ensures `drainQueue = messageQueue` captures interactive in-flight work |
| M5 | Interactive payload cast with `as`, no Zod validation | Add `InteractiveBodySchema` in `slack-client.ts`; parse before extracting fields |
| M13 | Interactive handler has zero test coverage | Extract callback body into exported `makeInteractiveHandler(web, server, pendingPermissions, config)` factory |
| L1 | `pendingPermissions` has no TTL or size cap | Add TTL expiry sweep (same pattern as `seenTs` in `slack-client.ts`) and a max-size guard |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | 3.x (already installed) | Interactive body validation | Already used for `PermissionRequestSchema`, `ReplyArgsSchema`, config — consistent validation layer |
| `bun:test` | Bun runtime (already installed) | Unit testing | Project test framework |

No new dependencies. All required libraries are already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure
No structural changes — all work stays in existing files:
```
src/
├── server.ts          # Extract makeInteractiveHandler; route through messageQueue
├── slack-client.ts    # Add InteractiveBodySchema Zod validation
└── __tests__/
    └── server.test.ts # New describe block for makeInteractiveHandler
```

### Pattern 1: messageQueue Promise-chain (already used for onMessage)

**What:** Serialize async callbacks through a single Promise chain. Each new callback becomes `messageQueue = messageQueue.then(async () => { ... })`. This prevents concurrent execution even if the callback is triggered multiple times before the first resolves.

**When to use:** Any handler where concurrent execution is unsafe — mutation of shared state (like `pendingPermissions.delete`) across await points.

**Existing implementation (server.ts lines 272-317):**
```typescript
// onMessage already uses this pattern:
(msg) => {
  messageQueue = messageQueue.then(async () => {
    try {
      // ... process msg
    } catch (err) {
      console.error('[server] onMessage failed:', safeErrorMessage(err))
    }
  })
},
```

**Apply same pattern to onInteractive:**
```typescript
async (action) => {
  messageQueue = messageQueue.then(async () => {
    try {
      await handleInteractive(action)  // extracted body
    } catch (err) {
      console.error('[server] onInteractive failed:', safeErrorMessage(err))
    }
  })
}
```

The `messageQueue` variable is captured by the closure, so `shutdown()`'s `const drainQueue = messageQueue` will include interactive work queued before disconnect resolves.

### Pattern 2: makeXxxHandler factory (already used for makeReplyHandler)

**What:** A factory function that closes over mutable dependencies and returns the handler function. Exported for direct unit testing without going through `createServer` or the CLI block.

**Existing model:**
```typescript
// From server.ts
export function makeReplyHandler(web: WebClient, tracker: ThreadTracker, config: ChannelConfig) {
  return async (request: {...}): Promise<{...}> => {
    // handler body
  }
}
```

**Apply same pattern to interactive handler:**
```typescript
export function makeInteractiveHandler(
  web: WebClient,
  server: Server,
  pendingPermissions: Map<string, { params: PermissionRequest }>,
  config: ChannelConfig,
) {
  return async (action: InteractiveAction): Promise<void> => {
    const verdict = parseButtonAction(action.action_id)
    if (!verdict) return

    const pending = pendingPermissions.get(verdict.request_id)
    if (!pending) return  // double-click guard: already processed

    pendingPermissions.delete(verdict.request_id)

    await server.notification({
      method: 'notifications/claude/channel/permission',
      params: verdict as unknown as Record<string, unknown>,
    })

    const approved = verdict.behavior === 'allow'
    const updated = formatPermissionResult(pending.params, action.user, approved)
    try {
      await web.chat.update({
        channel: action.channel,
        ts: action.message_ts,
        text: updated.text,
        blocks: updated.blocks as any,
      })
    } catch (err) {
      console.error('[permission] chat.update failed:', safeErrorMessage(err))
    }
  }
}
```

**Key detail:** The double-click guard is `if (!pending) return` placed BEFORE `pendingPermissions.delete()`. When both concurrent executions read `pendingPermissions.get()`, the second one gets `undefined` after the first has deleted the entry. But with `messageQueue` serialization, the second call doesn't even START until the first fully resolves — so `pendingPermissions.delete()` has already run. The `if (!pending) return` guard is defense-in-depth.

### Pattern 3: Zod validation of Slack interactive body

**What:** Parse `body: Record<string, unknown>` through a Zod schema before field extraction. Follows the same pattern as `PermissionRequestSchema` (in permission.ts) which validates `notifications/claude/channel/permission_request` payloads.

**Current code (slack-client.ts lines 198-217):**
```typescript
const actions = body.actions as Array<{ action_id?: string }> | undefined
const user = body.user as { id?: string } | undefined
const channel = body.channel as { id?: string } | undefined
const message = body.message as { ts?: string; thread_ts?: string } | undefined

if (!actions?.[0]?.action_id || !user?.id || !channel?.id || !message?.ts) return
```

**Replace with Zod:**
```typescript
// In slack-client.ts (module scope or top of createSlackClient):
const InteractiveBodySchema = z.object({
  actions: z.array(z.object({ action_id: z.string() })).min(1),
  user: z.object({ id: z.string() }),
  channel: z.object({ id: z.string() }),
  message: z.object({
    ts: z.string(),
    thread_ts: z.string().optional(),
  }),
})

// In the handler:
const parsed = InteractiveBodySchema.safeParse(body)
if (!parsed.success) {
  console.error('[slack-client] interactive payload validation failed:', parsed.error.message)
  return
}
const { actions, user, channel, message } = parsed.data
```

**Where to place the schema:** Two options — module scope in `slack-client.ts` (not exported, internal), or export it for testing. Given `InteractiveBodySchema` validates Slack's external payload shape (security boundary), export it so tests can verify the schema structure directly without mocking `SocketModeClient`.

### Pattern 4: TTL + size cap on pendingPermissions

**What:** Add expiry timestamps to `pendingPermissions` entries and sweep expired entries on each new insertion. Add a size cap (e.g., 100 entries) to prevent unbounded growth.

**Existing model — seenTs in slack-client.ts:**
```typescript
const seenTs = new Map<string, number>()  // ts -> expiry timestamp

// Sweep on each message:
const now = Date.now()
for (const [ts, expiry] of seenTs.entries()) {
  if (now > expiry) seenTs.delete(ts)
}
```

**Apply same pattern to pendingPermissions:**

Change the Map type from `Map<string, { params: PermissionRequest }>` to include an expiry field:
```typescript
const PENDING_PERMISSIONS_TTL_MS = 10 * 60 * 1000  // 10 minutes
const PENDING_PERMISSIONS_MAX_SIZE = 100

const pendingPermissions = new Map<string, { params: PermissionRequest; expiresAt: number }>()
```

Sweep in `makePermissionHandler` (when a new permission request arrives):
```typescript
const now = Date.now()
for (const [id, entry] of pendingPermissions.entries()) {
  if (now > entry.expiresAt) pendingPermissions.delete(id)
}
if (pendingPermissions.size >= PENDING_PERMISSIONS_MAX_SIZE) {
  console.error('[permission] pendingPermissions at capacity, dropping oldest entry')
  const oldest = pendingPermissions.keys().next().value
  if (oldest) pendingPermissions.delete(oldest)
}
pendingPermissions.set(params.request_id, { params, expiresAt: now + PENDING_PERMISSIONS_TTL_MS })
```

**TTL value:** 10 minutes is appropriate. A permission prompt older than 10 minutes is likely stale (Claude has already timed out or moved on). The Slack button itself will still show but clicking it will silently do nothing (pending entry gone). This is safe behavior.

**Impact on makeInteractiveHandler:** The interactive handler reads `pendingPermissions.get(verdict.request_id)` — if the entry has expired and been swept, it returns `undefined`, and the guard `if (!pending) return` fires. The verdict is NOT sent to Claude Code. This is correct: a 10-minute-old permission prompt should not be actable.

**Alternative approach:** Keep the Map type unchanged and track expiry in a parallel Map. Verdict: do NOT use parallel Maps — it adds complexity and split-brain risk. Change the value type.

### Anti-Patterns to Avoid

- **Early return before `pendingPermissions.delete()`:** The existing code calls `pendingPermissions.delete()` unconditionally regardless of `pending` being null. This is fine as a no-op, but the ordering matters: delete MUST happen before the `await server.notification()` call to ensure a concurrent execution (even theoretically) sees the entry as gone.
- **Routing interactive through a separate queue variable:** Use the SAME `messageQueue` variable. Do not create a separate `interactiveQueue`. The shutdown drain logic captures `messageQueue` — both onMessage and onInteractive work must be in the same chain.
- **Moving `makeInteractiveHandler` to server.ts and importing `server` (the Server instance) as a parameter type:** This creates a circular-feeling dependency. Pass `server` as a parameter — it's the same pattern `makePermissionHandler` uses internally already.
- **Adding `InteractiveBodySchema` to permission.ts:** It belongs in `slack-client.ts` — it validates the Slack Wire protocol shape, not the permission domain logic.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent callback deduplication | Custom lock/mutex | `messageQueue` Promise chain (already in codebase) | Promise chains are single-threaded in JS event loop; no race possible within a then-chain |
| Payload shape validation | Manual `as` casts with null checks | Zod `safeParse` | Already used throughout codebase; provides typed output + error messages |
| TTL expiry | `setInterval` sweep | On-insertion sweep (same as `seenTs` pattern) | Simpler, no timer to clean up on shutdown, sufficient for low-frequency permission requests |

---

## Common Pitfalls

### Pitfall 1: messageQueue closure capture

**What goes wrong:** The handler closure passed to `createSlackClient` as `onInteractive` captures `messageQueue` at call time. BUT `messageQueue` is a `let` variable — the closure captures the VARIABLE (by reference in the outer scope), not the value. So `messageQueue = messageQueue.then(...)` inside the callback updates the variable that all subsequent callbacks see.

**Why it happens:** This is the same mechanism that makes the onMessage queue work. It works correctly because JavaScript closures capture variable bindings, not values.

**How to avoid:** Do not declare `messageQueue` as `const`. The `let` is load-bearing.

**Warning signs:** If `messageQueue` is extracted to a wrapper object, the reassignment may not propagate correctly.

### Pitfall 2: Double-click behavior after messageQueue routing

**What goes wrong:** With `messageQueue` routing, a double-click still enqueues TWO callbacks. The second one runs after the first completes. If the first has already called `pendingPermissions.delete()`, the second finds `undefined` for `pending` and returns early. But it still calls `parseButtonAction(action.action_id)` and potentially `server.notification()` again if the guard is placed too late.

**How to avoid:** In `makeInteractiveHandler`, check `pendingPermissions.get()` FIRST and return early before calling `server.notification()`. The key ordering:
1. `parseButtonAction` — returns null if invalid action_id
2. `pendingPermissions.get(verdict.request_id)` — may be undefined on second call
3. EARLY RETURN if `!pending`
4. `pendingPermissions.delete(verdict.request_id)`
5. `server.notification(...)` — only reached on first call

### Pitfall 3: TTL type change breaks existing pendingPermissions consumers

**What goes wrong:** Adding `expiresAt` to the Map value type requires updating every site that reads from or writes to `pendingPermissions`: `makePermissionHandler` (writes), `makeInteractiveHandler` (reads), and potentially the `pendingPermissions` Map type declaration in `wireHandlers` signature.

**How to avoid:** Update all four locations atomically: type declaration in CLI block, `wireHandlers` signature (if it passes `pendingPermissions`), `makePermissionHandler`, and `makeInteractiveHandler`. Note: `wireHandlers` currently takes `pendingPermissions: Map<string, { params: PermissionRequest }>` — if the value type changes, the `wireHandlers` signature must change too. Alternatively, keep `wireHandlers` signature using a type alias.

**Simpler approach:** Define a type alias:
```typescript
interface PendingPermissionEntry {
  params: PermissionRequest
  expiresAt: number
}
```
Use `Map<string, PendingPermissionEntry>` everywhere. This is cleaner than inline object types.

### Pitfall 4: Server instance not available at makeInteractiveHandler call site

**What goes wrong:** `makeInteractiveHandler` needs `server` (the MCP Server instance) to call `server.notification()`. In the CLI block, `server` is declared before `createSlackClient` is called. But if the factory pattern requires passing `server` as a parameter, the call site must be after `server` is available.

**How to avoid:** In the CLI block, construct `makeInteractiveHandler(web, server, pendingPermissions, config)` AFTER `server` and `pendingPermissions` are declared. The current code already has this ordering — `server` is created first, then `pendingPermissions`, then `createSlackClient` is called. No reordering needed.

### Pitfall 5: `bun test` biome lint failures on `any` cast

**What goes wrong:** The existing `blocks: updated.blocks as any` cast in the interactive handler is already present (and has a biome-ignore comment in the permission handler). When extracting the handler body, the biome-ignore comment must be preserved or the `as any` replaced.

**How to avoid:** Copy the existing `biome-ignore lint/suspicious/noExplicitAny: Block Kit JSON...` comment from the permission handler's `chat.postMessage` call.

---

## Code Examples

### Zod interactive body schema

```typescript
// Source: Zod docs + existing PermissionRequestSchema pattern in permission.ts
import { z } from 'zod'

export const InteractiveBodySchema = z.object({
  actions: z.array(z.object({ action_id: z.string() })).min(1),
  user: z.object({ id: z.string() }),
  channel: z.object({ id: z.string() }),
  message: z.object({
    ts: z.string(),
    thread_ts: z.string().optional(),
  }),
})

export type InteractiveBody = z.infer<typeof InteractiveBodySchema>
```

### makeInteractiveHandler factory

```typescript
// server.ts — follows makeReplyHandler pattern
export function makeInteractiveHandler(
  web: WebClient,
  server: Server,
  pendingPermissions: Map<string, PendingPermissionEntry>,
  config: ChannelConfig,
) {
  return async (action: InteractiveAction): Promise<void> => {
    const verdict = parseButtonAction(action.action_id)
    if (!verdict) return

    const pending = pendingPermissions.get(verdict.request_id)
    if (!pending) return  // already handled (double-click) or expired

    pendingPermissions.delete(verdict.request_id)

    await server.notification({
      method: 'notifications/claude/channel/permission',
      params: verdict as unknown as Record<string, unknown>,
    })

    if (pending) {
      const approved = verdict.behavior === 'allow'
      const updated = formatPermissionResult(pending.params, action.user, approved)
      try {
        await web.chat.update({
          channel: action.channel,
          ts: action.message_ts,
          text: updated.text,
          // biome-ignore lint/suspicious/noExplicitAny: Block Kit JSON doesn't match Slack's strict union type
          blocks: updated.blocks as any,
        })
      } catch (err) {
        console.error('[permission] chat.update failed:', safeErrorMessage(err))
      }
    }
  }
}
```

### Routing onInteractive through messageQueue

```typescript
// server.ts CLI block — createSlackClient call
const handleInteractive = makeInteractiveHandler(web, server, pendingPermissions, config)

const { socketMode, web } = createSlackClient(
  config.slackAppToken,
  config.slackBotToken,
  { channelId: config.channelId, allowedUserIds: config.allowedUserIds },
  (msg) => {
    messageQueue = messageQueue.then(async () => {
      // ... existing onMessage body ...
    })
  },
  (action) => {
    messageQueue = messageQueue.then(async () => {
      try {
        await handleInteractive(action)
      } catch (err) {
        console.error('[server] onInteractive failed:', safeErrorMessage(err))
      }
    })
  },
)
```

**Note:** `handleInteractive` is declared before `createSlackClient` is called, but it uses `web` which is also declared by `createSlackClient`. Resolution: either declare `handleInteractive` after the destructuring (using a `let` binding) or pass `web` as a parameter at the `createSlackClient` call site using a local wrapper. The cleanest approach: construct the handler after `createSlackClient` returns `web`:

```typescript
const { socketMode, web } = createSlackClient(
  config.slackAppToken,
  config.slackBotToken,
  { channelId: config.channelId, allowedUserIds: config.allowedUserIds },
  (msg) => { messageQueue = messageQueue.then(async () => { /* onMessage */ }) },
  (action) => { messageQueue = messageQueue.then(async () => { /* forward to handler */ }) },
)

// web is now available — construct the interactive handler
const handleInteractive = makeInteractiveHandler(web, server, pendingPermissions, config)
```

But this doesn't work because `onInteractive` is passed to `createSlackClient` and needs `handleInteractive`. Solution: use a late-binding pattern — the `onInteractive` closure can reference a variable that is assigned AFTER `createSlackClient` returns:

```typescript
let handleInteractive: ((action: InteractiveAction) => Promise<void>) | undefined

const { socketMode, web } = createSlackClient(
  ...,
  (action) => {
    messageQueue = messageQueue.then(async () => {
      try {
        await handleInteractive?.(action)
      } catch (err) {
        console.error('[server] onInteractive failed:', safeErrorMessage(err))
      }
    })
  },
)

handleInteractive = makeInteractiveHandler(web, server, pendingPermissions, config)
```

**Or simpler:** pass `web` as an explicit parameter to `makeInteractiveHandler` only after `createSlackClient` returns it, using a two-step approach where the `onInteractive` passed to `createSlackClient` is a thin wrapper that delegates to a closure-captured reference. The optional chaining `handleInteractive?.(action)` ensures no-op during the brief window before assignment — which is safe because `socketMode.start()` is called AFTER this block.

### Test structure for makeInteractiveHandler

```typescript
// server.test.ts — new describe block
describe('makeInteractiveHandler', () => {
  function makeDeps() {
    const mockUpdate = mock(() => Promise.resolve({ ok: true }))
    const mockNotification = mock(() => Promise.resolve())
    const mockServer = { notification: mockNotification }
    const mockWeb = { chat: { update: mockUpdate } }
    const pendingPermissions = new Map<string, PendingPermissionEntry>()
    const handler = makeInteractiveHandler(
      mockWeb as unknown as WebClient,
      mockServer as unknown as Server,
      pendingPermissions,
      TEST_CONFIG as ChannelConfig,
    )
    return { handler, mockUpdate, mockNotification, pendingPermissions }
  }

  it('happy path: sends verdict and updates Slack message')
  it('double-click dedup: second call with same request_id is no-op')
  it('unknown request_id (not in pendingPermissions): returns without sending notification')
  it('malformed payload: action_id does not match pattern, returns without notification')
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Interactive callback as direct async closure | Routed through messageQueue | Phase 10 | Race condition eliminated |
| `body as Record<string, unknown>` field extraction | Zod `InteractiveBodySchema.safeParse(body)` | Phase 10 | Malformed payload logged, not silently ignored |
| `pendingPermissions` unbounded Map | Map with TTL + size cap | Phase 10 | No memory leak on long-running sessions |
| Interactive handler untestable (inside closure) | `makeInteractiveHandler` exported factory | Phase 10 | Full unit test coverage possible |

---

## Open Questions

1. **`web` availability ordering**
   - What we know: `web` is returned by `createSlackClient`, but `makeInteractiveHandler` needs `web` as a parameter, and the `onInteractive` callback is passed INTO `createSlackClient`.
   - What's unclear: The cleanest pattern for late-binding without `?.()`
   - Recommendation: Use `let handleInteractive` declared before `createSlackClient`, assigned after. Use optional chaining `handleInteractive?.(action)` in the queued callback. This is safe because `socketMode.start()` runs after assignment.

2. **wireHandlers signature change**
   - What we know: `wireHandlers` currently takes `pendingPermissions: Map<string, { params: PermissionRequest }>`. Adding `expiresAt` to the value type requires a signature update.
   - What's unclear: Whether `wireHandlers` should own the TTL constants or just receive the typed Map.
   - Recommendation: Define `PendingPermissionEntry` interface in `types.ts` or `server.ts`. `wireHandlers` receives the typed Map; TTL constants live in `server.ts`.

3. **Where `InteractiveBodySchema` lives**
   - What we know: It validates Slack wire protocol shape (belongs in `slack-client.ts`), but tests need to import it.
   - Recommendation: Export from `slack-client.ts`. The schema is security-relevant (validates allowedUserIds check depends on `user.id` being present) and should be directly testable.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (bun:test) |
| Config file | package.json `"test": "bun test"` |
| Quick run command | `bun test src/__tests__/server.test.ts` |
| Full suite command | `bun test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| H1 (race condition) | Double-click: second call with same `request_id` is no-op, `server.notification` called once | unit | `bun test src/__tests__/server.test.ts` | ❌ Wave 0 |
| M1 (shutdown drain) | Interactive work queued before disconnect is included in `drainQueue` | unit (indirect: messageQueue routing) | `bun test src/__tests__/server.test.ts` | ❌ Wave 0 |
| M5 (Zod validation) | Malformed interactive body logs error and returns without calling `onInteractive` | unit | `bun test src/__tests__/slack-client.test.ts` | ❌ Wave 0 |
| M13 (test coverage) | Happy path: verdict sent + Slack message updated | unit | `bun test src/__tests__/server.test.ts` | ❌ Wave 0 |
| M13 (test coverage) | Unknown `request_id` (not in pendingPermissions): no notification sent | unit | `bun test src/__tests__/server.test.ts` | ❌ Wave 0 |
| M13 (test coverage) | Malformed `action_id` pattern: `parseButtonAction` returns null, early return | unit | `bun test src/__tests__/server.test.ts` | ❌ Wave 0 |
| L1 (TTL + cap) | Entries older than TTL are swept; entries at max size evict oldest | unit | `bun test src/__tests__/server.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test src/__tests__/server.test.ts`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green (currently 111 pass, 0 fail)

### Wave 0 Gaps
- [ ] `src/__tests__/server.test.ts` — new `describe('makeInteractiveHandler', ...)` block covering all 6 test cases above
- [ ] `src/__tests__/slack-client.test.ts` — new test for `InteractiveBodySchema` Zod validation in interactive event handler
- [ ] No new framework install needed — `bun:test` already configured

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `src/server.ts`, `src/slack-client.ts`, `src/permission.ts`, `src/__tests__/server.test.ts`
- `.planning/reviews/2026-03-28-deep-review.md` — findings H1, M1, M5, M13, L1
- `.planning/phases/06-shutdown-lifecycle-hardening/06-RESEARCH.md` — Phase 6 M1, L1 findings
- `.planning/STATE.md` — accumulated decisions, especially Phase 9 wireHandlers extraction decision

### Secondary (MEDIUM confidence)
- Zod documentation patterns — consistent with existing `PermissionRequestSchema` usage in codebase
- JavaScript event loop single-threading — Promise chain serialization is a well-established pattern

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; patterns already proven in codebase
- Architecture: HIGH — based on direct code inspection; all patterns directly mirror existing working code
- Pitfalls: HIGH — derived from code inspection and the deep review's concrete findings

**Research date:** 2026-03-28
**Valid until:** Stable — no external dependencies changing; valid until the codebase changes
