# Phase 3: Testing + CI - Research

**Researched:** 2026-03-26
**Domain:** Bun test suite completeness, GitHub Actions CI, npm provenance release
**Confidence:** HIGH

## Summary

Phase 3 starts from a strong position: the test infrastructure is already in place and 63 tests pass across all 6 source files. The `bun:test` framework is active, `bunx tsc --noEmit` exits clean, and `bunx biome check .` reports zero violations. The only remaining work is closing two coverage gaps (slack-client.ts at 30% line coverage, server.ts at 25% line coverage) and standing up GitHub Actions workflows for CI and release.

Coverage gaps are primarily in integration-heavy code paths: the `createSlackClient` closure (lines 117–171 in slack-client.ts) and the CLI entry point logic in server.ts (lines 58–258). These sections involve Slack SDK constructors and live sockets, so they are deliberately out of scope per the REQUIREMENTS.md note that integration tests against the real Slack API are excluded from v1. The pure functions tested by TEST-01 through TEST-08 are fully covered or trivially completable without mocking the SDK.

The GitHub Actions work divides cleanly into two workflows: a CI workflow (push/PR gated on typecheck + lint + test) and a release workflow (v* tag triggers npm publish with provenance and GitHub Release with auto-generated notes). Both are standard patterns with well-documented action versions as of 2026.

**Primary recommendation:** Write the two missing test gaps (createServer capability smoke test is already done; add any missing edge cases for TEST-01 through TEST-08), then create `.github/workflows/ci.yml` and `.github/workflows/release.yml` using `oven-sh/setup-bun@v2`, standard Node.js for npm publish, and `--provenance --access public` flag.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Unit tests cover `shouldProcessMessage` (channel/user/bot_id/subtype filtering) | Already implemented in `src/__tests__/slack-client.test.ts` — 7 test cases pass |
| TEST-02 | Unit tests cover `isDuplicate` (dedup logic) | Already implemented in `src/__tests__/slack-client.test.ts` — 3 test cases pass |
| TEST-03 | Unit tests cover `parsePermissionReply` (verdict parsing with edge cases) | Already implemented in `src/__tests__/permission.test.ts` — 12 test cases pass |
| TEST-04 | Unit tests cover `formatPermissionRequest` (formatting, sanitization) | Already implemented in `src/__tests__/permission.test.ts` — 3 test cases pass |
| TEST-05 | Unit tests cover `formatInboundNotification` (meta key format, threading) | Already implemented in `src/__tests__/channel-bridge.test.ts` — 4 test cases pass |
| TEST-06 | Unit tests cover `ThreadTracker` (classification, abandon, replace) | Already implemented in `src/__tests__/threads.test.ts` — 8 test cases pass |
| TEST-07 | Unit tests cover `parseConfig` (valid config, all failure modes) | Already implemented in `src/__tests__/config.test.ts` — covers all 8 failure modes |
| TEST-08 | Unit tests cover `createServer` (capability declaration) | Already implemented in `src/__tests__/server.test.ts` — covers capabilities, instructions, tool schema |
| TEST-09 | Type checking passes with `bunx tsc --noEmit` | Already passes (verified: exits 0) |
| TEST-10 | Biome linting passes with `bunx biome check .` | Already passes (verified: 0 violations, 16 files checked) |
| CICD-01 | GitHub Actions CI runs typecheck, lint, and test with coverage on push/PR | No `.github/` directory exists — needs creation |
| CICD-02 | Release workflow publishes to npm with provenance attestation on `v*` tags | No `.github/` directory exists — needs creation; requires NPM_TOKEN secret |
| CICD-03 | Release workflow creates GitHub Release with auto-generated notes | No `.github/` directory exists — needs creation; `gh release create --generate-notes` pattern |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bun:test | built-in | Test runner, spies, assertions | Already in use; zero config for Bun projects |
| oven-sh/setup-bun | v2 | Install Bun in GitHub Actions | Official action, verified by Bun team |
| actions/checkout | v4 | Checkout repo in CI | Standard; v4 supports shallow clones |
| actions/setup-node | v4 | Node.js for npm publish step | Required to configure npm registry auth |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `--coverage` flag | built-in | Line/function coverage report | CI step to report coverage |
| `--coverage-reporter=text` | built-in | Text table to CI stdout | Default for PR summaries |
| `--provenance --access public` | npm CLI flag | Publish with provenance attestation | Release workflow publish step |
| `gh release create --generate-notes` | GitHub CLI (pre-installed on Actions runners) | Auto-generate release notes from PR labels/commits | Release workflow |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `oven-sh/setup-bun@v2` (official) | `step-security/setup-bun` | step-security is a hardened drop-in; official is simpler for this project |
| `gh release create --generate-notes` | `softprops/action-gh-release` | softprops gives more control but adds a dependency; gh CLI is pre-installed |
| Trusted publishing (OIDC, no token) | NPM_TOKEN secret | OIDC requires npm CLI v11.5.1+ and trust relationship setup; NPM_TOKEN is simpler for v1 |

