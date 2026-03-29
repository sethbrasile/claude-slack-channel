# Phase 9: Handler Architecture — wireHandlers Extraction - Research

**Researched:** 2026-03-28
**Domain:** TypeScript refactoring — composition root pattern, MCP SDK handler registration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| H2 | Reply handler body duplicated between library and CLI paths (~50 lines) | Extract `makeReplyHandler(web, tracker, config)` — shared handler factory removes both copies |
| M2 | PermissionRequestSchema handler not registered in library path | `wireHandlers()` registers all handlers in both paths; or library path is documented as "reply only" |
| M3 | PermissionRequestSchema defined inline in CLI block | Move schema to `permission.ts`, export it alongside `PERMISSION_ID_RE` |
| M14 | CLI-path onMessage and permission handlers have zero test coverage | Extracting handlers into exported functions makes them unit-testable |
| L7 | formatPermissionRequest exported but only used internally | Audit export — unexport if only called within `permission.ts` |
| L8 | pendingPermissions uses inline anonymous type instead of PermissionRequest | Use `Map<string, { params: PermissionRequest }>` importing from `types.ts` |
</phase_requirements>

---

## Summary

Phase 9 eliminates the CLI-block isolation pattern that has caused repeated maintainability problems. The root cause — identified in the deep review — is that `if (import.meta.main)` has accumulated all the protocol-level handlers (permission schema, interactive callbacks, onMessage pipeline) that cannot be imported or tested from outside. The structural fix is a `wireHandlers(server, web, tracker, config)` composition root that registers every handler in one place and is called from both the CLI entry point and any library consumer.

Three supporting cleanups travel with this refactor: moving `PermissionRequestSchema` to `permission.ts` where it belongs (M3), correcting the `pendingPermissions` type to use `PermissionRequest` from `types.ts` (L8), and auditing whether `formatPermissionRequest` should remain exported (L7). All three are low-risk, single-file changes that restore the codebase to its stated design principle of "pure function extraction for testability."

The primary risk in this phase is handler registration ordering. The MCP SDK requires `server.connect(transport)` to complete before notifications can be sent. `wireHandlers()` registers handlers on the server object but must be called after connect. The CLI path's current ordering constraint — connect, then wire, then start Socket Mode — must be preserved exactly.

**Primary recommendation:** Extract `wireHandlers(server, web, tracker, config)` into a module-scope function in `server.ts`, called from both `createServer(config, deps)` (when deps are present) and the CLI block after `server.connect()`. Move `PermissionRequestSchema` to `permission.ts`. Fix `pendingPermissions` type. Audit `formatPermissionRequest` export.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | ^1.28.0 | MCP server handler registration | Already in use; `setRequestHandler` / `setNotificationHandler` are the registration APIs |
| `zod` | ^4.3.6 | Schema validation for PermissionRequestSchema | Already in use for all other schemas in this codebase |
| TypeScript | 6.0.2 | Type safety on refactored function signatures | Already in use; key for `PermissionRequest` import |

No new dependencies. This is a pure refactor within the existing stack.

---

## Architecture Patterns

### Composition Root Pattern
**What:** A single function that wires all dependencies into their consumers. Called once from the entry point.
**When to use:** When multiple entry paths (CLI, library, test) need the same handler configuration without duplicating registration logic.
**How it applies here:** `wireHandlers(server, web, tracker, config)` becomes the single site where `setRequestHandler(CallToolRequestSchema, ...)`, `setNotificationHandler(PermissionRequestSchema, ...)`, and the `onMessage` callback are all registered. Both the CLI entry point and library consumers call it.

```typescript
// Source: direct analysis of src/server.ts current state
export function wireHandlers(
  server: Server,
  web: WebClient,
  tracker: ThreadTracker,
  config: ChannelConfig,
  pendingPermissions: Map<string, { params: PermissionRequest }>,
  messageQueue: { current: Promise<void> },
): void {
  server.setRequestHandler(CallToolRequestSchema, makeReplyHandler(web, tracker, config))
  server.setNotificationHandler(PermissionRequestSchema, makePermissionHandler(web, tracker, config, pendingPermissions))
  // onMessage is wired in createSlackClient callback — see CLI block pattern below
}
```

**Alternative shape:** `wireHandlers` can receive `messageQueue` by reference (e.g., a `{ current: Promise<void> }` wrapper) so the onMessage closure can extend it without breaking the composition root's pure-function character. The existing `let messageQueue = Promise.resolve()` is a mutable closure variable — this must remain mutable, which means `wireHandlers` either receives it by reference-wrapper or `onMessage` is left in the CLI block and only the two handler registrations move into `wireHandlers`.

