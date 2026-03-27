# TypeScript + Bun Project Setup Research

> Research document for `claude-slack-channel` — an open-source MCP server.
> Environment: Bun 1.3.6, TypeScript 6.0.2 (available via `bunx tsc`), macOS Darwin 25.2.0.
>
> **Status:** All actionable findings from this research have been incorporated into `docs/implementation-plan.md`. This document serves as the detailed reference backing those decisions.

---

## 1. Bun Project Configuration

### tsconfig.json

The authoritative source is `@tsconfig/bases` → `bases/bun.json`, which tracks `https://bun.com/docs/typescript#suggested-compileroptions`. Its current content:

```jsonc
{
  "$schema": "https://www.schemastore.org/tsconfig",
  "compilerOptions": {
    // Environment
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",

    // Bundler mode
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,

    // Best practices
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    // Disabled by default (enable as project matures)
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false
  }
}
```

**Key differences from the implementation plan's tsconfig:**

| Setting | Plan | Recommended | Reason |
|---|---|---|---|
| `target` | `"ES2022"` | `"ESNext"` | Bun supports the latest; ESNext gives access to all current features |
| `module` | `"ESNext"` | `"Preserve"` | Bun handles module transforms; Preserve tells TypeScript not to touch module syntax |
| `lib` | omitted | `["ESNext"]` | Explicit lib prevents accidental DOM type bleed |
| `moduleDetection` | omitted | `"force"` | Treats every file as a module, preventing global scope collisions |
| `allowImportingTsExtensions` | omitted | `true` | Lets you write `import './foo.ts'` in Bun projects |
| `verbatimModuleSyntax` | omitted | `true` | Enforces `import type` for type-only imports; critical for correctness |
| `noEmit` | omitted | `true` | Required when using `allowImportingTsExtensions`; Bun runs TS directly |
| `outDir` / `rootDir` | present | remove | Conflicts with `noEmit`; unnecessary for a CLI tool Bun runs directly |
| `declaration` | `true` | remove | Incompatible with `noEmit`; this project is not a compiled library |
| `types` | `["bun-types"]` | use `@types/bun` | See below |
| `esModuleInterop` | `true` | omit or keep | Harmless to keep; Slack SDK uses CJS distribution so it helps |
| `skipLibCheck` | omitted | `true` | Essential; third-party type declarations often have issues |

**Recommended tsconfig.json for this project:**

```jsonc
{
  "$schema": "https://www.schemastore.org/tsconfig",
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src", "src/__tests__"]
}
```

Enabling `noUnusedLocals` and `noUnusedParameters` is recommended for a small, focused project like this — it catches dead code early. The official base leaves them off for flexibility, but you can opt in.

**`noUncheckedIndexedAccess` in practice:** This adds `| undefined` to all indexed array/object access (e.g., `arr[0]` becomes `string | undefined`). It catches real bugs but requires more null narrowing. Recommended to keep it — the project uses `allowedUserIds[n]` style access where knowing it might be undefined is genuinely valuable.

### bun-types vs @types/bun

The official Bun documentation switched to `@types/bun` as the recommended package. `@types/bun` (currently 1.3.11) is a thin wrapper that re-exports `bun-types`. Both work, but:

- Install: `bun add -d @types/bun`
- No `"types": [...]` entry needed in tsconfig — TypeScript auto-loads `@types/*` packages
- Remove `"types": ["bun-types"]` from the plan; just having `@types/bun` installed is sufficient

### package.json Patterns

The implementation plan's package.json is mostly correct. Key additions and clarifications:

```json
{
  "name": "claude-slack-channel",
  "version": "0.1.0",
  "description": "Claude Code Channel MCP server for Slack — bidirectional interactive bridge via Socket Mode",
  "type": "module",
  "main": "src/server.ts",
  "bin": {
    "claude-slack-channel": "src/server.ts"
  },
  "engines": {
    "bun": ">=1.1.0"
  },
  "scripts": {
    "dev": "bun run src/server.ts",
    "test": "bun test",
    "test:coverage": "bun test --coverage",
    "typecheck": "bunx tsc --noEmit",
    "lint": "bunx biome check .",
    "lint:fix": "bunx biome check --write ."
  },
  "keywords": ["claude-code", "mcp", "slack", "channel", "mcp-server"],
  "license": "MIT"
}
```

Notable points:
- `"engines": { "bun": ">=1.1.0" }` — pins minimum Bun version; `setup-bun` GitHub Action reads this automatically
- Separate `typecheck` from `lint` — they serve different purposes and should be runnable independently
- No `"packageManager": "bun@1.3.6"` pinning unless you want to lock the exact version for contributors

