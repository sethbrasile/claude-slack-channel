# Phase 11: CI/CD Supply Chain Hardening - Research

**Researched:** 2026-03-28
**Domain:** GitHub Actions security hardening, Dependabot configuration, logger scrubbing
**Confidence:** HIGH

## Summary

This phase addresses Grouping 3 from the deep review: seven instance-level fixes to the CI/CD
pipeline and one source-code fix. The changes are mechanical — pin three action tags to their
immutable commit SHAs, add two missing quality-gate steps to the release workflow, add a
deny-all permissions default, add `registry-url` to the setup-node step, extend
`safeErrorMessage` to cover all four logger levels, and add groups/labels to the Dependabot
config.

The phase has no architectural decisions. Every change has a single correct answer derived
from the deep review finding and the current state of the workflow files. The only research
needed was to look up the canonical commit SHAs for the pinned actions and to verify the
correct Dependabot syntax for groups and labels.

**Primary recommendation:** Treat this as a checklist of seven targeted edits. The SHA lookup
is the only research output the planner needs — all other changes are direct edits to four
files: `ci.yml`, `release.yml`, `dependabot.yml`, and `src/slack-client.ts`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| H3 | GitHub Actions pinned to mutable tags, not immutable SHAs | SHA values resolved below; three actions in ci.yml and release.yml need pinning |
| M6 | Release workflow missing biome lint step | Direct edit: add `bunx biome check .` before typecheck in release.yml |
| M7 | Release workflow missing `bun audit` | Direct edit: add `bun audit` after `bun install --frozen-lockfile` in release.yml |
| M8 | `actions/setup-node` missing `registry-url` for OIDC publish | Direct edit: add `registry-url: 'https://registry.npmjs.org'` to setup-node step |
| M9 | No deny-all permissions default in release workflow | Direct edit: add top-level `permissions: {}` above `jobs:` in release.yml |
| M15 | Logger scrubbing only covers `error` level | Extend `createStderrLogger` in `src/slack-client.ts` to wrap all four levels |
| L12 | Dependabot missing groups and labels config | Add `groups:` and `labels:` to both ecosystems in `dependabot.yml` |
</phase_requirements>

---

## Standard Stack

### Actions in Use (current workflow files)

| Action | Tag Used | Canonical SHA | Version Comment |
|--------|----------|---------------|-----------------|
| `actions/checkout` | `v6.0.2` | `de0fac2e4500dabe0009e67214ff5f5447ce83dd` | `# v6.0.2` |
| `oven-sh/setup-bun` | `v2.2.0` | `0c5077e51419868618aeaa5fe8019c62421857d6` | `# v2.2.0` |
| `actions/setup-node` | `v6.3.0` | `53b83947a5a98c8d113130e565377fae1a50d02f` | `# v6.3.0` |

**Confidence:** HIGH — SHAs fetched directly from each action's GitHub release page on 2026-03-28.

**Important:** The existing comments in ci.yml (`# v4.2.2`, `# v2.0.3`) are stale leftovers from
earlier versions and are WRONG. The version comments should match the tag being pinned:
`# v6.0.2`, `# v2.2.0`, `# v6.3.0`.

### Where Each Action Appears

- `actions/checkout`: ci.yml line 13, release.yml line 16
- `oven-sh/setup-bun`: ci.yml line 14, release.yml line 26
- `actions/setup-node`: release.yml line 27 only (not in ci.yml)

---

## Architecture Patterns

### SHA Pinning Pattern (H3)

The correct form is:

```yaml
- uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd  # v6.0.2
```

Full SHA replaces the mutable tag; human-readable version goes in the comment. This is the
standard StepSecurity / GitHub hardening guide pattern. The comment is not parsed — it exists
only for maintainers and Dependabot (Dependabot reads the comment when configured to update
pinned SHAs via `github-actions` ecosystem).

**Why this matters for this repo:** The release workflow has `id-token: write` (needed for
OIDC npm provenance). A force-pushed action tag could exfiltrate the OIDC token and publish
a backdoored package. SHA pinning eliminates this attack vector.

### Release Workflow Step Order (M6, M7)

