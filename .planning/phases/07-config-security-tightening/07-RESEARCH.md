# Phase 7: Config & Security Tightening — Research

**Status:** RESEARCH COMPLETE
**Date:** 2026-03-27

## Summary

Phase 7 comprises five targeted, surgical edits across four source files. No new dependencies. No architectural changes. All changes are pure local modifications within existing functions or at export boundaries.

---

## Finding-by-Finding Analysis

### M4 — SLACK_CHANNEL_ID regex validation (config.ts)

**Current state:**
```ts
SLACK_CHANNEL_ID: z.string().min(1, 'SLACK_CHANNEL_ID is required'),
```

**Gap:** Only checks non-empty. Doesn't reject `SLACK_CHANNEL_ID=not-a-real-channel` at startup.

**Fix:** Add `.regex(/^[CG][A-Z0-9]+$/)` to the chain:
```ts
SLACK_CHANNEL_ID: z
  .string()
  .min(1, 'SLACK_CHANNEL_ID is required')
  .regex(/^[CG][A-Z0-9]+$/, 'SLACK_CHANNEL_ID must be a Slack channel/group ID (e.g. C0XXX or G0XXX)'),
```

**Why `[CG]`?** Slack public channels start with `C`; private channels and groups start with `G`. No other prefixes are valid for `chat.postMessage` targets.

**Risk:** Near zero. This is startup-only validation. No runtime behavior changes.

---

### M5 — safeErrorMessage in createStderrLogger error method (slack-client.ts)

**Current state:**
```ts
error: (...msgs: unknown[]) => console.error('[slack:error]', ...msgs),
```

**Gap:** The Slack SDK may call `logger.error()` with messages that contain raw token strings (e.g., when logging connection failures that include the app token in the error detail). Other log levels (debug/info/warn) pass through as-is too, but `error` is the highest-risk level.

**Fix:** Apply `safeErrorMessage` to msgs before forwarding:
```ts
error: (...msgs: unknown[]) => console.error('[slack:error]', ...msgs.map(safeErrorMessage)),
```

**Import:** `safeErrorMessage` is already imported in `slack-client.ts` (line 4: `import { safeErrorMessage } from './config.ts'`). No new imports needed.

**Note on other levels:** The success criteria specifically calls out the `error` method. debug/info/warn are low-risk and not in scope.

---

### M6 — Pre-built PERMISSION_ID_RE exported constant (permission.ts + server.ts)

**Current state in permission.ts:**
```ts
export const PERMISSION_ID_PATTERN = '[a-km-z]{5}'
const PERMISSION_REPLY_RE = new RegExp(`^\\s*(y|yes|n|no)\\s+(${PERMISSION_ID_PATTERN})\\s*$`, 'i')
```

**Current state in server.ts (line 223):**
```ts
request_id: z.string().regex(new RegExp(`^${PERMISSION_ID_PATTERN}$`)),
```

**Gap:** `new RegExp()` is constructed at call time on every permission request validation. The anchored form `^${PERMISSION_ID_PATTERN}$` is recreated dynamically.

**Fix in permission.ts:** Export the anchored regex as a named constant:
```ts
export const PERMISSION_ID_RE = new RegExp(`^${PERMISSION_ID_PATTERN}$`)
```

**Fix in server.ts:** Import `PERMISSION_ID_RE` and use it directly:
```ts
import {
  formatPermissionRequest,
  PERMISSION_ID_PATTERN,  // still needed? No — only used for PERMISSION_ID_RE construction
  PERMISSION_ID_RE,
  parsePermissionReply,
} from './permission.ts'
// ...
request_id: z.string().regex(PERMISSION_ID_RE),
```

**Note:** After this change, `PERMISSION_ID_PATTERN` may no longer be needed in server.ts imports. It is still used internally in permission.ts for building `PERMISSION_REPLY_RE`. Keep the export for downstream consumers but remove from server.ts import list.

---

### M8 — Simplify double casts in server.ts (server.ts)

**Current state (two locations):**

Line 188-189:
```ts
params: verdict as unknown as Record<string, unknown>,
```

Line 208-209:
```ts
params: params as unknown as Record<string, unknown>,
```

**Gap:** The `as unknown as T` double cast is TypeScript smell — it bypasses type safety entirely. The types are structurally compatible; the cast is only needed due to SDK type constraint (`params` must be `Record<string, unknown>`).

**Fix:** Replace with direct cast and explanatory comment:
```ts
params: verdict as Record<string, unknown>,
// SDK requires params: Record<string, unknown>; PermissionVerdict is structurally compatible
```

and:
```ts
params: params as Record<string, unknown>,
// SDK requires params: Record<string, unknown>; notification shape is structurally compatible
```

**Type safety:** `PermissionVerdict` is `{ request_id: string; behavior: 'allow' | 'deny' }` — every field is a string-valued property, directly assignable to `Record<string, unknown>` conceptually. The direct cast is safer than double-casting through `unknown`.

---

### L9 — safeErrorMessage regex suffix `[\w-]+` → `[^\s]+` (config.ts)

**Current state:**
```ts
return msg.replace(/x(?:ox[a-z]|app)-[\w-]+/g, '[REDACTED]')
```

**Gap:** Slack tokens can contain characters beyond `\w` and `-`. The regex `[\w-]+` stops at spaces, which is fine for single-line error messages. But multi-line error strings (e.g., stack traces where the token appears mid-line followed by a newline) would have the suffix stop at the newline correctly. However, `[\w-]+` misses tokens containing characters like `.` or `+` if Slack ever uses them in token formats.

More importantly, `[^\s]+` is semantically clearer: "match everything that isn't whitespace", which is the correct boundary for a token in error text.

**Fix:**
```ts
return msg.replace(/x(?:ox[a-z]|app)-[^\s]+/g, '[REDACTED]')
```

**Risk:** Very low. `[^\s]+` is a superset of `[\w-]+` — it matches everything the old regex matched plus additional non-whitespace characters. This can only over-redact, never under-redact.

---

## Implementation Order

All 5 changes are independent of each other. Suggested order for clarity:

1. **config.ts** — SLACK_CHANNEL_ID regex + safeErrorMessage suffix (M4 + L9 in one file)
2. **permission.ts** — Export PERMISSION_ID_RE (M6, part 1)
3. **server.ts** — Import PERMISSION_ID_RE, remove old construction, fix double casts (M6 part 2 + M8)
4. **slack-client.ts** — Apply safeErrorMessage to logger.error (M5)

---

## Test Impact

No new test cases are strictly required for these changes:

- M4: The existing config validation tests should be extended with a test for invalid SLACK_CHANNEL_ID format, and updated to provide a valid format in happy-path tests.
- M5: The `createStderrLogger` tests (if any) should verify the error method sanitizes.
- M6: Existing permission tests don't call `new RegExp` directly — just use the exported constant.
- M8: Pure TypeScript — no runtime change.
- L9: The existing `safeErrorMessage` tests should add a case for multi-char/non-word token suffixes.

Check existing test files:
```
src/__tests__/config.test.ts
src/__tests__/permission.test.ts
```

---

## Validation Architecture

Tests to run after implementation:
- `bun test` — full unit test suite
- `bunx tsc --noEmit` — type check (catches M8 cast issues)
- `bunx biome check .` — lint (catches any style regressions)

Success gate: `bun test` passes, `bunx tsc --noEmit` exits 0.

## RESEARCH COMPLETE