### Build / Bundle Considerations

**Skip compilation — Bun runs TypeScript directly.** There is no build step needed for a CLI tool:

- `bun run src/server.ts` executes TypeScript without transpilation
- When published to npm, include `src/` directly and set `"main": "src/server.ts"` with `"bin"` pointing to the same
- Anyone using it via `npx` or npm install will need Bun installed — make this explicit in README
- If cross-runtime compatibility were needed in the future, use `bun build src/server.ts --outfile dist/server.js --target bun` — but this project doesn't need it

**Why no `tsc --build`?** Because `noEmit: true` with `allowImportingTsExtensions` is the correct Bun development mode. TypeScript here is purely a type checker, not a compiler. This is idiomatic for Bun projects.

### Lockfile Format

Bun 1.3.6 generates `bun.lockb` (binary) by default. To get a human-readable, git-diffable text lockfile:

```toml
# bunfig.toml
[install]
saveTextLockfile = true
```

This produces `bun.lock` (JSONC format, confirmed working in 1.3.6). **Recommendation: include `bunfig.toml` with text lockfile enabled and commit `bun.lock`.** This makes dependency changes reviewable in PRs.

Bun 1.2+ fully supports text lockfiles. The MCP SDK (modelcontextprotocol/typescript-sdk) uses pnpm, but for this single-package project, the text lockfile approach is clean.

---

## 2. Testing with Bun

### Test Runner Capabilities (Bun 1.3.6)

`bun:test` exports (verified by inspection):

```
test, it, xtest, xit, describe, xdescribe,
beforeEach, beforeAll, afterAll, afterEach,
onTestFinished, setDefaultTimeout,
expect, expectTypeOf, setSystemTime,
mock, jest, spyOn, vi
```

Key observations:
- `expect.toMatchSnapshot()` and `expect.toMatchInlineSnapshot()` are present
- `mock`, `spyOn`, `vi` (vitest-compat alias), and `jest` (jest-compat alias) all available
- `expectTypeOf` is available for compile-time type assertions at runtime

### Mocking External Modules

`mock.module()` is the right pattern for mocking Slack SDK dependencies:

```typescript
// src/__tests__/slack-client.test.ts
import { describe, it, expect, mock } from 'bun:test'

// Top-level await mock.module call — runs before any imports in this file
const mockStart = mock(() => Promise.resolve())
const mockOn = mock(() => {})

await mock.module('@slack/socket-mode', () => ({
  SocketModeClient: class {
    on = mockOn
    start = mockStart
  },
}))

// Now import the module under test — it will use the mock
const { createSlackClient } = await import('../slack-client')
```

**Critical scoping rule:** `mock.module()` must be called at the top level of the test file (outside `describe`/`it` blocks), and with `await`. The mock applies to all imports within that file's module scope. Each test file gets its own module registry, so mocks don't leak between files.

**For `spyOn` on object methods:**

```typescript
import { spyOn } from 'bun:test'

const obj = { post: async (url: string) => ({ ok: true }) }
const spy = spyOn(obj, 'post')
// call obj.post(...)
expect(spy).toHaveBeenCalledWith('https://...')
```

### Test Organization

**Recommendation: use collocated `src/__tests__/` as the implementation plan specifies.** This matches the project's own plan and is the most common Bun pattern for single-package projects. The alternative of top-level `test/` is better for projects with multiple packages or integration tests that live outside `src/`.

For this project, consider adding a naming convention:
- `src/__tests__/unit/` — pure logic tests (no I/O)
- `src/__tests__/integration/` — tests that would need Slack connections (skip in CI without credentials)

The simpler flat `src/__tests__/` is fine for the initial build.

### Coverage Reporting

```bash
bun test --coverage                          # text report to stdout
bun test --coverage --coverage-reporter=lcov # generates coverage/lcov.info
```

Text output format (verified):
```
-----------|---------|---------|-------------------
File       | % Funcs | % Lines | Uncovered Line #s
-----------|---------|---------|-------------------
```

**No built-in coverage threshold enforcement** — Bun does not fail the test run if coverage drops below a percentage. Options:
1. Accept this and monitor manually (simplest)
2. Parse the lcov output in CI with `lcov --fail-under-lines 90`
3. Use a coverage badge service

For an open-source project at this scale, option 1 with a documented coverage goal in CONTRIBUTING.md is reasonable.

### Snapshot Testing

