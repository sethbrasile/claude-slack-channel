---
round: 1
started: 2026-03-28
source_review: .planning/reviews/2026-03-28-deep-review.md
---

## Findings

### Round 1 (2026-03-28)

**Review verdict: SHIP IT — 0 blocking findings. User override: act on all findings.**

| ID | Source | Severity | Area | Description | Phase |
|----|--------|----------|------|-------------|-------|
| QC-1-01 | deep-review | high | Architecture | Interactive button handler race condition on double-click | 10 |
| QC-1-02 | deep-review | high | Architecture | Reply handler body duplicated between library and CLI paths | 9 |
| QC-1-03 | deep-review | high | DevOps | GitHub Actions pinned to mutable tags, not SHAs | 11 |
| QC-1-04 | deep-review | high | UX/Docs | Version pin missing in all example .mcp.json snippets | 12 |
| QC-1-05 | deep-review | high | UX/Docs | Claude Code version requirement buried at Step 7 | 12 |
| QC-1-06 | deep-review | medium | Architecture | Interactive handler not drained on shutdown | 10 |
| QC-1-07 | deep-review | medium | Architecture | PermissionRequestSchema handler not registered in library path | 9 |
| QC-1-08 | deep-review | medium | Architecture | PermissionRequestSchema defined inline in CLI block | 9 |
| QC-1-09 | deep-review | medium | Architecture | classifyMessage empty string edge case | 14 |
| QC-1-10 | deep-review | medium | Architecture/Security | Interactive payload parsed with manual casts, no Zod validation | 10 |
| QC-1-11 | deep-review | medium | DevOps | Release workflow missing biome lint step | 11 |
| QC-1-12 | deep-review | medium | DevOps | Release workflow missing bun audit | 11 |
| QC-1-13 | deep-review | medium | DevOps | setup-node missing registry-url for OIDC publish | 11 |
| QC-1-14 | deep-review | medium | DevOps | No deny-all permissions default in release workflow | 11 |
| QC-1-15 | deep-review | medium | Testing | SDK private property access fragile in tests | 14 |
| QC-1-16 | deep-review | medium | Testing | No test for chat.postMessage ok:false error path | 14 |
| QC-1-17 | deep-review | medium | Testing | TTL dedup logic inside createSlackClient untested | 14 |
| QC-1-18 | deep-review | medium | Testing | Interactive handler zero test coverage | 10 |
| QC-1-19 | deep-review | medium | Testing | CLI-path onMessage and permission handlers untested | 9 |
| QC-1-20 | deep-review | medium | Security | Logger scrubbing only covers error level | 11 |
| QC-1-21 | deep-review | medium | UX/Docs | Slack admin permissions not noted before Step 1 | 12 |
| QC-1-22 | deep-review | medium | UX/Docs | Manifest vs README contradiction on connections:write | 12 |
| QC-1-23 | deep-review | medium | UX/Docs | Channel ID URL format not shown in README | 12 |
| QC-1-24 | deep-review | medium | UX/Docs | W-prefix user IDs not documented in README | 12 |
| QC-1-25 | deep-review | medium | UX/Docs | Bot name placeholder mismatch | 12 |
| QC-1-26 | deep-review | medium | UX/Docs | Audit step wording confusing | 12 |
| QC-1-27 | deep-review | medium | UX/Docs | Placeholder syntax inconsistent | 13 |
| QC-1-28 | deep-review | medium | Content | Jargon in opening paragraph | 13 |
| QC-1-29 | deep-review | medium | Content | SERVER_NAME description incomplete | 13 |
| QC-1-30 | deep-review | medium | Content | Changelog issues | 13 |
| QC-1-31 | deep-review | low | Security | pendingPermissions no TTL or size cap | 10 |
| QC-1-32 | deep-review | low | Security | seenTs dedup map no upper-bound cap | 14 |
| QC-1-33 | deep-review | low | Security | Broadcast mention stripping incomplete | 14 |
| QC-1-34 | deep-review | low | Security | userId not validated at call site | 14 |
| QC-1-35 | deep-review | low | Security | safeErrorMessage regex stops at whitespace | 14 |
| QC-1-36 | deep-review | low | Security/DevOps | Manifest scopes workspace-wide | 13 |
| QC-1-37 | deep-review | low | Architecture | formatPermissionRequest exported but only used internally | 9 |
| QC-1-38 | deep-review | low | Architecture | pendingPermissions inline anonymous type | 9 |
| QC-1-39 | deep-review | low | Architecture | No forced-exit timeout in shutdown | 14 |
| QC-1-40 | deep-review | low | DevOps | bin entry points to raw .ts file | 14 |
| QC-1-41 | deep-review | low | DevOps | examples directory included in npm files | 14 |
| QC-1-42 | deep-review | low | DevOps | Dependabot missing groups and labels | 11 |
| QC-1-43 | deep-review | low | DevOps | skipLibCheck undocumented | 13 |
| QC-1-44 | deep-review | low | Testing | Broadcast mention test assertions don't verify replacement | 14 |
| QC-1-45 | deep-review | low | Testing | ALLOWED_USER_IDS trim behavior untested | 14 |
| QC-1-46 | deep-review | low | Testing | formatPermissionBlocks not tested with broadcasts | 14 |
| QC-1-47 | deep-review | low | Testing | classifyMessage('') test description misleading | 14 |
| QC-1-48 | deep-review | low | Testing | safeErrorMessage not tested with mid-word token | 14 |
| QC-1-49 | deep-review | low | Testing | No test for createServer without deps | 14 |
| QC-1-50 | deep-review | low | UX/Docs | Examples section buried in README | 12 |
| QC-1-51 | deep-review | low | UX/Docs | multi-project-vm.md no back-link | 12 |
| QC-1-52 | deep-review | low | UX/Docs | No troubleshooting section | 12 |
| QC-1-53 | deep-review | low | Content | Interactivity Socket Mode comment missing | 13 |

