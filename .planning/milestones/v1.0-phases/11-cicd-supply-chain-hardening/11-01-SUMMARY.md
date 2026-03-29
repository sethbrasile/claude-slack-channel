---
phase: 11-cicd-supply-chain-hardening
plan: 01
subsystem: infra
tags: [github-actions, dependabot, supply-chain, ci-cd, npm-provenance]

requires:
  - phase: 04-package-documentation
    provides: npm publish workflow (release.yml) and initial CI setup

provides:
  - SHA-pinned GitHub Actions in ci.yml and release.yml (H3)
  - bun audit step in release workflow (M7)
  - bunx biome check . step in release workflow (M6)
  - registry-url on setup-node for OIDC npm provenance auth (M8)
  - Top-level deny-all permissions block in release.yml (M9)
  - Dependabot groups and labels for npm and github-actions ecosystems (L12)

affects: [any future workflow modifications, dependabot configuration changes]

tech-stack:
  added: []
  patterns:
    - SHA pinning pattern: actions referenced by full commit SHA + version comment
    - Deny-all permissions: workflow-level permissions: {} with explicit per-job grants
    - Quality gates before typecheck: audit → lint → typecheck → test in release pipeline

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - .github/workflows/release.yml
    - .github/dependabot.yml

key-decisions:
  - "SHA pins use full 40-char commit hashes with version comments — eliminates mutable tag attack vector"
  - "Workflow-level permissions: {} deny-all with per-job overrides — principle of least privilege"
  - "registry-url required on setup-node for npm OIDC auth even in Bun projects (already known from Phase 03)"
  - "bun audit placed before biome/tsc/test — fail fast on known vulnerabilities before spending CI time on quality checks"
  - "Dependabot groups cluster all updates per ecosystem into single PR — appropriate for single-maintainer project"
  - "npm and github-actions labels are forward-looking; GitHub does not auto-create them but Dependabot silently falls back to defaults if absent"

patterns-established:
  - "SHA-pin pattern: uses: action@{full-sha}  # vX.Y.Z"
  - "Release step order: install → audit → lint → typecheck → test → publish"

requirements-completed: [H3, M6, M7, M8, M9, L12]

duration: 5min
completed: 2026-03-28
---

# Phase 11 Plan 01: CI/CD Supply Chain Hardening Summary

**SHA-pinned GitHub Actions supply chain with deny-all permissions, bun audit + biome quality gates in release, registry-url for OIDC provenance, and Dependabot grouping for npm + github-actions ecosystems**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-28T19:03:00Z
- **Completed:** 2026-03-28T19:04:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Eliminated mutable-tag supply chain attack vector by pinning all three actions (checkout, setup-bun, setup-node) to full 40-char commit SHAs in both workflow files
- Hardened release.yml with top-level `permissions: {}` deny-all block and added missing quality gates (`bun audit`, `bunx biome check .`) before typecheck
- Added `registry-url` to setup-node step to enable OIDC npm provenance auth; configured Dependabot groups and labels for single-PR-per-cycle update batching

## Task Commits

1. **Task 1: SHA-pin actions and harden release.yml permissions + registry-url** - `0f2262c` (chore)
2. **Task 2: Add groups and labels to Dependabot config** - `a767a8c` (chore)

## Files Created/Modified

- `.github/workflows/ci.yml` - SHA-pinned actions/checkout and oven-sh/setup-bun; corrected stale version comments
- `.github/workflows/release.yml` - SHA-pinned all three actions; added top-level `permissions: {}`; added `registry-url`; added `bun audit` and `bunx biome check .` quality gates
- `.github/dependabot.yml` - Added `labels:` and `groups:` entries for both npm and github-actions ecosystems

## Decisions Made

- **SHA pinning strategy:** Full 40-char commit hashes with version comment (`# vX.Y.Z`) — human-readable but immutable, prevents force-push tag attacks
- **Deny-all permissions:** `permissions: {}` at workflow level with explicit `contents: write` + `id-token: write` at the release job level — least-privilege principle
- **Quality gate ordering:** `bun audit` placed immediately after `bun install --frozen-lockfile` (before lint/typecheck/test) so known vulnerabilities fail fast before wasting CI time on further checks
- **Dependabot groups:** Single group per ecosystem (`npm-all`, `actions-all`) with `patterns: ["*"]` clusters all updates into one PR per cycle — lower noise for a single-maintainer project

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Note: the `npm` and `github-actions` Dependabot labels may need to be created manually in the GitHub repo UI if label-based filtering is desired. GitHub creates `dependencies` by default but not the ecosystem-specific labels. Dependabot will silently fall back to its default label if the configured ones are absent.

## Next Phase Readiness

All six supply chain hardening requirements (H3, M6, M7, M8, M9, L12) from the deep review are now closed. The release pipeline is hardened and ready for the next v0.x release. No blockers.

---
*Phase: 11-cicd-supply-chain-hardening*
*Completed: 2026-03-28*