Snapshots are supported. `.toMatchSnapshot()` creates `src/__tests__/__snapshots__/*.snap` files. Update with `bun test --update-snapshots`. Not needed for this project's test suite — the permission formatter and notification formatter should use explicit `expect` assertions, not snapshots, since their output format is the spec.

### Bun Test CLI Flags Relevant to CI

```bash
bun test --bail 1            # stop on first failure
bun test --pass-with-no-tests  # don't fail if no tests found (useful for CI matrix)
bun test --reporter=junit --reporter-outfile=test-results.xml  # for GitHub Actions test reporting
```

---

## 3. TypeScript Strictness and Configuration

### Recommended Strict Settings

All `strict: true` flags plus these additional explicit flags:

```jsonc
"strict": true,                        // enables: strictNullChecks, strictFunctionTypes,
                                        //   strictBindCallApply, strictPropertyInitialization,
                                        //   noImplicitAny, noImplicitThis, alwaysStrict
"noFallthroughCasesInSwitch": true,    // catches missing break/return in switch
"noUncheckedIndexedAccess": true,      // arr[0] is T | undefined, not T
"noImplicitOverride": true,            // must use 'override' keyword explicitly
"noUnusedLocals": true,                // errors on unused variables
"noUnusedParameters": true,            // errors on unused function params
```

**`verbatimModuleSyntax: true` is especially important** for an MCP server that uses `import type` patterns. It ensures type-only imports are stripped at the module boundary, which matters when Bun is resolving imports at runtime.

### Type Checking in CI

Run `bunx tsc --noEmit` as a separate CI job from tests. The implementation plan already uses `bunx tsc --noEmit` as the `lint` script — rename it to `typecheck` for clarity (lint usually implies style/linting tools).

```yaml
# In GitHub Actions
- name: Type check
  run: bunx tsc --noEmit
```

**Do not skip `skipLibCheck: false` in CI** — the project's own types are checked, and `skipLibCheck: true` only skips third-party declaration files, which is correct.

### Zod Integration Patterns

Zod v4 is now the latest (4.3.6 as of this research). The MCP SDK supports both `^3.25 || ^4.0`. Use Zod for:

1. **Environment variable validation at startup:**

```typescript
import { z } from 'zod'

const ConfigSchema = z.object({
  SLACK_CHANNEL_ID: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-'),
  SLACK_APP_TOKEN: z.string().startsWith('xapp-'),
  ALLOWED_USER_IDS: z.string().transform(s => s.split(',').filter(Boolean)),
  SERVER_NAME: z.string().default('slack'),
})

export type Config = z.infer<typeof ConfigSchema>

export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const result = ConfigSchema.safeParse(env)
  if (!result.success) {
    console.error('Invalid configuration:', result.error.flatten().fieldErrors)
    process.exit(1)
  }
  return result.data
}
```

2. **Validating MCP notification payloads** — if the `notifications/claude/channel` payload shape is not guaranteed by the SDK's TypeScript types, use Zod to validate at the boundary.

**Zod v4 vs v3 compatibility note:** The `z.object`, `z.string`, `z.infer` API is unchanged. The main v4 changes are performance improvements and error formatting. No breaking changes for this project's usage.

---

## 4. Project Quality Setup

### Linting: Biome vs ESLint

**Recommendation: Biome 2.x**

Biome 2.4.9 is current. It is a single binary that handles both formatting and linting for TypeScript/JavaScript/JSON. Reasons to prefer it for this project:

- No plugin dependency chain (ESLint + typescript-eslint + prettier = 3 separate configs)
- Runs significantly faster
- Single `biome.json` config file
- Has 450+ rules including TypeScript-specific ones
- MCP SDK itself uses ESLint + prettier (they're a larger project with more tooling investment)
- For a new single-package project, Biome's simplicity is a genuine advantage

**Representative `biome.json` for this project:**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.9/schema.json",
  "files": {
    "includes": ["src/**", "*.ts", "*.json"],
    "ignore": ["node_modules", "dist", "coverage"]
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "asNeeded"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noNonNullAssertion": "warn"
      }
    }
  },
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  }
}
```

Install: `bun add -d --exact @biomejs/biome`

The `--exact` flag pins the version, which is important since Biome has different schema versions per release.

### Pre-commit Hooks

**Recommendation: Lefthook**

Lefthook 2.1.4 is current. The MCP TypeScript SDK itself uses lefthook (they have `lefthook.yml` and `lefthook-local.example.yml`). Advantages over Husky:
- Single binary, no Node.js dependency needed during hook setup
- Runs hooks in parallel
- `lefthook-local.yml` pattern lets contributors opt in/out of local checks
- YAML config is readable

**`lefthook.yml` for this project:**

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  jobs:
    - name: typecheck
      run: bunx tsc --noEmit

    - name: lint
      run: bunx biome check --write --no-errors-on-unmatched {staged_files}
      glob: "*.{ts,json}"

pre-push:
  jobs:
    - name: test
      run: bun test
```

