# Phase 14: Test Coverage Gaps - Research

**Researched:** 2026-03-28
**Domain:** Bun test suite hardening — unit test gaps, source code fixes, assertion quality
**Confidence:** HIGH

## Summary

Phase 14 closes the remaining test coverage gaps identified in the 2026-03-28 deep review (Grouping 6).
The work spans two categories: (1) source code fixes that enable tests to be written (L3, L4, L5, L9,
L11 require code changes before tests exist), and (2) new/updated tests for already-correct behavior
that is simply untested (M10, M11, M12, L2, L15, L16, L17, L18, L19, L20).

Current baseline: 111 passing tests, 0 failures. The phase must preserve this baseline and add new
passing tests for all 18 deep-review findings listed in the phase requirements.

The codebase uses Bun's built-in test runner (`bun:test`) with `mock()`, `spyOn()`, `describe()`,
`it()`, `expect()`, `beforeEach()`, `afterEach()`. No external test framework is needed. All test
patterns are already established in the existing suite — this phase adds tests following existing
conventions.

**Primary recommendation:** Fix source code first (L3, L4, L5, L9, L11), then add tests. Several
findings require both a source change AND a test — do not write tests against broken code.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| M4 | classifyMessage empty string edge case — explicit guard assertion needed | threads.ts:18 already handles falsy via `!threadTs`; test at line 57 exists but description says "treated as top-level" which is accurate but M4 wants explicit guard code rather than falsy short-circuit. Source fix: add `if (threadTs === '') return 'new_input'` or note it is already covered. Test fix: verify description is accurate (L18 overlap). |
| M10 | SDK private property tests are fragile — add guard assertions that fail loudly | server.test.ts lines 27-55 access `_capabilities`, `_instructions`, `_requestHandlers` without guards; add `if (!capabilities) throw new Error('SDK internals changed')` pattern |
| M11 | No test for chat.postMessage returning `{ ok: false }` — verify isError: true | makeReplyHandler in server.ts:71-73 already throws on ok:false; test needs mockPostMessage to return `{ ok: false, error: 'channel_not_found' }` and verify `result.isError === true` |
| M12 | TTL dedup logic inside createSlackClient is untested — duplicate ts suppressed, expired ts re-accepted | seenTs Map and TTL sweep are closure-private; testing seam is the `'message'` event on socketMode; requires SocketModeClient mock or extracting an exported `isDuplicateTs` pure function |
| L2 | seenTs map has no upper-bound cap — needs cap added AND tested | Source fix required in slack-client.ts before test can cover it |
| L3 | Broadcast mention stripping doesn't cover `<@UXXXXX>` or `<!subteam^>` | Source fix required in server.ts makeReplyHandler and permission.ts stripMentions |
| L4 | userId in formatPermissionResult not validated against SLACK_USER_ID_RE | Source fix in permission.ts; SLACK_USER_ID_RE is in config.ts — export it or duplicate pattern |
| L5 | safeErrorMessage regex stops at whitespace — mid-word token edge case | Source fix in config.ts: change `[^\s]+` to `\S+` (same) or `\w+` or remove boundary; verified: current regex already handles mid-word via `[^\s]+` (non-whitespace chars) |
| L9 | No forced-exit timeout in shutdown — process hangs if server.close() never resolves | Source fix in server.ts shutdown function: add `setTimeout(() => process.exit(1), 5000)` before awaiting server.close() |
| L10 | bin entry point behavior documented or tested | bin points to src/server.ts; shebang `#!/usr/bin/env bun` is present; finding says "documented or tested" — add a comment in package.json or a note in CONTRIBUTING.md, OR write a smoke test |
| L11 | examples/ included in npm files array — should be excluded or justified | package.json files array includes "examples"; source fix: remove or justify |
| L15 | Broadcast mention test assertions don't verify replacement character | server.test.ts lines 144-175: tests check `.not.toContain('<!channel>')` but don't verify the zero-width space replacement `'<\u200b!'` is present |
| L16 | ALLOWED_USER_IDS trim behavior untested | config.ts splits and trims; test should pass `' U123 , U456 '` and verify `['U123', 'U456']` |
| L17 | formatPermissionBlocks not tested with broadcast mentions in fields | permission.test.ts has no test for `<@U12345>` or `<!subteam^>` in req.tool_name or req.description passed to formatPermissionBlocks |
| L18 | classifyMessage('') test description misleading | threads.test.ts:57 says "empty string treated as top-level" — this is accurate; but M4 says code path differs from undefined. Verify code, fix description to be precise |
| L19 | safeErrorMessage not tested with mid-word token | config.test.ts: add test with `'errorxoxb-123abc'` (token embedded in word) — verify REDACTED |
| L20 | No test for createServer without deps — tools/call handler boundary | createServer(config) without deps should NOT have a tools/call handler registered (no web/tracker); test that `_requestHandlers.has('tools/call')` is false |
</phase_requirements>

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bun:test | Bun built-in | Test runner, mocks, spies | Already used throughout test suite |
| @modelcontextprotocol/sdk | ^1.28.0 | Server instance under test | Already dependency |
| @slack/web-api | ^7.15.0 | WebClient mock target | Already dependency |
| zod | ^4.3.6 | Config validation under test | Already dependency |