Current order:
1. checkout
2. validate tag matches package.json version
3. setup-bun
4. setup-node
5. `bun install --frozen-lockfile`
6. `bunx tsc --noEmit`
7. `bun test --coverage`
8. `npm publish --provenance --access public`
9. Create GitHub Release

Target order after fixes:
1. checkout
2. validate tag matches package.json version
3. setup-bun
4. setup-node (with `registry-url` added — M8)
5. `bun install --frozen-lockfile`
6. **`bun audit`** (M7 — fail fast on known vulnerabilities before doing any work)
7. **`bunx biome check .`** (M6 — lint check before typecheck)
8. `bunx tsc --noEmit`
9. `bun test --coverage`
10. `npm publish --provenance --access public`
11. Create GitHub Release

Rationale for ordering: `bun audit` runs immediately after install (cheapest check first).
Biome runs before tsc (lint errors are faster to report than type errors). Tests run last
before publish.

### Permissions Pattern (M9)

The release workflow currently has per-job permissions (`contents: write`, `id-token: write`)
but no workflow-level deny-all. The fix adds `permissions: {}` at the workflow level, above
`jobs:`. This means any future job added without explicit permissions gets no access by
default rather than the broad GitHub Actions defaults.

```yaml
# After fix — layout in release.yml:
on:
  push:
    tags:
      - "v*"

permissions: {}   # deny all at workflow level

jobs:
  release:
    permissions:
      contents: write    # for gh release create
      id-token: write    # for npm provenance OIDC
```

The existing per-job block stays unchanged — it's already correct. The workflow-level block
is purely additive.

### setup-node registry-url (M8)

```yaml
- uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f  # v6.3.0
  with:
    node-version: "24.x"
    registry-url: 'https://registry.npmjs.org'
```

This is the pattern documented in the npm trusted-publishing memory file and confirmed in
Phase 3 decisions: `actions/setup-node` must have `registry-url` set for OIDC token exchange
to work. The existing install already works, but this closes the gap identified in M8.

### Logger Scrubbing Extension (M15)

Current `createStderrLogger` in `src/slack-client.ts` lines 80-90:

```typescript
// CURRENT (scrubs only error level)
error: (...msgs: unknown[]) => console.error('[slack:error]', ...msgs.map(safeErrorMessage)),
```

Target (all four levels scrubbed):

```typescript
// TARGET
debug: (...msgs: unknown[]) => console.error('[slack:debug]', ...msgs.map(safeErrorMessage)),
info:  (...msgs: unknown[]) => console.error('[slack:info]',  ...msgs.map(safeErrorMessage)),
warn:  (...msgs: unknown[]) => console.error('[slack:warn]',  ...msgs.map(safeErrorMessage)),
error: (...msgs: unknown[]) => console.error('[slack:error]', ...msgs.map(safeErrorMessage)),
```

`safeErrorMessage` signature is `(err: unknown): string` — it already handles `unknown` input
(non-Error values pass through as string). Wrapping all four levels is safe; there is no
type mismatch.

### Dependabot Groups and Labels (L12)

Dependabot's `groups` key clusters dependency updates into a single PR per ecosystem.
`labels` replaces the default label set (Dependabot adds `dependencies` by default; specifying
`labels` overrides this).

Target `dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    labels: ["dependencies", "npm"]
    groups:
      npm-all:
        patterns: ["*"]

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    labels: ["dependencies", "github-actions"]
    groups:
      actions-all:
        patterns: ["*"]
```

The `groups` with `patterns: ["*"]` consolidates all updates of an ecosystem into one PR per
update cycle. For a small single-maintainer project this is the right default — fewer PRs to
review. Labels `["dependencies", "npm"]` and `["dependencies", "github-actions"]` give clear
filtering by ecosystem.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding action SHAs | Custom tooling | Read from GitHub releases page directly | One-time lookup; Dependabot will maintain from here |
| Token scrubbing | New regex | Existing `safeErrorMessage` from `config.ts` | Already tested, covers xoxb-/xoxp-/xapp-/xoxa- patterns |
| Grouping Dependabot PRs | Manual triage | `groups:` key in dependabot.yml | Native Dependabot feature, GA since 2023 |

---

## Common Pitfalls