**Installation:**
```bash
# No new dependencies — all tools are built-in or pre-installed on GitHub Actions runners
```

## Architecture Patterns

### Recommended Project Structure
```
.github/
├── workflows/
│   ├── ci.yml         # Push/PR: typecheck + lint + test
│   └── release.yml    # v* tag: npm publish + GitHub Release
```

### Pattern 1: CI Workflow (Push + PR)
**What:** Three-job sequential check — fail fast before running tests if typecheck/lint fail.
**When to use:** Every push to any branch and every pull request.
**Example:**
```yaml
# Source: https://bun.com/docs/guides/runtime/cicd + project conventions
name: CI

on:
  push:
    branches: ["*"]
  pull_request:

jobs:
  ci:
    name: Typecheck, Lint, Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx tsc --noEmit
      - run: bunx biome check .
      - run: bun test --coverage
```

**Note:** A single job (not three separate jobs) is sufficient here. The three commands run in order and any failure stops the job. This matches the project's "coarse granularity" config setting.

### Pattern 2: Release Workflow (v* Tag)
**What:** Triggered by pushing a `v*` tag. Publishes to npm with provenance, then creates a GitHub Release with auto-generated notes.
**When to use:** Only on version tags.
**Example:**
```yaml
# Source: https://docs.github.com/actions/publishing-packages/publishing-nodejs-packages
name: Release

on:
  push:
    tags:
      - "v*"

jobs:
  release:
    name: Publish to npm + Create Release
    runs-on: ubuntu-latest
    permissions:
      contents: write      # Required for gh release create
      id-token: write      # Required for npm provenance
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v4
        with:
          node-version: "20.x"
          registry-url: "https://registry.npmjs.org"
      - run: bun install --frozen-lockfile
      - run: bunx tsc --noEmit    # Gate: don't publish broken code
      - run: bun test             # Gate: don't publish failing tests
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - name: Create GitHub Release
        run: gh release create "${{ github.ref_name }}" --generate-notes
        env:
          GH_TOKEN: ${{ github.token }}
```

**Key detail:** `npm publish` is used (not `bun publish`) because the `--provenance` flag requires the npm CLI connected to registry.npmjs.org with OIDC token exchange. Bun's publish command does not support provenance attestation.

### Pattern 3: Existing Test File Structure (already in place)
**What:** All tests live in `src/__tests__/`, one file per module, named `{module}.test.ts`.
**When to use:** Adding any new test file.
**Established pattern from codebase:**
```typescript
// Source: src/__tests__/slack-client.test.ts
import { describe, expect, it, spyOn } from 'bun:test'
import { functionUnderTest } from '../module.ts'

describe('functionUnderTest', () => {
  it('describes the expected behavior', () => {
    expect(functionUnderTest(input)).toBe(expected)
  })
})
```