**Simpler alternative (preferred for minimal diff):** Extract only the two handler bodies into named functions (`makeReplyHandler`, `makePermissionHandler`) and let `wireHandlers` simply call both registrations. The `onMessage` callback stays in the CLI block because it references the mutable `messageQueue` variable — extracting it would require passing the queue wrapper as a parameter.

### Handler Factory Pattern
**What:** A factory function that closes over its dependencies and returns the handler function.
**Why:** Enables the same handler logic to be registered in multiple contexts (library path, CLI path, tests) without duplicating the body.

```typescript
// Source: direct analysis of existing CLI path in src/server.ts:319-371
function makeReplyHandler(web: WebClient, tracker: ThreadTracker, config: ChannelConfig) {
  return async (request: CallToolRequest) => {
    // ... exact body from either of the two existing duplicates ...
  }
}
```

This factory is called once to produce the handler function, then passed to `server.setRequestHandler(CallToolRequestSchema, makeReplyHandler(web, tracker, config))`.

### PermissionRequestSchema Migration
**What:** Move the inline Zod schema from `if (import.meta.main)` to `permission.ts`.
**Why:** The schema validates the same protocol fields (`request_id`, `tool_name`, `description`, `input_preview`) already documented in `PermissionRequest` in `types.ts`. Collocating it with the other permission logic makes the module self-contained and testable.

```typescript
// Source: direct analysis of src/server.ts:277-285 (current inline definition)
// Move to src/permission.ts:

import { z } from 'zod'
import { PERMISSION_ID_RE } from './permission.ts' // already defined there

export const PermissionRequestSchema = z.object({
  method: z.literal('notifications/claude/channel/permission_request'),
  params: z.object({
    request_id: z.string().regex(PERMISSION_ID_RE),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string().optional().default(''),
  }),
})
```

Note: `PERMISSION_ID_RE` is already exported from `permission.ts` — no new dependency required.

### pendingPermissions Type Fix
**What:** Replace the inline anonymous map type with a typed import.
**Current (L8):**
```typescript
const pendingPermissions = new Map<
  string,
  { params: { request_id: string; tool_name: string; description: string; input_preview: string } }
>()
```
**Fixed:**
```typescript
import type { PermissionRequest } from './types.ts'
// ...
const pendingPermissions = new Map<string, { params: PermissionRequest }>()
```
`PermissionRequest` is already defined in `types.ts` with exactly these four fields. The anonymous type is structurally identical — this is a drop-in replacement.

### formatPermissionRequest Export Audit (L7)
**What:** Determine whether `formatPermissionRequest` in `permission.ts` should remain exported.
**Analysis:** Searching `server.ts` — `formatPermissionRequest` is NOT called from `server.ts`. It is called only by `formatPermissionBlocks` and `formatPermissionResult` within `permission.ts` itself. It is tested in `src/__tests__/permission.test.ts` via direct import.
**Decision:** Keep exported — it has test coverage that imports it directly, and removing the export would break those tests. The finding is LOW severity and the test coverage is the reason to keep it. Add an internal comment noting it's exported for testability.

### Anti-Patterns to Avoid
- **Double-registration:** If `wireHandlers()` is called from both the `if (deps?.web && deps?.tracker)` branch in `createServer` AND from the CLI block, the handlers will be registered twice on the same server object. The MCP SDK does not deduplicate — this will cause unexpected behavior. Solution: call `wireHandlers` from exactly one path per server instance.
- **Mutating `messageQueue` from inside `wireHandlers`:** The `messageQueue` serialization variable is `let messageQueue = Promise.resolve()` in the CLI block. If `wireHandlers` tries to close over it, the closure captures the initial value. Pass a mutable wrapper or keep `onMessage` in the CLI block.
- **Registering handlers before `server.connect()`:** The MCP SDK requires transport to be connected before notifications can be sent. Handler _registration_ (setRequestHandler, setNotificationHandler) CAN happen before connect, but the CLI startup ordering comment must be preserved: connect first, then start Socket Mode.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema for permission notifications | A custom validator | `z.object()` + existing `PERMISSION_ID_RE` | Zod is already the project standard; `PERMISSION_ID_RE` is already exported |
| Handler deduplication | A registry or handler map | Just don't call `wireHandlers` twice | MCP SDK handlers are registered once; the issue is code duplication, not a runtime registry problem |
| Type for permission map | Inline anonymous object type | `PermissionRequest` from `types.ts` | The type is already defined and structurally identical |

---

## Common Pitfalls