### No New Dependencies
All libraries needed for this phase are already installed. No `bun add` calls required.

**Test run commands:**
```bash
bun test                 # full suite (must stay green)
bun test --coverage      # with coverage report
bunx tsc --noEmit        # type checking must pass
bunx biome check .       # linting must pass
```

## Architecture Patterns

### Pattern 1: Bun test mock() for async functions
```typescript
// Source: existing server.test.ts (makeServer helper)
const mockPostMessage = mock(() => Promise.resolve({ ok: false, error: 'channel_not_found' }))
const mockWeb = { chat: { postMessage: mockPostMessage } }
```

### Pattern 2: SDK private property guard assertions (M10 fix)
```typescript
// Add guard before accessing _capabilities etc.
const capabilities = (server as unknown as { _capabilities?: Record<string, unknown> })._capabilities
if (!capabilities) throw new Error('SDK internals changed — update test to match new SDK API')
expect(capabilities.experimental).toBeDefined()
```

### Pattern 3: Testing a pure function extracted from closure (M12)
Two options:
1. **Export a seam function** — extract `isDuplicateTs(seenTs, ts, now)` from the closure in `createSlackClient` and export it. This is the cleanest approach and matches the codebase pattern (see `validateEventTs` which was extracted exactly this way).
2. **Fire the 'message' event** — use a mocked SocketModeClient and emit events. Higher integration cost, more brittle.

**Recommended: extract `isDuplicateTs` as an exported pure function** matching the `validateEventTs` / `shouldProcessMessage` pattern already established in `slack-client.ts`.

```typescript
// Extracted pure function (matches codebase pattern)
export function isDuplicateTs(seenTs: Map<string, number>, ts: string, now: number): boolean {
  // TTL sweep
  for (const [key, expiry] of seenTs.entries()) {
    if (now > expiry) seenTs.delete(key)
  }
  if (seenTs.has(ts)) return true
  seenTs.set(ts, now + DEDUP_TTL_MS)
  return false
}
```

### Pattern 4: Forced-exit timeout in shutdown (L9)
```typescript
// Add before server.close() await
const forceExitTimer = setTimeout(() => {
  console.error('[shutdown] forced exit after timeout')
  process.exit(1)
}, 5000)
forceExitTimer.unref() // don't prevent clean exit

try {
  await server.close()
} finally {
  clearTimeout(forceExitTimer)
}
```

**Note:** `timer.unref()` is Bun-compatible (same Node.js API). Testing this requires verifying the timeout is registered, not that it fires — that would require actual timing in tests.

### Pattern 5: seenTs map upper-bound cap (L2)
```typescript
// Add cap check before set (in createSlackClient or isDuplicateTs)
const MAX_SEEN_TS = 10_000
if (seenTs.size >= MAX_SEEN_TS) {
  // Evict the oldest entry (first inserted in Map iteration order)
  const firstKey = seenTs.keys().next().value
  if (firstKey !== undefined) seenTs.delete(firstKey)
}
seenTs.set(ts, now + DEDUP_TTL_MS)
```

### Pattern 6: Broadcast mention stripping expansion (L3)
Current `stripMentions` only handles `<!` patterns. Need to also handle:
- `<@UXXXXX>` — user mentions
- `<!subteam^SXXXXX>` — subteam group mentions

```typescript
function stripMentions(s: string): string {
  return s
    .replaceAll('<!', '<\u200b!')       // broadcast: <!channel>, <!here>, <!everyone>
    .replaceAll('<@', '<\u200b@')       // user mentions: <@U12345>
    // <!subteam^ is already covered by the <!  replacement above
}
```