### Anti-Patterns to Avoid
- **Using `bun publish` for provenance:** Bun's publish command does not support `--provenance`. Use `npm publish --provenance --access public` with `actions/setup-node@v4`.
- **Skipping `--frozen-lockfile` in CI:** Without it, `bun install` may silently update `bun.lock`, making CI non-deterministic. Always use `bun install --frozen-lockfile`.
- **Separate jobs for typecheck/lint/test in the same workflow:** Adds matrix overhead without benefit for a single-package project at this scale. One job with three sequential steps is sufficient.
- **Publishing in CI workflow:** Keep publish gated to the release workflow only. The CI workflow should never publish.
- **Accessing `_capabilities`, `_instructions`, `_requestHandlers` in new tests:** These are SDK-internal properties. Existing server.test.ts already documents this as SDK-version-dependent. Don't expand this pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage thresholds | Custom shell script to parse coverage output | `bun test --coverage` text output + CI failure on test failures | Coverage number enforcement is premature for v1; failing tests is the real gate |
| Release notes | Manually written CHANGELOG in workflow | `gh release create --generate-notes` | GitHub generates from PRs and commits automatically |
| npm token rotation | Custom secret management | `secrets.NPM_TOKEN` in GitHub repo secrets | Standard approach; team can rotate independently of code |
| Test parallelism | Custom test sharding | Default `bun test` | Bun runs test files in parallel by default; 6 files run in ~400ms |

**Key insight:** For a project with 6 fast test files (63 tests, ~400ms total), CI complexity should stay minimal. The value is in "does it pass?", not in coverage gates or parallelization.

## Common Pitfalls

### Pitfall 1: `bun.lock` vs `bun.lockb`
**What goes wrong:** This project uses `saveTextLockfile = true` in `bunfig.toml`, producing `bun.lock` (text format), not `bun.lockb` (binary). Some CI examples use `--frozen-lockfile` while others use `--no-save`. Either works, but `--frozen-lockfile` is the correct flag.
**Why it happens:** Confusion between binary lockfile (bun.lockb, Bun default before 1.2) and text lockfile (bun.lock, default in 1.2+).
**How to avoid:** Always use `bun install --frozen-lockfile` in CI. Verify locally with `bun --version` >= 1.2.0.
**Warning signs:** CI `bun install` step shows "Updated bun.lock" in output — means lockfile was modified.

### Pitfall 2: `npm publish` needs Node.js configured, not just Bun
**What goes wrong:** Running `npm publish --provenance` without `actions/setup-node@v4 with registry-url` will fail to configure `.npmrc` auth. The `NODE_AUTH_TOKEN` env var is only wired up by `setup-node`.
**Why it happens:** Bun installs don't configure npm registry credentials.
**How to avoid:** Always include `actions/setup-node@v4` with `registry-url: "https://registry.npmjs.org"` before the publish step in the release workflow.
**Warning signs:** CI error: "npm ERR! need auth This command requires you to be logged in."

### Pitfall 3: `contents: write` permission for gh release create
**What goes wrong:** `gh release create` fails with "Resource not accessible by integration" if the job doesn't have `contents: write` permission.
**Why it happens:** Default job permissions are read-only in many repo settings.
**How to avoid:** Explicitly set `permissions: contents: write` in the release job.
**Warning signs:** GitHub Actions error: "HttpError: Resource not accessible by integration".

### Pitfall 4: stderr output from config tests looks like test failures
**What goes wrong:** The `parseConfig` failure tests intentionally print error messages to stderr (e.g., "Missing or invalid environment variables."). In CI, this can look alarming in logs but is correct behavior — the test is verifying error output.
**Why it happens:** `parseConfig` calls `console.error` before `process.exit(1)`, and the spyOn mock only intercepts `process.exit`, not stderr output.
**How to avoid:** Document in the test file that stderr output during config failure tests is expected. Don't add stderr suppression — it hides real errors.
**Warning signs:** None — this is working as designed.

