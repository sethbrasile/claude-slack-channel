---
plan: 05-01
phase: 05-testability-dead-code-cleanup
status: complete
completed: 2026-03-27
tasks_completed: 6/6
tests_before: 63
tests_after: 78
---

# Plan 05-01 Summary: Testability & Dead Code Cleanup

## What Was Built

Aligned the test surface with the runtime surface. Removed dead code. Added 15 new test cases covering previously untested branches and edge cases.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Move CallToolRequestSchema handler into createServer() with injected deps (H1) | ✓ |
| 2 | Remove isDuplicate dead code from slack-client.ts and tests (M2) | ✓ |
| 3 | Add reply handler tests + SDK comment to server.test.ts (M3, L11) | ✓ |
| 4 | Add edge case tests across config, threads, channel-bridge, permission (M9, M10, L8) | ✓ |
| 5 | Strengthen logger tests + add setLevel/setName/getLevel coverage (L5, L6) | ✓ |
| 6 | Final validation — full suite + static checks | ✓ |

## Key Changes

**src/server.ts:**
- `ReplyArgsSchema` moved to module scope
- `createServer()` now accepts optional `deps?: { web?: WebClient; tracker?: ThreadTracker }`
- When deps provided, `CallToolRequestSchema` handler registered inside factory
- Added `import type { WebClient }` at module level

**src/slack-client.ts:**
- `isDuplicate()` function removed (lines 62-73) — dead code. Runtime uses Map-based TTL dedup.

**src/__tests__/server.test.ts:**
- SDK private property describe-block comment added (L11)
- 8 new tests: unknown tool, Zod validation, mention stripping (channel/here/everyone), start_thread true/false, success return

**src/__tests__/slack-client.test.ts:**
- `isDuplicate` removed from imports and test block (4 tests removed)
- Logger tests strengthened to assert `toHaveBeenCalledWith` with prefix strings (L5)
- 3 new tests: setLevel/setName/getLevel (L6)
- `LogLevel` imported from `@slack/logger`

**src/__tests__/config.test.ts:**
- 3 new tests: xoxp- masking, xoxa- masking (M9), whitespace-only ALLOWED_USER_IDS (M10a)

**src/__tests__/threads.test.ts:**
- 1 new test: classifyMessage('') returns 'new_input' (M10b)

**src/__tests__/channel-bridge.test.ts:**
- 1 new test: empty text content (M10c)

**src/__tests__/permission.test.ts:**
- 2 new tests: <!everyone> mention stripping (L8), absent input_preview omits code block (M10d)

## Verification Results

- `bun test`: 78 pass, 0 fail (up from 63 — +15 tests)
- `bunx tsc --noEmit`: exits 0
- `bunx biome check .`: exits 0, no fixes

## Self-Check: PASSED

All 9 success criteria met:
1. ✓ createServer() accepts { web, tracker } deps and registers CallToolRequestSchema handler
2. ✓ isDuplicate removed from source and tests
3. ✓ Reply handler tests cover unknown tool, Zod validation, mention stripping, start_thread branches
4. ✓ safeErrorMessage tests cover xoxp- and xoxa-
5. ✓ Edge cases: whitespace ALLOWED_USER_IDS, classifyMessage(''), empty text, absent input_preview
6. ✓ Logger tests assert message content; setLevel/setName/getLevel covered
7. ✓ <!everyone> tested in permission mention stripping
8. ✓ SDK private property access acknowledged in describe-block comment
9. ✓ bun test passes with 0 failures

## key-files

### modified
- src/server.ts — dep injection, ReplyArgsSchema to module scope
- src/slack-client.ts — isDuplicate removed
- src/__tests__/server.test.ts — SDK comment, 8 new handler tests
- src/__tests__/slack-client.test.ts — isDuplicate removed, logger strengthened
- src/__tests__/config.test.ts — xoxp/xoxa/whitespace tests
- src/__tests__/threads.test.ts — empty string edge case
- src/__tests__/channel-bridge.test.ts — empty text test
- src/__tests__/permission.test.ts — <!everyone> and absent input_preview

## Commits

- `refactor(05-01): inject web/tracker deps into createServer(); remove isDuplicate dead code`
- `test(05-01): add reply handler tests and SDK comment to server.test.ts`
- `test(05-01): add missing edge case tests across all test files`
- `test(05-01): strengthen logger tests and add setLevel/setName/getLevel coverage`
- `fix(05-01): fix TypeScript errors in server.test.ts — optional chaining and import type`