**Note:** `<!subteam^>` is already covered by the `<!` replacement since it starts with `<!`. Only `<@>` user mentions need the new rule. Verify in tests.

### Anti-Patterns to Avoid
- **Do not use `setTimeout` with real delays in tests** — use `mock()` for time-dependent logic, or pass `now` as a parameter to extracted pure functions.
- **Do not import from `bun:test` without destructuring** — use `import { describe, expect, it, mock } from 'bun:test'`.
- **Do not use `as any`** — existing tests use `as unknown as Type` two-step cast per Biome rules.
- **Do not skip Biome lint** — `biome-ignore` comments require justification comment; avoid adding new ones.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time mocking | Custom clock | Pass `now: number` param to extracted function | Pure function with injected time is testable without fake timers |
| SocketModeClient mocking | Full EventEmitter mock | Export `isDuplicateTs` pure function, test it directly | Matches existing codebase pattern (validateEventTs precedent) |

## Common Pitfalls

### Pitfall 1: L5 — safeErrorMessage regex is already correct
**What goes wrong:** Reading the deep review finding L5 and assuming the regex is broken.
**Reality:** `[^\s]+` matches any non-whitespace characters, including mid-word tokens. The regex `x(?:ox[a-z]|app)-[^\s]+` already matches `errorxoxb-123abc` because `[^\s]+` continues past word characters.
**Verification:** `'errorxoxb-123abc'.match(/x(?:ox[a-z]|app)-[^\s]+/)` returns a match at index 5.
**What's actually needed:** A TEST demonstrating this works (L19), not a source fix. The finding says "mid-word token edge case" — add the test to document and protect the behavior.

### Pitfall 2: M4 — classifyMessage empty string is already handled
**What goes wrong:** Thinking `threads.ts` needs a source change for M4.
**Reality:** `if (!threadTs)` at line 18 is falsy for both `undefined` and `''`. Empty string already returns `'new_input'`. The deep review finding says "follows a different code path than undefined" but after code inspection, `!''` is `true`, so both hit the same guard.
**What's needed:** The test description fix (L18) and potentially an explicit `if (threadTs === '') return 'new_input'` for clarity (M4 says "add explicit guard"). The planner should decide whether to add an explicit guard or just fix the test description.

### Pitfall 3: L4 — SLACK_USER_ID_RE is unexported from config.ts
**What goes wrong:** Trying to import `SLACK_USER_ID_RE` from `config.ts` into `permission.ts` — it's not exported.
**Fix:** Either export it from `config.ts` and import in `permission.ts`, or add validation inline in `formatPermissionResult`. The simpler option is to validate in-place since the regex is a one-liner: `/^[UW][A-Z0-9]+$/`.

### Pitfall 4: L20 — createServer without deps has NO tools/call handler
**What goes wrong:** Assuming createServer always registers a tools/call handler.
**Reality:** `createServer(config)` without `deps?.web && deps?.tracker` does NOT call `wireHandlers()`, so `_requestHandlers` will NOT have `'tools/call'`. The test for L20 should verify this boundary — that the no-deps path does NOT register the handler.

### Pitfall 5: L11 — examples removal may be intentional
**What goes wrong:** Blindly removing `examples` from the `files` array.
**Context:** The deep review says "excluded from npm files array (or justified if included)". The examples directory contains user-facing guides (`basic-setup.md`, `multi-project-vm.md`). If included intentionally for npm consumers, the justification should be a comment in package.json or docs. If excluded, the examples still exist in the git repo.

## Code Examples

### M11 — chat.postMessage ok:false test (verified against makeReplyHandler source)
```typescript
// Source: server.ts:71-73 — throws Error when result.ok is false
it('returns isError: true when chat.postMessage returns ok: false', async () => {
  const mockPostMessage = mock(() =>
    Promise.resolve({ ok: false, error: 'channel_not_found' })
  )
  const mockTracker = {
    startThread: mock((_ts: string) => {}),
    abandon: mock(() => {}),
    classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
    get activeThreadTs() { return null },
  }
  const handler = makeReplyHandler(
    { chat: { postMessage: mockPostMessage } } as unknown as WebClient,
    mockTracker as unknown as ThreadTracker,
    TEST_CONFIG as ChannelConfig,
  )
  const result = await handler({ params: { name: 'reply', arguments: { text: 'hello' } } })
  expect(result.isError).toBe(true)
  expect(result.content[0]?.text).toContain('Failed to send')
})
```

