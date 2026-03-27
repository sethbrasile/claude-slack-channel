# Phase 5 Research: Testability & Dead Code Cleanup

**Gathered:** 2026-03-27
**Status:** Research Complete

## RESEARCH COMPLETE

---

## What I Need to Know to Plan This Phase Well

This phase addresses the "Test Surface Mismatch" structural pattern identified in the deep review. The changes are surgical — no new features, no architecture changes. The key question is: what exact changes are needed, in what order, to satisfy all 9 success criteria without breaking the existing 48+ tests?

---

## Source Code Analysis

### H1: createServer() missing CallToolRequestSchema handler

**Current state** (`src/server.ts`):
- `createServer(config: ChannelConfig)` registers `ListToolsRequestSchema` (tool advertising) — line 36
- `CallToolRequestSchema` handler is registered only inside `if (import.meta.main)` — lines 192-240
- `web` (WebClient) and `tracker` (ThreadTracker) are created inside the CLI block — lines 89, 98
- The factory function has no access to `web` or `tracker`

**Fix approach** (per deep review recommendation):
- Add optional injected dependencies: `createServer(config, { web?, tracker? } = {})`
- Move the `CallToolRequestSchema` handler into `createServer()` body, guarded by `if (web && tracker)`
- CLI block creates `web` and `tracker`, then calls `createServer(config, { web, tracker })`
- The handler logic is identical — just moved inside the factory

**Test approach** (SC-3):
- Create mock `web` and `tracker` objects
- Call `createServer(config, { web: mockWeb, tracker: mockTracker })`
- Invoke the `CallToolRequestSchema` handler directly via `_requestHandlers.get('tools/call')`
- Test branches: unknown tool name, Zod validation failure, mention stripping, `start_thread` true/false

**Important**: The `_requestHandlers` Map key for CallToolRequestSchema is `'tools/call'` (matches the MCP protocol method name, not the schema variable name).

### M2: isDuplicate is dead code

**Current state**:
- `isDuplicate(ts, seen)` exported from `slack-client.ts` — lines 69-73
- Uses a `Set<string>` parameter
- Runtime dedup uses inline `Map<string, number>` with TTL at lines 127, 153-159
- The two are completely separate — `isDuplicate` is never called in the runtime path
- Has 4 dedicated unit tests in `slack-client.test.ts` lines 43-68

**Fix**: Remove the function and its 4 tests. The inline Map TTL approach is strictly better (has expiry). The deep review explicitly recommends removal over refactoring.

**Impact on imports**: The test file imports `isDuplicate` at line 2. After removal, the import must be updated.

### M3: CallToolRequestSchema handler has zero test coverage

**Branches to test** (from server.ts lines 192-240):
1. Unknown tool name → `isError: true` with "Unknown tool: {name}" message
2. Zod validation failure → `isError: true` with "Invalid arguments: {message}"
3. Happy path with `start_thread: false` (or absent) → `tracker.startThread` NOT called
4. Happy path with `start_thread: true` + successful post → `tracker.startThread` called with `result.ts`
5. Mention stripping: `<!channel>`, `<!here>`, `<!everyone>` → zero-width space injection

**Dependency injection approach**:
```typescript
// Mock web client
const mockWeb = {
  chat: {
    postMessage: mock(() => Promise.resolve({ ok: true, ts: '1234567890.000100' }))
  }
}
// Mock tracker
const mockTracker = {
  startThread: mock(() => {}),
  activeThreadTs: null,
  abandon: mock(() => {}),
  classifyMessage: mock(() => 'new_input'),
}
```

### M9: safeErrorMessage missing xoxp- and xoxa- token tests

**Current state** (`config.test.ts` lines 103-117):
- Tests xoxb- mask ✓
- Tests xapp- mask ✓
- Does NOT test xoxp- or xoxa-

**Regex in config.ts**: `/x(?:ox[a-z]|app)-[\w-]+/g`
- This covers xoxa-, xoxb-, xoxc-... xoxz- patterns
- xoxp- is the user token prefix (personal OAuth tokens)
- xoxa- is the app-level token prefix

**Fix**: Add two tests:
```typescript
it('masks xoxp- tokens', () => { ... })
it('masks xoxa- tokens', () => { ... })
```

### M10: Missing edge case tests

**a) Whitespace-only ALLOWED_USER_IDS**
- Input: `'   '` (spaces only)
- `split(',').map(trim).filter(Boolean)` → empty array
- Zod refine `arr.length > 0` → fails → `process.exit(1)`
- Test: expect process.exit(1) to be called
- Note: This is different from commas-only (which is already tested)

**b) classifyMessage('')**
- `ThreadTracker.classifyMessage('')` with `activeThreadTs = null`
- Empty string is falsy in `if (!thread_ts || ...)` check
- Expected: returns `'new_input'`
- File: `threads.test.ts`

**c) formatInboundNotification with empty text**
- Input: `{ ...baseMessage, text: '' }`
- Expected: `result.content === ''`
- The function uses `msg.text` directly — no trimming or validation
- File: `channel-bridge.test.ts`

**d) formatPermissionRequest with absent input_preview**
- In `server.ts` line 155: `input_preview: z.string().optional().default('')`
- But the `formatPermissionRequest` function itself accepts `input_preview` as string (from PermissionRequest type)
- The conditional: `req.input_preview ? ... : ''` means empty string → no code block line
- Test: call `formatPermissionRequest` without `input_preview` or with `input_preview: ''`
- Expected: result contains tool_name, description, request_id, yes/no prompt — but NO triple backtick block
- File: `permission.test.ts`

### L5: Logger tests too weak

**Current state** (`slack-client.test.ts` lines 70-102):
```typescript
logger.info('test message')
expect(spy).toHaveBeenCalled()  // only checks it was called
```

