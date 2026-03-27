---
phase: 4
slug: package-documentation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (built-in) |
| **Config file** | none — Bun auto-discovers `__tests__/` and `*.test.ts` |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test --coverage` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test --coverage && bunx tsc --noEmit && bunx biome check .`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | DOCS-10 | smoke | `bun test` (regression) | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | DOCS-02 | smoke | `bunx js-yaml slack-app-manifest.yaml` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | DOCS-03 | manual | `grep -c '' .env.example` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | DOCS-09 | smoke | `grep -q "MIT" LICENSE` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | DOCS-01 | manual | — | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | DOCS-04 | manual | — | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | DOCS-05 | manual | — | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 1 | DOCS-06 | manual | — | ❌ W0 | ⬜ pending |
| 04-02-05 | 02 | 1 | DOCS-07 | manual | — | ❌ W0 | ⬜ pending |
| 04-02-06 | 02 | 1 | DOCS-08 | smoke | GitHub validates on push | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

*Phase 4 adds no new runtime code. Existing 48-test suite covers regression. No new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README has required sections | DOCS-01 | Content quality, not just existence | Verify quick start, env vars, threading, permission relay, comparison table |
| CONTRIBUTING.md has required sections | DOCS-04 | Content structure review | Verify dev setup, PR process, code style sections |
| CHANGELOG.md format | DOCS-05 | Format convention compliance | Verify Keep a Changelog 1.0.0 format |
| examples/basic-setup.md walkthrough | DOCS-06 | End-to-end completeness | Follow steps on fresh machine |
| examples/multi-project-vm.md walkthrough | DOCS-07 | End-to-end completeness | Verify multi-process pattern is correct |
| .env.example completeness | DOCS-03 | Cross-check against config.ts | Verify all 5 env vars documented |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