### M10 — SDK private property guard assertion
```typescript
// Source: server.test.ts existing pattern + M10 guard
it('declares experimental claude/channel capability', () => {
  const server = createServer(TEST_CONFIG)
  const capabilities = (server as unknown as { _capabilities?: Record<string, unknown> })._capabilities
  if (!capabilities) throw new Error('SDK internals changed — _capabilities no longer exists')
  expect(capabilities.experimental).toBeDefined()
  const experimental = capabilities.experimental as Record<string, unknown> | undefined
  expect(experimental?.['claude/channel']).toBeDefined()
})
```

### M12 — isDuplicateTs pure function test (after extraction)
```typescript
// After extracting isDuplicateTs from createSlackClient closure
it('suppresses duplicate ts within TTL window', () => {
  const seenTs = new Map<string, number>()
  const now = Date.now()
  expect(isDuplicateTs(seenTs, '123.456', now)).toBe(false) // first time: not duplicate
  expect(isDuplicateTs(seenTs, '123.456', now + 1000)).toBe(true) // same ts: duplicate
})

it('re-accepts ts after TTL expiry', () => {
  const seenTs = new Map<string, number>()
  const now = Date.now()
  isDuplicateTs(seenTs, '123.456', now)                     // first seen, TTL = now + 30s
  // Simulate 31 seconds later
  expect(isDuplicateTs(seenTs, '123.456', now + 31_000)).toBe(false) // expired: not duplicate
})
```

### L16 — ALLOWED_USER_IDS trim behavior
```typescript
// Source: config.ts:20-23 — .map((id) => id.trim()).filter(Boolean)
it('trims whitespace from individual user IDs in ALLOWED_USER_IDS', () => {
  const config = parseConfig({ ...VALID_ENV, ALLOWED_USER_IDS: ' U123 , U456 ' })
  expect(config.allowedUserIds).toEqual(['U123', 'U456'])
})
```

### L15 — Broadcast mention replacement character verification
```typescript
// Verify the zero-width space is present after stripping
it('replaces <!channel> with zero-width-space variant', async () => {
  const { handler, mockPostMessage } = makeServer()
  await handler({ method: 'tools/call', params: { name: 'reply', arguments: { text: 'Hello <!channel>' } } })
  const callArgs = (mockPostMessage.mock.calls as unknown as { text: string }[][])[0]?.[0]
  expect(callArgs?.text).toContain('<\u200b!channel>')
})
```

### L19 — safeErrorMessage mid-word token
```typescript
// Source: config.ts:65 — regex [^\s]+ matches non-whitespace incl. word chars
it('masks mid-word xoxb- token (token embedded within a word)', () => {
  const result = safeErrorMessage(new Error('errorxoxb-123abc'))
  expect(result).toContain('[REDACTED]')
  expect(result).not.toContain('xoxb-')
})
```

### L20 — createServer without deps has no tools/call handler
```typescript
it('createServer(config) without deps does not register tools/call handler', () => {
  const server = createServer(TEST_CONFIG)
  const handlers = (server as unknown as { _requestHandlers?: Map<string, unknown> })._requestHandlers
  expect(handlers?.has('tools/call')).toBeFalsy()
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TTL dedup inline in closure | Extract to pure function (isDuplicateTs) | Phase 14 | Enables unit testing without SocketModeClient |
| Broadcast strip via `replaceAll('<!', ...)` only | Also handle `<@` user mentions | Phase 14 | L3 security hardening |

**Source files that need changes (not test-only):**
- `src/threads.ts` — M4: add explicit empty-string guard (optional if tests pass; confirm behavior)
- `src/slack-client.ts` — M12/L2: extract `isDuplicateTs`, add `MAX_SEEN_TS` cap
- `src/server.ts` — L3: expand broadcast stripping in `makeReplyHandler`; L9: add forced-exit timeout
- `src/permission.ts` — L3: expand `stripMentions` for `<@` patterns; L4: validate userId
- `src/config.ts` — L5: export `SLACK_USER_ID_RE` if needed by permission.ts
- `package.json` — L11: remove or justify `examples` in files array

**Test files that need changes:**
- `src/__tests__/server.test.ts` — M10, M11, L15, L17, L20
- `src/__tests__/slack-client.test.ts` — M12, L2
- `src/__tests__/threads.test.ts` — M4, L18
- `src/__tests__/config.test.ts` — L16, L19
- `src/__tests__/permission.test.ts` — L4, L17

## Open Questions

1. **M4 — Is the explicit guard truly needed?**
   - What we know: `!''` is `true` so `if (!threadTs)` already handles empty string correctly
   - What's unclear: Does the deep review want a code change or just confirmation + test update?
   - Recommendation: Add `if (threadTs === '') return 'new_input'` as a clarifying guard, and fix the test description (L18) to be explicit that both `undefined` AND `''` are covered by the guard.

2. **L11 — Remove examples from npm files or justify?**
   - What we know: examples are `basic-setup.md` and `multi-project-vm.md`, user-facing docs
   - What's unclear: whether npm consumers benefit from having them or they just bloat the package
   - Recommendation: Remove from npm `files` (docs are on GitHub), add comment to package.json. Verified this is what the success criteria implies ("excluded from npm files array (or justified if included)").

3. **L10 — Test or document bin entry point?**
   - What we know: `bin` points to `src/server.ts`, shebang `#!/usr/bin/env bun` is present, CONTRIBUTING.md explains Bun-only invocation
   - Recommendation: Add a comment in package.json or a test that reads the shebang line. A comment in package.json is the lowest-friction approach; a test is more durable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | none — bun discovers `src/__tests__/*.test.ts` automatically |