### Pitfall 1: Wrong SHA in SHA Pinning
**What goes wrong:** Copying SHA from a different version or typo in the long hash.
**Why it happens:** All 40-char hashes look similar.
**How to avoid:** Cross-reference the SHA against the tag's GitHub release page. The release
page shows the shortened SHA (first 7 chars) alongside the full hash — verify the first 7
match.
**Warning signs:** GitHub Actions runner logs `Unable to resolve action` at job start.

Verified values for this project:
- `actions/checkout@v6.0.2` → SHA starts with `de0fac2`
- `oven-sh/setup-bun@v2.2.0` → SHA starts with `0c5077e`
- `actions/setup-node@v6.3.0` → SHA starts with `53b8394`

### Pitfall 2: Stale Version Comments
**What goes wrong:** Comments say `# v4.2.2` but the actual tag being pinned is v6.0.2.
**Why it happens:** Comments were not updated when the action was upgraded.
**How to avoid:** When writing the SHA-pinned line, write the comment fresh from the current
version tag, not from any existing comment in the file.

### Pitfall 3: safeErrorMessage Return Type Mismatch
**What goes wrong:** Calling `.map(safeErrorMessage)` on a `unknown[]` array.
**Why it happens:** TypeScript may complain if the function signature is too narrow.
**How to avoid:** `safeErrorMessage` is typed `(err: unknown): string` — it accepts `unknown`
explicitly. `.map()` on `unknown[]` with this function produces `string[]`, which spread into
`console.error` is valid. No type change needed.

### Pitfall 4: Dependabot labels Must Exist in the Repo
**What goes wrong:** Dependabot creates PRs but the specified labels don't exist in the
GitHub repo, causing PR creation to fail silently or use default labels.
**Why it happens:** Dependabot applies labels but doesn't create them.
**How to avoid:** Ensure the labels `dependencies`, `npm`, and `github-actions` exist in the
repo before the next Dependabot run. These are common enough that GitHub likely created them
already, but it's worth noting.

---

## Code Examples

### ci.yml After SHA Pinning

```yaml
name: CI

on:
  push:
    branches: ["main"]
  pull_request:

jobs:
  ci:
    name: Typecheck, Lint, Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd  # v6.0.2
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6   # v2.2.0
      - run: bun install --frozen-lockfile
      - run: bunx tsc --noEmit
      - run: bunx biome check .
      - run: bun test --coverage
      - run: bun audit
```

### release.yml After All Fixes

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

permissions: {}

jobs:
  release:
    name: Publish to npm + Create Release
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd  # v6.0.2
      - name: Validate tag matches package.json version
        run: |
          PKG_VERSION=$(node -e "const p=require('./package.json'); console.log(p.version)")
          TAG_NAME="${{ github.ref_name }}"
          if [ "v${PKG_VERSION}" != "${TAG_NAME}" ]; then
            echo "ERROR: Tag ${TAG_NAME} does not match package.json version v${PKG_VERSION}"
            exit 1
          fi
          echo "Version check passed: ${TAG_NAME} matches package.json v${PKG_VERSION}"
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6   # v2.2.0
      - uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f   # v6.3.0
        with:
          node-version: "24.x"
          registry-url: 'https://registry.npmjs.org'
      - run: bun install --frozen-lockfile
      - run: bun audit
      - run: bunx biome check .
      - run: bunx tsc --noEmit
      - run: bun test --coverage
      - run: npm publish --provenance --access public
      - name: Create GitHub Release
        run: gh release create "${{ github.ref_name }}" --generate-notes
        env:
          GH_TOKEN: ${{ github.token }}
