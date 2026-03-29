---
phase: 03-testing-ci
plan: 02
subsystem: infra
tags: [github-actions, ci, bun, biome, npm, release, provenance]

requires:
  - phase: 03-testing-ci
    provides: "Unit test suite (64 tests) that CI workflow runs"
provides:
  - "CI workflow: push/PR triggered, typecheck + lint + test with coverage"
  - "Release workflow: v* tag triggered, npm publish --provenance + GitHub Release"
affects: [future-releases, contributors]

tech-stack:
  added: [github-actions, oven-sh/setup-bun@v2, actions/setup-node@v4]
  patterns:
    - "Single-job CI: sequential steps (typecheck → lint → test) in one job, not parallel jobs"
    - "npm publish for provenance support (not bun publish)"
    - "actions/setup-node@v4 with registry-url required for npm auth even in Bun projects"

key-files:
  created:
    - .github/workflows/ci.yml
    - .github/workflows/release.yml
  modified: []

key-decisions:
  - "Single CI job with sequential steps per research: simpler, no cross-job artifact passing needed"
  - "npm publish --provenance instead of bun publish: bun publish lacks --provenance flag"
  - "actions/setup-node@v4 with registry-url: required to configure .npmrc for npm auth; omitting causes npm ERR! need auth"
  - "contents: write + id-token: write permissions: required for gh release create and OIDC provenance attestation"
  - "bun install --frozen-lockfile: prevents lockfile drift in CI (not plain bun install)"

patterns-established:
  - "CI gate order: typecheck first (fail fast), then lint, then tests — catches cheap errors before running full suite"
  - "Release gate: typecheck + test before publish — don't publish broken code to npm"

requirements-completed: [CICD-01, CICD-02, CICD-03]

duration: 1min
completed: 2026-03-27
---

# Phase 3 Plan 02: CI and Release Workflow Summary

**GitHub Actions CI/CD: push/PR-triggered typecheck+lint+test workflow and v*-tag release workflow with npm provenance attestation and auto GitHub Release notes.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-27T03:07:04Z
- **Completed:** 2026-03-27T03:07:55Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 2

## Accomplishments
- `.github/workflows/ci.yml` — triggers on any push or PR, single job running tsc + biome + bun test --coverage
- `.github/workflows/release.yml` — triggers on v* tags, gates on typecheck+tests, publishes to npm with provenance attestation, creates GitHub Release with auto-generated notes
- Local pre-push suite confirmed clean: 64 tests pass, TSC clean, Biome clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CI workflow (CICD-01)** - `2c1ca6d` (feat)
2. **Task 2: Create release workflow (CICD-02, CICD-03)** - `251911a` (feat)
3. **Task 3: Verify CI triggers on GitHub** - Auto-approved (checkpoint:human-verify, auto-chain active)

## Files Created/Modified
- `.github/workflows/ci.yml` — Push/PR triggered CI: checkout → setup-bun → bun install --frozen-lockfile → tsc → biome → bun test --coverage
- `.github/workflows/release.yml` — v* tag release: checkout → setup-bun → setup-node (npm auth) → install → typecheck → test → npm publish --provenance → gh release create --generate-notes

## Decisions Made
- Used `npm publish --provenance` instead of `bun publish` — bun publish does not support the `--provenance` flag needed for supply chain attestation
- Included `actions/setup-node@v4` with `registry-url: "https://registry.npmjs.org"` — this is required to write `.npmrc` with npm auth token, even in a Bun project; omitting it causes "npm ERR! need auth"
- Declared explicit `permissions: contents: write` (for `gh release create`) and `id-token: write` (for OIDC provenance) — both silently fail without explicit permission grants
- Single job with sequential steps (not parallel jobs) — reduces complexity and eliminates artifact-passing overhead for a repo this size

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration before releasing:**

### NPM Token

To publish to npm, add `NPM_TOKEN` as a GitHub repository secret:
1. Go to [npmjs.com](https://www.npmjs.com) → Account → Access Tokens → Generate New Token → **Automation** type
2. Go to GitHub repo → Settings → Secrets and variables → Actions → New repository secret
3. Name: `NPM_TOKEN`, Value: the token from step 1

The CI workflow does not require any secrets. The release workflow requires `NPM_TOKEN` only when pushing a `v*` tag.

### Verification (when ready to release)
```bash
git tag v0.1.0
git push origin v0.1.0
```
This triggers the release workflow. Confirm on GitHub → Actions tab.

## Next Phase Readiness
- CI/CD pipeline complete — all three enforcement gates (typecheck, lint, test) automated
- Phase 3 (testing-ci) fully complete: unit tests (03-01) + CI/CD (03-02)
- Ready for Phase 4 (documentation / release prep) or direct npm publish with `v0.1.0` tag

---
*Phase: 03-testing-ci*
*Completed: 2026-03-27*
