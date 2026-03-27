# Tech Debt Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve all identified tech debt — duplicated constants, silent error swallowing, stale docs, unused exports, version duplication, and fragile type casts.

**Architecture:** Small, surgical changes across existing files. No new modules. Extract shared constants, read version from package.json, log shutdown errors, fix doc counts, remove unused export.

**Tech Stack:** TypeScript, Bun runtime, Zod, @modelcontextprotocol/sdk

---

### Task 1: Extract shared `PERMISSION_ID_RE` constant

The permission request_id regex `/^[a-km-z]{5}$/` is duplicated in `permission.ts:5` and `server.ts:155`. Extract to a shared constant.

**Files:**
- Modify: `src/permission.ts:5`
- Modify: `src/server.ts:152-155`

**Step 1: Add exported constant to `permission.ts`**

In `src/permission.ts`, export the raw regex pattern as a constant and use it in the reply regex:

```typescript
// Protocol spec: request_id is 5 lowercase letters from a-z excluding 'l'
// (to avoid 1/I/l confusion on mobile screens)
export const PERMISSION_ID_PATTERN = '[a-km-z]{5}'

const PERMISSION_REPLY_RE = new RegExp(`^\\s*(y|yes|n|no)\\s+(${PERMISSION_ID_PATTERN})\\s*$`, 'i')
```

**Step 2: Use shared constant in `server.ts`**

Replace the inline regex in the `PermissionRequestSchema` Zod definition:

```typescript
import { PERMISSION_ID_PATTERN, formatPermissionRequest, parsePermissionReply } from './permission.ts'

// ... then at line 155:
request_id: z.string().regex(new RegExp(`^${PERMISSION_ID_PATTERN}$`)),
```

**Step 3: Run tests to verify nothing broke**

Run: `bun test`
Expected: All 64 tests pass

**Step 4: Commit**

```
fix: extract shared PERMISSION_ID_PATTERN to eliminate regex duplication
```

---

### Task 2: Read version from `package.json` instead of hardcoding

`server.ts:15` hardcodes `'0.1.0'` — it should read from `package.json`.

**Files:**
- Modify: `src/server.ts:15`

**Step 1: Import version from package.json**

At top of `server.ts`, add:

```typescript
import packageJson from '../package.json'
```

Then replace the hardcoded version:

```typescript
const server = new Server(
  { name: config.serverName, version: packageJson.version },
```

**Step 2: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 3: Commit**

```
fix: read server version from package.json instead of hardcoding
```

---

### Task 3: Log shutdown errors instead of silently swallowing

`server.ts:247-263` — the `shutdown()` function catches and ignores all errors. Log them to stderr.

**Files:**
- Modify: `src/server.ts:247-263`

**Step 1: Replace silent catch blocks with logging**

```typescript
async function shutdown(signal: string): Promise<void> {
  console.error(`[shutdown] ${signal}`)
  try {
    await socketMode.disconnect()
  } catch (err) {
    console.error('[shutdown] socketMode.disconnect failed:', safeErrorMessage(err))
  }
  try {
    await messageQueue
  } catch (err) {
    console.error('[shutdown] messageQueue drain failed:', safeErrorMessage(err))
  }
  try {
    await server.close()
  } catch (err) {
    console.error('[shutdown] server.close failed:', safeErrorMessage(err))
  }
  process.exit(0)
}
```

**Step 2: Run tests**

Run: `bun test`
Expected: All tests pass (shutdown is not exercised in unit tests)

**Step 3: Commit**

```
fix: log shutdown errors instead of silently swallowing them
```

---

### Task 4: Remove unused `ChannelNotificationParams` export

`channel-bridge.ts:3` — `ChannelNotificationParams` is exported but never imported in production code. The return type is inferred. Remove the export keyword (keep the interface for documentation, just don't export it).

**Files:**
- Modify: `src/channel-bridge.ts:3`
- Check: `src/__tests__/channel-bridge.test.ts` — may import it

**Step 1: Check if tests import the interface**

Read `src/__tests__/channel-bridge.test.ts` to see if `ChannelNotificationParams` is imported.

**Step 2: Update the interface visibility**

If the test imports it: keep the export (test usage is valid).
If no test imports it: remove `export` keyword:

```typescript
interface ChannelNotificationParams {
```

**Step 3: Run tests and typecheck**

Run: `bun test && bunx tsc --noEmit`
Expected: All pass

**Step 4: Commit**

```
refactor: remove unused ChannelNotificationParams export
```

---

### Task 5: Remove stub `CallToolRequestSchema` handler from `createServer()`

`server.ts:59-65` — The stub handler is immediately overridden in the CLI path. It exists only to make the server "complete" for unit tests, but those tests don't exercise it. Remove the stub and update tests that depend on it.

**Files:**
- Modify: `src/server.ts:59-65`
- Modify: `src/__tests__/server.test.ts` (if any test exercises the stub)

**Step 1: Check if any test calls the stub handler**

Read `src/__tests__/server.test.ts` — the existing tests access `_requestHandlers?.get('tools/list')` but not `tools/call`. Verify no test depends on the stub.

**Step 2: Remove the stub handler**

Delete lines 59-65 from `server.ts`:

```typescript
// DELETE:
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'reply') {
    return { content: [{ type: 'text', text: 'sent' }] }
  }
  throw new Error(`Unknown tool: ${request.params.name}`)
})
```

Also remove `CallToolRequestSchema` from the import if it's no longer used in `createServer()` (it's still used in the CLI section so it stays).

**Step 3: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 4: Commit**

```
refactor: remove stub CallToolRequest handler — only CLI handler is needed
```

---

### Task 6: Fix stale test count in `CONTRIBUTING.md`

`CONTRIBUTING.md:31` says "48+ tests" but actual count is 64.

**Files:**
- Modify: `CONTRIBUTING.md:31`

**Step 1: Update the count**

Change:

```markdown
The test suite currently has 48+ tests.
```

To match the final test count after all changes in this plan. Run `bun test` first to get the exact number, then update. Use a dynamic-friendly phrasing:

```markdown
The test suite currently has 60+ tests.
```

(Use a round-down number so it doesn't go stale immediately if tests are added/removed.)

**Step 2: Commit**

```
docs: fix stale test count in CONTRIBUTING.md
```

---

### Task 7: Commit untracked `CLAUDE.md` and `docs/`

These files are referenced in the project but have never been committed.

**Files:**
- Add: `CLAUDE.md`
- Add: `docs/implementation-plan.md`
- Add: `docs/research-synthesis.md`
- Add: `docs/slack-best-practices.md`
- Add: `docs/typescript-bun-setup-research.md`

**Step 1: Review docs for any secrets or tokens**

Scan all 4 docs files and `CLAUDE.md` for anything that looks like a real token (`xoxb-`, `xapp-`, API keys). These are planning/research docs so they should be clean, but verify.

**Step 2: Add to git and commit**

```bash
git add CLAUDE.md docs/
git commit -m "docs: commit CLAUDE.md and implementation research docs"
```

Note: `docs/plans/` will contain this plan file. Include it too.

---

### Task 8: Final verification

**Step 1: Run full CI check**

```bash
bunx tsc --noEmit && bunx biome check . && bun test
```

Expected: All pass, no lint errors, no type errors.

**Step 2: Verify test count matches docs**

Compare `bun test` output count with `CONTRIBUTING.md` and `README.md` claims.