### Pitfall 1: Registering the same handler method twice
**What goes wrong:** `server.setRequestHandler(CallToolRequestSchema, ...)` called from both the `if (deps?.web)` branch in `createServer` AND from `wireHandlers` when the CLI calls it after connect. The second registration silently overwrites the first, or the SDK throws.
**Why it happens:** The refactor moves handler registration without removing the old registration path.
**How to avoid:** During the refactor, remove the `if (deps?.web && deps?.tracker)` block from `createServer` entirely. Both paths (library and CLI) should get handlers exclusively through `wireHandlers`.
**Warning signs:** Two `setRequestHandler(CallToolRequestSchema, ...)` calls in the same server instance's lifetime.

### Pitfall 2: Breaking the library consumer API
**What goes wrong:** Removing the `deps` parameter from `createServer` or changing when handlers are registered would break library consumers who call `createServer(config, { web, tracker })`.
**Why it happens:** The refactor restructures `createServer` without considering that it's a public API.
**How to avoid:** Keep `createServer(config, deps?)` signature unchanged. If `deps` are provided, call `wireHandlers` inside `createServer`. Document this in the function's JSDoc.

### Pitfall 3: messageQueue closure capture
**What goes wrong:** The `onMessage` callback extends `messageQueue` (`messageQueue = messageQueue.then(...)`). If `wireHandlers` tries to pass `onMessage` as a parameter to `createSlackClient`, the closure must capture a mutable reference to `messageQueue`, not a snapshot.
**Why it happens:** JavaScript closures capture variables by reference for `let` bindings, but if `messageQueue` is passed as a value parameter it becomes a snapshot.
**How to avoid:** Keep the `onMessage` callback defined in the CLI block where it closes over the `let messageQueue` variable directly, OR pass a `{ current: Promise<void> }` reference wrapper.

### Pitfall 4: Biome import ordering
**What goes wrong:** Adding a `zod` import to `permission.ts` or a new type import to `server.ts` triggers Biome's `organizeImports` rule, which requires type imports before value imports within the same module path.
**Why it happens:** Biome enforces import ordering; adding imports out-of-order fails `bunx biome check .`.
**How to avoid:** Follow existing pattern: type imports first, then value imports. Run `bunx biome check --write .` after changes to auto-fix ordering.

---

## Code Examples

### Verified current state — duplicate handler bodies to be merged
```typescript
// Source: src/server.ts:86-138 (library path) and src/server.ts:319-371 (CLI path)
// Both blocks are ~50-line verbatim copies. The merged version:

function makeReplyHandler(web: WebClient, tracker: ThreadTracker, config: ChannelConfig) {
  return async (request: CallToolRequest): Promise<CallToolResult> => {
    if (request.params.name !== 'reply') {
      return { content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }], isError: true }
    }
    const parsed = ReplyArgsSchema.safeParse(request.params.arguments)
    if (!parsed.success) {
      return { content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }], isError: true }
    }
    const args = parsed.data
    const text = args.text.replaceAll('<!', '<\u200b!')
    const threadTs = args.start_thread ? undefined : (args.thread_ts ?? tracker.activeThreadTs ?? undefined)
    try {
      const result = await web.chat.postMessage({
        channel: config.channelId, text, thread_ts: threadTs,
        unfurl_links: false, unfurl_media: false,
      })
      if (!result.ok) throw new Error(`chat.postMessage returned ok: false: ${result.error}`)
      if (result.ts && args.start_thread) tracker.startThread(result.ts)
      return { content: [{ type: 'text', text: 'sent' }] }
    } catch (err) {
      const message = safeErrorMessage(err)
      console.error('[reply] chat.postMessage failed:', message)
      return { content: [{ type: 'text', text: `Failed to send: ${message}` }], isError: true }
    }
  }
}
```

### Current PermissionRequestSchema (to move to permission.ts)
```typescript
// Source: src/server.ts:277-285
// Current inline location (to be removed from server.ts):
const PermissionRequestSchema = z.object({
  method: z.literal('notifications/claude/channel/permission_request'),
  params: z.object({
    request_id: z.string().regex(PERMISSION_ID_RE),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string().optional().default(''),
  }),
})
```

### Current pendingPermissions declaration (to fix type)
```typescript
// Source: src/server.ts:177-182
// Current (inline anonymous type):
const pendingPermissions = new Map<
  string,
  { params: { request_id: string; tool_name: string; description: string; input_preview: string } }
>()

// Fixed (uses PermissionRequest from types.ts):
import type { PermissionRequest } from './types.ts'
const pendingPermissions = new Map<string, { params: PermissionRequest }>()
```