Install: `bun add -d lefthook` then `bunx lefthook install`

**Alternative: skip hooks entirely.** For a solo/small project where CI is the safety net, pre-commit hooks add friction without proportional benefit. The MCP SDK makes hooks optional (`lefthook-local.example.yml`) — contributors copy it to enable local checks. This is a good pattern: ship `lefthook.yml` but don't force contributors to install hooks.

### CI/CD with GitHub Actions

Bun has an official `oven-sh/setup-bun@v2` action. When `packageManager` or `engines.bun` is in `package.json`, it auto-reads the version.

**Recommended `.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        # reads engines.bun from package.json automatically

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Type check
        run: bunx tsc --noEmit

      - name: Lint
        run: bunx biome ci .

      - name: Test
        run: bun test --coverage --coverage-reporter=lcov

      - name: Upload coverage
        uses: codecov/codecov-action@v5
        if: always()
        with:
          files: ./coverage/lcov.info
```

**Notes:**
- `bun install --frozen-lockfile` — fails if lockfile is out of date, prevents silent dependency drift
- `bunx biome ci .` — stricter than `biome check`: exits non-zero on any finding, does not auto-fix
- Run typecheck and lint as separate steps to get independent failure signals in GitHub UI

---

## 5. Open Source Project Structure

### Essential Files

```
claude-slack-channel/
├── src/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── release.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── examples/
│   ├── basic-setup.md
│   └── multi-project-vm.md
├── .env.example
├── .gitignore
├── biome.json
├── bunfig.toml
├── bun.lock
├── CHANGELOG.md
├── CLAUDE.md
├── CODE_OF_CONDUCT.md    ← optional but signals seriousness
├── CONTRIBUTING.md
├── lefthook.yml
├── LICENSE
├── package.json
├── README.md
└── tsconfig.json
```

**Files the MCP SDK includes that are worth adopting:**
- `CONTRIBUTING.md` — the MCP SDK's is excellent: explains issue-first workflow, PR size guidance, what gets rejected
- `lefthook-local.example.yml` — lets contributors opt into stricter local hooks
- `.env.example` — already in the plan

**LICENSE:** MIT is correct for this project.

### Changelog Management

**Recommendation: Keep a manual CHANGELOG.md initially.** Automated changelog tools (changesets, release-it, semantic-release) add significant complexity. For a v0.x project with infrequent releases, a hand-maintained `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com) format is sufficient.

When the project stabilizes at v1.x, consider changesets — the MCP SDK uses it effectively for their monorepo.

**CHANGELOG.md structure:**

```markdown
# Changelog

## [Unreleased]

## [0.1.0] - 2026-03-XX
### Added
- Initial MCP server with Slack Socket Mode bridge
- Permission relay for remote tool approval
- Thread tracking for question/answer flows
```

### npm Publishing from Bun

`bun publish` works natively and reads `package.json` for version and files. However, since this project runs TypeScript source directly (no build step), the publish strategy is:

**Option A: Publish TypeScript source (Bun-only consumers)**
```json
{
  "files": ["src", "README.md", "LICENSE"],
  "main": "src/server.ts",
  "bin": { "claude-slack-channel": "src/server.ts" }
}
```
Consumers must have Bun installed. This is appropriate since the project is explicitly Bun-native.

**Option B: Build before publish (broader compatibility)**
Add a build step that compiles to JS: `bun build src/server.ts --outfile dist/server.js --target bun`
Then publish `dist/`. More portable but adds a build step.

**Recommendation: Option A for v0.x.** The target audience (people using MCP servers) almost certainly has Bun. Add a `prepublishOnly` script as a safety net:

```json
"prepublishOnly": "bunx tsc --noEmit && bun test"
```

**GitHub Release automation** (`.github/workflows/release.yml`):

```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx tsc --noEmit
      - run: bun test
      - run: bun publish --access public
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

### JSR (Optional)

JSR (jsr.io) is an alternative registry that natively supports TypeScript source without compilation. For a Bun project, JSR is worth considering for future distribution since it doesn't require a build step. However, npm has wider tooling support, and `bun add` works with both. Start with npm.

---

## 6. Error Handling Patterns

### Typed Error Classes vs Plain Errors