| Quick run command | `bun test` |
| Full suite command | `bun test --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| M4 | classifyMessage('') explicit guard | unit | `bun test src/__tests__/threads.test.ts` | Yes (update) |
| M10 | SDK private property guard assertions | unit | `bun test src/__tests__/server.test.ts` | Yes (update) |
| M11 | postMessage ok:false returns isError:true | unit | `bun test src/__tests__/server.test.ts` | Yes (add test) |
| M12 | TTL dedup: duplicate suppressed, expired re-accepted | unit | `bun test src/__tests__/slack-client.test.ts` | Yes (add test) |
| L2 | seenTs map cap tested | unit | `bun test src/__tests__/slack-client.test.ts` | Yes (add test) |
| L3 | `<@UXXXXX>` mention stripping | unit | `bun test src/__tests__/server.test.ts` | Yes (add test) |
| L4 | userId validated in formatPermissionResult | unit | `bun test src/__tests__/permission.test.ts` | Yes (add test) |
| L5/L19 | safeErrorMessage mid-word token | unit | `bun test src/__tests__/config.test.ts` | Yes (add test) |
| L9 | forced-exit timeout in shutdown | code review | n/a — CLI block not directly testable | n/a |
| L10 | bin entry point behavior | comment/doc | n/a | n/a |
| L11 | examples excluded from npm files | config | n/a — verify package.json | n/a |
| L15 | broadcast mention replacement char verified | unit | `bun test src/__tests__/server.test.ts` | Yes (update) |
| L16 | ALLOWED_USER_IDS trim | unit | `bun test src/__tests__/config.test.ts` | Yes (add test) |
| L17 | formatPermissionBlocks with broadcast mentions | unit | `bun test src/__tests__/permission.test.ts` | Yes (add test) |
| L18 | classifyMessage('') test description fix | unit | `bun test src/__tests__/threads.test.ts` | Yes (update) |
| L20 | createServer without deps has no tools/call handler | unit | `bun test src/__tests__/server.test.ts` | Yes (add test) |

### Sampling Rate
- **Per task commit:** `bun test` — full suite (111 baseline + new tests must all pass)
- **Per wave merge:** `bun test --coverage && bunx tsc --noEmit && bunx biome check .`
- **Phase gate:** All three commands green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. No new test files needed;
all additions go into existing `src/__tests__/*.test.ts` files. No framework install required.

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/threads.ts`, `src/config.ts`, `src/slack-client.ts`, `src/server.ts`, `src/permission.ts`
- Direct test inspection: all six files in `src/__tests__/`
- `.planning/reviews/2026-03-28-deep-review.md` — authoritative source for all finding IDs
- `package.json` — verified files array and bin configuration
- Verified regex behavior via `node -e` execution

### Secondary (MEDIUM confidence)
- Bun test API: patterns inferred from existing test suite (no Context7 query needed — patterns already established in codebase)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all patterns already in use
- Architecture: HIGH — source code fully read, extraction pattern (isDuplicateTs) verified against existing precedents (validateEventTs, shouldProcessMessage)
- Pitfalls: HIGH — verified via direct code execution and reading

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable dependencies, no fast-moving ecosystem)