**Fix**: Strengthen to check message content:
```typescript
expect(spy).toHaveBeenCalledWith(expect.stringContaining('[slack:info]'), 'test message')
```

Note: `console.error` in `createStderrLogger` is called with two args: the prefix string and the message. The `spyOn` call captures both arguments.

Actually looking at the implementation more carefully:
```typescript
info: (...msgs: unknown[]) => console.error('[slack:info]', ...msgs)
```
So `logger.info('test message')` calls `console.error('[slack:info]', 'test message')`.
The spy will be called with `('[slack:info]', 'test message')`.

Using `toHaveBeenCalledWith('[slack:info]', 'test message')` is exact. The recommendation says `expect.stringContaining('[slack:')` — that applies to the first argument.

### L6: Logger setLevel/setName/getLevel untested

**Current implementation** (`slack-client.ts` lines 91-93):
```typescript
setLevel: (_level: LogLevel) => {},  // no-op
setName: (_name: string) => {},       // no-op
getLevel: () => LogLevel.INFO,        // returns constant
```

**Tests to add**:
```typescript
it('setLevel does not throw', () => { expect(() => logger.setLevel(LogLevel.DEBUG)).not.toThrow() })
it('setName does not throw', () => { expect(() => logger.setName('test')).not.toThrow() })
it('getLevel returns LogLevel.INFO', () => { expect(logger.getLevel()).toBe(LogLevel.INFO) })
```

Import `LogLevel` from `'@slack/logger'` in the test file.

### L8: <!everyone> not tested in mention stripping

**Current test** (`permission.test.ts` lines 85-95):
Tests `<!channel>` and `<!here>` in `formatPermissionRequest`.

**Fix**: Add `<!everyone>` to the existing test case OR add a separate test:
```typescript
it('strips <!everyone> broadcast mention', () => {
  const result = formatPermissionRequest({
    request_id: 'abcde',
    tool_name: '<!everyone> alert',
    description: 'notify all',
    input_preview: '',
  })
  expect(result).not.toContain('<!everyone>')
})
```

### L11: SDK private property access comment

**Current state** (`server.test.ts`):
- Line 22-27: first SDK access has inline comment "SDK-version-dependent access; may need updating if SDK internals change"
- Lines 52-65: `_requestHandlers` access — no describe-block comment
- The describe block `describe('createServer', () => {` has no header comment

**Fix**: Add a comment at the describe-block level:
```typescript
describe('createServer', () => {
  // NOTE: Several tests below access SDK private properties (_capabilities,
  // _instructions, _requestHandlers) via type casts. These are SDK-version-
  // dependent and may need updating if the @modelcontextprotocol/sdk internals change.
```

---

## Validation Architecture

### Test Suite Integrity

After all changes, `bun test` must pass with zero failures. The risk areas:

1. **Removing isDuplicate**: The test file imports it explicitly. The import line and the 4 test cases must all be removed. If only some are removed, TypeScript will error on the unused import (biome lint will also flag it).

2. **Moving handler into createServer()**: The `web.chat.postMessage` call inside the handler references `config.channelId`. This reference remains valid since `config` is in scope inside `createServer()`. The tracker reference changes from local variable to injected parameter.

3. **Bun mock API**: Bun uses `mock()` from `'bun:test'`. Mock functions track calls via `.mock.calls`. Use `spyOn` for existing objects or `mock()` for creating mock functions.

4. **LogLevel import**: `LogLevel` is exported from `'@slack/logger'`. The `slack-client.ts` already imports it. The test file will need this import added.

### Critical Runtime Invariant

**stdout is sacred**: No change in this phase should add any `console.log` or stdout output. All logging uses `console.error()`. The test changes don't affect runtime behavior.

---

## Execution Order

The cleanest execution order to minimize merge conflicts between changes:

**Wave 1 (parallel — separate files):**
- `server.ts`: Add optional `web`/`tracker` deps to `createServer()`, move `CallToolRequestSchema` handler inside
- `slack-client.ts`: Remove `isDuplicate` function

**Wave 2 (test updates — depend on Wave 1):**
- `server.test.ts`: Add describe-block comment (L11), add reply tool handler tests (SC-3)
- `slack-client.test.ts`: Remove `isDuplicate` tests + import, strengthen logger assertions (L5), add setLevel/setName/getLevel tests (L6)
- `config.test.ts`: Add xoxp- and xoxa- test cases (M9), add whitespace-only ALLOWED_USER_IDS test (M10a)
- `threads.test.ts`: Add classifyMessage('') test (M10b)
- `channel-bridge.test.ts`: Add empty text test (M10c)
- `permission.test.ts`: Add absent input_preview test (M10d), add <!everyone> test (L8)

---

## Known Constraints

1. **createServer() signature change is backward-compatible**: The second parameter is optional with default `{}`. Existing callers in tests pass only `TEST_CONFIG` — they continue to work, they just get a server without the CallToolRequestSchema handler registered (which matches current behavior).

2. **Type for injected deps**: Define an interface or use inline optional type:
   ```typescript
   export function createServer(
     config: ChannelConfig,
     deps?: { web?: WebClient; tracker?: ThreadTracker }
   ): Server
   ```
   This requires importing `WebClient` and `ThreadTracker` at the top of `server.ts`. They're already used in the CLI block — just need to be accessible at function scope.

3. **Bun test mock assertions**: Bun's `mock()` returns a function with `.mock.calls` property. To assert call count: `expect(mockFn.mock.calls.length).toBe(1)`. Or use `spyOn` pattern: `const spy = spyOn(mockTracker, 'startThread')`.

4. **No new runtime behavior**: This phase is purely additive (tests) and subtractive (dead code). The server's runtime behavior does NOT change from the user's perspective.