**Recommendation for this project: typed error classes for categorized failures, plain `Error` for everything else.**

This is a CLI tool that runs as a subprocess. Its error surface has three categories:

1. **Configuration errors** (startup): bad env vars, missing credentials
2. **Network errors** (runtime): Slack disconnects, MCP transport failures
3. **Logic errors** (bugs): unexpected message formats, protocol violations

```typescript
// src/errors.ts

export class ConfigurationError extends Error {
  readonly code = 'CONFIGURATION_ERROR'
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

export class SlackConnectionError extends Error {
  readonly code = 'SLACK_CONNECTION_ERROR'
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'SlackConnectionError'
  }
}
```

Keep it simple — two or three error classes max. Avoid the `Result<T, E>` pattern (neverthrow etc.) for this project: it adds cognitive overhead without proportional benefit in a single-process server that mostly propagates errors to the top level.

### Process Exit Code Conventions

```typescript
// Standard Unix conventions
process.exit(0)   // success
process.exit(1)   // generic error (most tools use this for all errors)
process.exit(2)   // misuse of CLI (wrong arguments) — less common in Node/Bun
```

**For this project:** use `process.exit(1)` for all fatal errors. The implementation plan already does this correctly (`process.exit(1)` for missing env vars).

Prefer `process.exitCode = 1` over `process.exit(1)` when you want to allow async cleanup to complete:

```typescript
process.exitCode = 1  // sets exit code but doesn't terminate immediately
// ... cleanup ...
// process exits naturally when event loop empties
```

### Graceful Shutdown in Bun

Bun supports `process.on('SIGTERM')`, `process.on('SIGINT')`, and `process.on('SIGHUP')` (verified in testing). When Claude Code spawns this server and wants to shut it down, it sends SIGTERM.

**Pattern for stdio MCP servers:**

```typescript
// In the CLI entry point (if import.meta.main)
const transport = new StdioServerTransport()
await server.connect(transport)

// Graceful shutdown
async function shutdown(signal: string) {
  console.error(`Received ${signal}, shutting down...`)
  try {
    await server.close()
  } catch {
    // ignore close errors during shutdown
  }
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Handle stdin close (parent process died)
process.stdin.on('close', () => shutdown('stdin close'))
```

The `process.stdin.on('close')` handler is important for stdio servers: if the parent process (Claude Code) dies without sending a signal, the stdin pipe closes. Listening for this prevents the server from lingering as a zombie.

**Note on `process.stdin.isTTY`:** This is `undefined` (not a TTY) when spawned as a subprocess, which is correct behavior. Do not check `isTTY` for flow control.

### Unhandled Rejection / Exception Handling

Add top-level handlers to avoid silent process crashes:

```typescript
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason)
  process.exit(1)
})
```

These belong in the CLI entry point (`if import.meta.main`), not in library code.

---

## Summary: Deviations from the Implementation Plan

| Area | Plan | Recommendation | Priority |
|---|---|---|---|
| `tsconfig.target` | `ES2022` | `ESNext` | Medium |
| `tsconfig.module` | `ESNext` | `Preserve` | High |
| `tsconfig.lib` | omitted | `["ESNext"]` | Low |
| `tsconfig.moduleDetection` | omitted | `"force"` | Low |
| `tsconfig.verbatimModuleSyntax` | omitted | `true` | High |
| `tsconfig.noEmit` | omitted | `true` | High (required with allowImportingTsExtensions) |
| `tsconfig.allowImportingTsExtensions` | omitted | `true` | Medium |
| `tsconfig.skipLibCheck` | omitted | `true` | High |
| `tsconfig.noUncheckedIndexedAccess` | omitted | `true` | Medium |
| `tsconfig.outDir` / `rootDir` | present | remove | High |
| `tsconfig.declaration` | `true` | remove | High |
| `tsconfig.types` | `["bun-types"]` | install `@types/bun`, drop `types` field | Low |
| Linting | `tsc --noEmit` as `lint` | Biome for lint/format, separate `typecheck` script | Medium |
| Lockfile | not mentioned | `bunfig.toml` + commit `bun.lock` | Medium |
| Pre-commit hooks | not mentioned | Lefthook (optional for contributors) | Low |
| CI | not mentioned | GitHub Actions with `oven-sh/setup-bun@v2` | High |
| Graceful shutdown | not mentioned | SIGTERM + stdin close handlers | High |
| Config validation | env string checks | Zod schema with `safeParse` | Medium |
| Error classes | not defined | 2–3 typed classes + `process.exitCode` pattern | Low |