```

### createStderrLogger After M15 Fix

```typescript
// Source: src/slack-client.ts lines 80-90
export function createStderrLogger(): Logger {
  return {
    debug: (...msgs: unknown[]) => console.error('[slack:debug]', ...msgs.map(safeErrorMessage)),
    info:  (...msgs: unknown[]) => console.error('[slack:info]',  ...msgs.map(safeErrorMessage)),
    warn:  (...msgs: unknown[]) => console.error('[slack:warn]',  ...msgs.map(safeErrorMessage)),
    error: (...msgs: unknown[]) => console.error('[slack:error]', ...msgs.map(safeErrorMessage)),
    setLevel: (_level: LogLevel) => {},
    setName: (_name: string) => {},
    getLevel: () => LogLevel.INFO,
  }
}
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | none — `bun test` discovers `src/__tests__/*.test.ts` automatically |
| Quick run command | `bun test src/__tests__/slack-client.test.ts` |
| Full suite command | `bun test --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| H3 | SHA pinning in YAML files | Manual / CI verification | `cat .github/workflows/ci.yml \| grep '@'` | N/A — workflow file edit |
| M6 | Biome step present in release.yml | Manual / CI smoke | `cat .github/workflows/release.yml \| grep biome` | N/A — workflow file edit |
| M7 | bun audit step present in release.yml | Manual / CI smoke | `cat .github/workflows/release.yml \| grep audit` | N/A — workflow file edit |
| M8 | registry-url present in setup-node | Manual / CI smoke | `cat .github/workflows/release.yml \| grep registry-url` | N/A — workflow file edit |
| M9 | Top-level permissions: {} present | Manual / CI smoke | `cat .github/workflows/release.yml \| grep 'permissions: {}'` | N/A — workflow file edit |
| M15 | safeErrorMessage applied to all logger levels | unit | `bun test src/__tests__/slack-client.test.ts` | ✅ exists (add test case) |
| L12 | Dependabot groups/labels present | Manual / file check | `cat .github/dependabot.yml \| grep groups` | N/A — config file edit |

### Sampling Rate
- **Per task commit:** `bun test src/__tests__/slack-client.test.ts`
- **Per wave merge:** `bun test --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

One test gap: the existing `src/__tests__/slack-client.test.ts` does not test
`createStderrLogger`. The M15 fix should be accompanied by a test asserting that `debug`,
`info`, and `warn` levels also scrub tokens. This is a new test case in an existing file —
no new files needed.

- [ ] Add test case in `src/__tests__/slack-client.test.ts` for `createStderrLogger` scrubbing
  all four levels — covers M15 fix verification.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pin to version tags (`@v4`) | Pin to full commit SHAs + comment | Security best practice since 2021 | Eliminates supply chain attack via force-pushed tags |
| Broad workflow permissions | Deny-all at workflow + per-job grants | GitHub Actions hardening guide 2022+ | Principle of least privilege |
| npm ecosystems only in Dependabot | Dependabot groups + labels | Dependabot groups GA'd 2023 | Reduces PR noise, improves filtering |

---

## Open Questions

1. **Do the labels `npm` and `github-actions` already exist in the repo?**
   - What we know: These are common labels but are not auto-created.
   - What's unclear: Whether the GitHub repo currently has them.
   - Recommendation: The planner should include a task step to create labels if missing, or
     use only `dependencies` (which GitHub creates by default) as the safe fallback.

2. **Does `bun audit` exit non-zero on vulnerabilities?**
   - What we know: `bun audit` is documented and functional. The CI workflow already uses it.
   - What's unclear: Default exit behavior on found vulnerabilities (some audit tools exit 0
     unless `--audit-level` is set).
   - Recommendation: Since `bun audit` already runs in CI without special flags and the CI
     is green, the same invocation in release.yml should be consistent. No flag changes needed.

---

## Sources

### Primary (HIGH confidence)
- GitHub release page: `actions/checkout` v6.0.2 — SHA `de0fac2e4500dabe0009e67214ff5f5447ce83dd`
- GitHub release page: `oven-sh/setup-bun` v2.2.0 — SHA `0c5077e51419868618aeaa5fe8019c62421857d6`
- GitHub release page: `actions/setup-node` v6.3.0 — SHA `53b83947a5a98c8d113130e565377fae1a50d02f`
- `docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference` — groups and labels syntax
- `src/slack-client.ts` lines 80-90 — current logger implementation, confirms only `error` scrubbed

### Secondary (MEDIUM confidence)
- `bun.com/docs/pm/cli/audit` — confirms `bun audit` is available and functional
- StepSecurity blog on SHA pinning — confirms standard pattern (SHA + version comment)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SHAs fetched directly from GitHub release pages
- Architecture: HIGH — all fixes are instance-level with no design decisions
- Pitfalls: HIGH — derived from reading the actual source files and workflow configs

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (SHAs are immutable; only the "latest version" guidance could change)