## Structural Patterns (from historical scan)

| Pattern | Slug | Reviews | Status | Fix Phase |
|---------|------|---------|--------|-----------|
| CLI-Block Isolation | cli-block-isolation | 2026-03-28 | fix phase created | 9 |
| Missing Integration Seams | missing-integration-seams | 2026-03-26 | resolved | — |
| Research-to-Plan Drift | research-to-plan-drift | 2026-03-26 | resolved | — |
| Inconsistent Error Handling Depth | inconsistent-error-handling-depth | 2026-03-26 | resolved | — |
| Test Surface Mismatch | test-surface-mismatch | 2026-03-27 | resolved (partially regressed → CLI-Block Isolation) | — |

## Phases Created

| Phase | Name | Status | Findings |
|-------|------|--------|----------|
| 9 | Handler Architecture — wireHandlers Extraction | pending | QC-1-02, QC-1-07, QC-1-08, QC-1-19, QC-1-37, QC-1-38 |
| 10 | Interactive Handler Hardening | pending | QC-1-01, QC-1-06, QC-1-10, QC-1-18, QC-1-31 |
| 11 | CI/CD Supply Chain Hardening | pending | QC-1-03, QC-1-11, QC-1-12, QC-1-13, QC-1-14, QC-1-20, QC-1-42 |
| 12 | Documentation — Setup Flow & Consistency | pending | QC-1-04, QC-1-05, QC-1-21, QC-1-22, QC-1-23, QC-1-24, QC-1-25, QC-1-26, QC-1-50, QC-1-51, QC-1-52 |
| 13 | Documentation — Content Polish | pending | QC-1-27, QC-1-28, QC-1-29, QC-1-30, QC-1-36, QC-1-43, QC-1-53 |
| 14 | Test Coverage Gaps | pending | QC-1-09, QC-1-15, QC-1-16, QC-1-17, QC-1-32, QC-1-33, QC-1-34, QC-1-35, QC-1-39, QC-1-40, QC-1-41, QC-1-44, QC-1-45, QC-1-46, QC-1-47, QC-1-48, QC-1-49 |

## Execution Plan

### Wave 1 (parallel)
- Phase 9 — Handler Architecture — wireHandlers Extraction
- Phase 11 — CI/CD Supply Chain Hardening
- Phase 12 — Documentation — Setup Flow & Consistency

### Wave 2 (parallel, after wave 1)
- Phase 10 — Interactive Handler Hardening (depends on 9)
- Phase 13 — Documentation — Content Polish (depends on 12)

### Wave 3 (after wave 2)
- Phase 14 — Test Coverage Gaps (depends on 9)

## Current Position

Round: 1
Step: planning
Next: Plan wave 1 phases (9, 11, 12)