### Pitfall 5: `_requestHandlers` private API access in server.test.ts
**What goes wrong:** `server.test.ts` accesses `_requestHandlers` (a Map on the Server instance) to call handlers directly without connecting a transport. This is SDK-internal and may break on SDK upgrades.
**Why it happens:** `createServer` returns a Server before connecting to transport, so you can't send real MCP requests. The internal Map is the only way to test handler logic in unit tests.
**How to avoid:** Accept the pattern for now (MCP-06 requirement covers this), but keep these tests narrow (only test what's needed for TEST-08). Don't expand coverage of CLI-path code (lines 70–258) this way.
**Warning signs:** Type errors on `._requestHandlers` access after upgrading `@modelcontextprotocol/sdk`.

## Code Examples

Verified patterns from official sources and existing codebase:

### Current test run (baseline)
```
bun test v1.3.6 (d530ed99)
 63 pass
 0 fail
 93 expect() calls
Ran 63 tests across 6 files. [407.00ms]
```

### Current coverage baseline
```
-----------------------|---------|---------|-------------------
File                   | % Funcs | % Lines | Uncovered Line #s
-----------------------|---------|---------|-------------------
All files              |   77.79 |   75.94 |
 src/channel-bridge.ts |  100.00 |  100.00 |
 src/config.ts         |  100.00 |  100.00 |
 src/permission.ts     |  100.00 |  100.00 |
 src/server.ts         |   23.08 |   25.24 | 58-62,72-73,75-77,...
 src/slack-client.ts   |   63.64 |   30.38 | 117-171
 src/threads.ts        |   80.00 |  100.00 |
-----------------------|---------|---------|-------------------
```

**Coverage gap explanation:**
- `src/server.ts` lines 58–258: CLI entry point (`if (import.meta.main)`), reply tool handler with live Slack web client, shutdown handlers. These require live Slack credentials and are explicitly excluded from v1 testing scope.
- `src/slack-client.ts` lines 117–171: `createSlackClient` closure body (SocketModeClient constructor, event listener with ack). Requires mocking Slack SDK constructors — acceptable low-priority gap for v1.

### spyOn pattern for process.exit (already established)
```typescript
// Source: src/__tests__/config.test.ts
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'

let exitSpy: ReturnType<typeof spyOn>
beforeEach(() => {
  exitSpy = spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called')
  }) as never)
})
afterEach(() => {
  exitSpy.mockRestore()
})
```

### bun:test import pattern (project standard)
```typescript
// Source: all existing test files in src/__tests__/
import { describe, expect, it } from 'bun:test'             // basic
import { beforeEach, describe, expect, it } from 'bun:test' // with lifecycle
import { describe, expect, it, spyOn } from 'bun:test'      // with spies
```

### Biome import ordering (project gotcha — from Phase 2 decisions)
```typescript
// CORRECT: type imports before value imports within same module path
import type { MessageClassification } from '../threads.ts'
import { ThreadTracker } from '../threads.ts'

// WRONG: value import before type import — Biome organizeImports will fail
import { ThreadTracker } from '../threads.ts'
import type { MessageClassification } from '../threads.ts'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Binary lockfile `bun.lockb` | Text lockfile `bun.lock` | Bun 1.2.0 | `saveTextLockfile = true` in bunfig.toml; already configured |
| `npm publish` without provenance | `npm publish --provenance --access public` | npm 9.5+ (2023) | Required for CICD-02; needs `id-token: write` permission |
| `actions/create-release` (deprecated) | `gh release create --generate-notes` | 2022 | Pre-installed gh CLI is simpler than third-party action |
| `oven-sh/setup-bun@v1` | `oven-sh/setup-bun@v2` | 2024 | v2 is current; v1 still works but use v2 |

**Deprecated/outdated:**
- `actions/create-release`: Deprecated by GitHub. Use `gh release create` instead.
- `bun install` without `--frozen-lockfile` in CI: Works but non-deterministic. Always use `--frozen-lockfile`.

## Open Questions

1. **NPM_TOKEN secret setup**
   - What we know: The release workflow needs `secrets.NPM_TOKEN` to be set in the GitHub repo settings.
   - What's unclear: Whether the token already exists or needs to be created/documented.
   - Recommendation: Document in CICD-02 plan task that the operator must create an npm automation token and add it as `NPM_TOKEN` in GitHub → Settings → Secrets. The workflow file itself is sufficient; secret setup is operator responsibility.

2. **Coverage threshold enforcement**
   - What we know: `bun test --coverage` prints a text table but does not fail the job based on thresholds by default. Thresholds can be configured in bunfig.toml.
   - What's unclear: Whether CICD-01 requires a numeric threshold gate or just "coverage reported."
   - Recommendation: Per REQUIREMENTS.md, CICD-01 says "runs typecheck, lint, and test with coverage." This means coverage must be *reported*, not gated. No threshold configuration needed for v1.

3. **`bun test` exit code behavior on zero tests**
   - What we know: All 6 test files exist and 63 tests pass. This is not a risk.
   - What's unclear: N/A.
   - Recommendation: Non-issue for this project.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun:test (built-in, Bun v1.3.6) |
| Config file | `bunfig.toml` (minimal — only `saveTextLockfile`) |
| Quick run command | `bun test` |
| Full suite command | `bun test --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | `shouldProcessMessage` filtering | unit | `bun test src/__tests__/slack-client.test.ts` | YES |
| TEST-02 | `isDuplicate` dedup | unit | `bun test src/__tests__/slack-client.test.ts` | YES |
| TEST-03 | `parsePermissionReply` parsing | unit | `bun test src/__tests__/permission.test.ts` | YES |
| TEST-04 | `formatPermissionRequest` formatting | unit | `bun test src/__tests__/permission.test.ts` | YES |
| TEST-05 | `formatInboundNotification` meta keys | unit | `bun test src/__tests__/channel-bridge.test.ts` | YES |
| TEST-06 | `ThreadTracker` state machine | unit | `bun test src/__tests__/threads.test.ts` | YES |
| TEST-07 | `parseConfig` valid + failure modes | unit | `bun test src/__tests__/config.test.ts` | YES |
| TEST-08 | `createServer` capabilities | unit | `bun test src/__tests__/server.test.ts` | YES |
| TEST-09 | Type checking passes | static | `bunx tsc --noEmit` | N/A (no file) |
| TEST-10 | Biome lint passes | static | `bunx biome check .` | N/A (no file) |
| CICD-01 | CI workflow triggers on push/PR | integration | GitHub Actions (can't run locally) | NO — Wave 0 |
| CICD-02 | Release workflow publishes to npm | integration | GitHub Actions (requires secrets) | NO — Wave 0 |
| CICD-03 | GitHub Release created on v* tag | integration | GitHub Actions (requires secrets) | NO — Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test`
- **Per wave merge:** `bun test --coverage && bunx tsc --noEmit && bunx biome check .`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `.github/workflows/ci.yml` — covers CICD-01
- [ ] `.github/workflows/release.yml` — covers CICD-02, CICD-03

*(All test files already exist. No test framework installation needed. Only CI workflow files are missing.)*

## Sources

### Primary (HIGH confidence)
- `bun test` official docs (https://bun.com/docs/test) — coverage flags, bunfig.toml options
- `bun.com/docs/guides/runtime/cicd` — `oven-sh/setup-bun@v2` workflow pattern
- Live test run on this project — 63 tests passing, coverage baseline confirmed
- `bunx tsc --noEmit` on this project — exits 0, confirmed
- `bunx biome check .` on this project — 0 violations, 16 files, confirmed

### Secondary (MEDIUM confidence)
- GitHub Docs (https://docs.github.com/actions/publishing-packages/publishing-nodejs-packages) — `--provenance` flag, `id-token: write` permission, `NODE_AUTH_TOKEN` pattern
- GitHub Changelog (https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/) — trusted publishing generally available; NPM_TOKEN approach still valid
- WebSearch for `gh release create --generate-notes` pattern — multiple consistent sources confirm this is current standard approach

### Tertiary (LOW confidence)
- npm trusted publishing (OIDC, no long-lived token): WebSearch only; GA as of 2025 but requires npm CLI v11.5.1+ — flagged as alternative, not recommended for v1

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against live Bun runtime and official action versions
- Architecture (workflow YAML): HIGH — standard patterns from official GitHub Docs + bun.com
- Test completeness (TEST-01 to TEST-10): HIGH — source files read and tests confirmed passing
- Pitfalls: HIGH — three pitfalls confirmed against project-specific decisions (bunfig.toml, biome organizeImports, SDK internals)
- npm provenance: MEDIUM — flag works, permissions documented, but untested against this specific repo

**Research date:** 2026-03-26
**Valid until:** 2026-06-26 (stable — Bun CI patterns and npm provenance are mature)
