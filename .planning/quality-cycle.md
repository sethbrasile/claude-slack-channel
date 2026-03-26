---
round: 1
started: 2026-03-26
source_review: .planning/reviews/2026-03-26-deep-review.md
---

## Findings

### Round 1 (2026-03-26)

#### Blocking

| ID | Source | Severity | Area | Description | Phase |
|----|--------|----------|------|-------------|-------|
| QC-1-01 | deep-review | critical | Integration | Missing server.notification() code in Task 7 | 1 |
| QC-1-02 | deep-review | critical | Error Handling | uncaughtException/unhandledRejection handlers don't exit | 2 |
| QC-1-03 | deep-review | high | Integration | Permission verdict flow has no mutual exclusivity with channel forwarding | 1 |
| QC-1-04 | deep-review | high | Integration | Permission request threading breaks ThreadTracker model | 1 |
| QC-1-05 | deep-review | high | Testability | Module-scope dedup Set shared across all instances and tests | 2 |
| QC-1-06 | deep-review | high | Testability | config.test.ts is empty stub with zero assertions | 2 |
| QC-1-07 | deep-review | high | Integration | Reply tool calls tracker.startThread on every top-level reply | 1 |
| QC-1-08 | deep-review | high | DevOps | engines.bun >=1.1.0 but text lockfile requires >=1.2.0 | 3 |
| QC-1-09 | deep-review | high | DevOps | Missing files field and prepublishOnly script in package.json | 3 |
| QC-1-10 | deep-review | high | DevOps | No release.yml task in implementation plan | 3 |

#### Noted (non-blocking)

| ID | Source | Severity | Area | Description |
|----|--------|----------|------|-------------|
| QC-1-11 | deep-review | medium | Security | Triple-backtick injection in input_preview |
| QC-1-12 | deep-review | medium | Security | .gitignore missing .env.* variants |
| QC-1-13 | deep-review | medium | Architecture | input_preview required vs optional in PermissionRequestSchema |
| QC-1-14 | deep-review | medium | Testing | server.test.ts only asserts server is defined |
| QC-1-15 | deep-review | medium | Testing | formatInboundNotification missing source field test |
| QC-1-16 | deep-review | medium | Testing | isDuplicate never tested and not exported |
| QC-1-17 | deep-review | medium | Testing | shouldProcessMessage missing combined bot_id + subtype test |
| QC-1-18 | deep-review | medium | Product | Task 10 references projects.yaml that doesn't exist |
| QC-1-19 | deep-review | medium | Product | Task 8 missing startup failure test cases |
| QC-1-20 | deep-review | medium | DevOps | CI coverage reporter inconsistency |
| QC-1-21 | deep-review | medium | Product | Task 10 missing CONTRIBUTING.md and community health files |
| QC-1-22 | deep-review | medium | Product | Task 2/7 shutdown handler duplication risk |
| QC-1-23 | deep-review | medium | Product | Biome schema version pinning gap |
| QC-1-24 | deep-review | low | Security | ALLOWED_USER_IDS commas-only input produces empty array |
| QC-1-25 | deep-review | low | Security | .mcp.json example shows inline tokens without warning |
| QC-1-26 | deep-review | low | Product | Internal PPMC repo reference in published plan |
| QC-1-27 | deep-review | low | Testing | parsePermissionReply missing boundary-length tests |

## Structural Patterns (from historical scan)

| Pattern | Slug | Reviews | Status | Fix Phase |
|---------|------|---------|--------|-----------|
| Missing Integration Seams | missing-integration-seams | 2026-03-26-deep-review | fix phase created | 1 |
| Research-to-Plan Drift | research-to-plan-drift | 2026-03-26-deep-review | fix phase created | 3 |

## Phases Created

| Phase | Name | Status | Findings |
|-------|------|--------|----------|
| 1 | Integration Spec Rewrite | pending | QC-1-01, QC-1-03, QC-1-04, QC-1-07 |
| 2 | Error Handling & Testability Fixes | pending | QC-1-02, QC-1-05, QC-1-06 |
| 3 | DevOps & Publishing Fixes | pending | QC-1-08, QC-1-09, QC-1-10 |

## Execution Plan

### Wave 1 (parallel)
- Phase 1 — Integration Spec Rewrite
- Phase 2 — Error Handling & Testability Fixes
- Phase 3 — DevOps & Publishing Fixes

All three phases touch different sections of docs/implementation-plan.md and have no shared state — they can all run in parallel.

## Current Position

Round: 1
Step: planning
Next: Plan and execute wave 1 (all 3 phases in parallel)