### wireHandlers function signature (proposed)
```typescript
// Proposed composition root — called from createServer (when deps present) and CLI block
export function wireHandlers(
  server: Server,
  web: WebClient,
  tracker: ThreadTracker,
  config: ChannelConfig,
  pendingPermissions: Map<string, { params: PermissionRequest }>,
): void {
  server.setRequestHandler(CallToolRequestSchema, makeReplyHandler(web, tracker, config))
  server.setNotificationHandler(PermissionRequestSchema, makePermissionHandler(web, tracker, config, pendingPermissions))
}
```

Note: `onMessage` and the interactive callback remain in the CLI block because they depend on the mutable `messageQueue` variable and the `socketMode`/`web` instances created in that block. Exporting them is handled separately (M14 — making them testable by extracting named functions).

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Handler bodies inlined in `if (import.meta.main)` | Extract to named functions, call via `wireHandlers` | Enables unit testing without entering CLI block |
| `PermissionRequestSchema` inline in CLI block | Export from `permission.ts` | Testable, co-located with related schemas |
| Inline anonymous type on `pendingPermissions` | Import `PermissionRequest` from `types.ts` | Type contract surfaced, no drift risk |

---

## Open Questions

1. **Should `onMessage` be passed into `wireHandlers` or stay in the CLI block?**
   - What we know: `onMessage` extends the mutable `let messageQueue` variable — it can't be cleanly extracted without a reference wrapper
   - What's unclear: Whether the phase goal requires testing `onMessage` (M14) as part of this phase or whether M14 is satisfied by extracting the _permission_ and _reply_ handlers
   - Recommendation: Extract `onMessage` into a named exported function `handleInboundMessage(msg, server, tracker, pendingPermissions, messageQueue)` that is called from the CLI block's closure. The closure still owns `messageQueue` mutation but delegates the logic. This satisfies M14 without changing the queue semantics.

2. **Should `createServer` library path still accept `deps`?**
   - What we know: Current public API is `createServer(config, deps?)` — library consumers rely on it
   - What's unclear: Whether the phase intends to change the library API or just use `wireHandlers` internally
   - Recommendation: Keep the `deps` API. Inside `createServer`, if `deps` are provided, call `wireHandlers(server, deps.web, deps.tracker, config, new Map())` instead of the inline `if (deps?.web && deps?.tracker)` block.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | none — uses `bun test` directly |
| Quick run command | `bun test` |
| Full suite command | `bun test --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| H2 | Reply handler body extracted — both paths use same function | unit | `bun test src/__tests__/server.test.ts` | Exists (extend) |
| M2 | Library path gets permission handler via wireHandlers | unit | `bun test src/__tests__/server.test.ts` | Exists (extend) |
| M3 | PermissionRequestSchema importable from permission.ts | unit | `bun test src/__tests__/permission.test.ts` | Exists (extend) |
| M14 | handleInboundMessage and permission handler callable from tests | unit | `bun test src/__tests__/server.test.ts` | Exists (extend) |
| L7 | formatPermissionRequest export decision documented | n/a (code audit) | manual | n/a |
| L8 | pendingPermissions uses PermissionRequest type | type check | `bunx tsc --noEmit` | n/a (type only) |

### Sampling Rate
- **Per task commit:** `bun test`
- **Per wave merge:** `bun test --coverage && bunx tsc --noEmit && bunx biome check .`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. New tests extend `server.test.ts` and `permission.test.ts`; no new test files needed.

---

## Sources

### Primary (HIGH confidence)
- Direct source analysis: `src/server.ts` (read in full) — current handler duplication, PermissionRequestSchema inline, pendingPermissions type
- Direct source analysis: `src/permission.ts` (read in full) — PERMISSION_ID_RE location, formatPermissionRequest usage
- Direct source analysis: `src/types.ts` (read in full) — PermissionRequest interface definition
- Direct source analysis: `src/__tests__/server.test.ts` (read in full) — existing test patterns, handler access via SDK internals
- Deep review: `.planning/reviews/2026-03-28-deep-review.md` — findings H2, M2, M3, M14, L7, L8 and Structural Patterns section

### Secondary (MEDIUM confidence)
- Deep review Structural Patterns section — composition root recommendation with specific `wireHandlers` signature proposal

### Tertiary (LOW confidence)
None — all findings are grounded in direct source analysis.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all tools already in use
- Architecture: HIGH — based on direct source analysis of current duplication
- Pitfalls: HIGH — identified from direct analysis of the code being refactored
- Validation: HIGH — existing test infrastructure is well understood

**Research date:** 2026-03-28
**Valid until:** 2026-05-28 (stable codebase, no external API dependencies in this phase)
