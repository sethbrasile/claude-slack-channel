# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Initial Release

**Shipped:** 2026-03-29
**Phases:** 14 | **Plans:** 23

### What Was Built
- MCP Channel server bridging Claude Code to Slack via Socket Mode (bidirectional)
- Permission relay with both text-based (`yes/no {id}`) and interactive button approval
- Thread tracking state machine classifying messages as replies vs new commands
- 135 unit tests covering all pure functions with no Slack API mocks needed
- CI/CD pipeline with supply chain hardening (SHA-pinned actions, provenance attestation)
- Complete documentation suite: README, examples, manifest, changelog, contributing guide

### What Worked
- **Pure function extraction pattern** — all core logic (shouldProcessMessage, parsePermissionReply, formatInboundNotification, etc.) extracted as pure functions with explicit parameters. This enabled 135 tests without mocking any SDK internals.
- **Addressing critical pitfalls in Phase 1** — identifying 8 transport-layer hazards (stdout corruption, startup ordering, bot loops, etc.) during research and mandating they be solved in the first phase prevented costly retrofitting later.
- **Deep review → QC fix phases** — a comprehensive code review after the initial 4 phases caught 40+ issues at severity levels H/M/L, which were systematically grouped into 10 fix phases (5-14). This was more efficient than discovering issues post-release.
- **wireHandlers composition root** (Phase 9) — extracting a single handler registration point eliminated duplication between CLI and library paths, and made all handlers independently testable.

### What Was Inefficient
- **QC fix phases outnumbered core phases** — 10 QC phases vs 4 core phases. The deep review was valuable, but the phase overhead (research → plan → execute → verify per phase) was heavy for small fixes. Some phases had 1-2 file changes.
- **STATE.md accumulated context never pruned** — the Decisions section grew to 40+ entries across all phases, most only relevant during execution. This bloated context for future sessions.
- **Nyquist validation was mostly retroactive** — only 4/14 phases had compliant validation at execution time. The remaining 10 needed backfill, suggesting the validation step was being skipped under velocity pressure.
- **Phase 6 absorbed into Phase 10** — planning a phase that later got absorbed into another phase was wasted work. Better to have scoped shutdown hardening into Phase 10 from the start.

### Patterns Established
- **Handler factory pattern** (`makeReplyHandler`, `makeInteractiveHandler`) — factory functions that accept dependencies and return handlers. Enables unit testing without server instantiation.
- **Testing seam exports** (`isDuplicateTs`, `shouldProcessMessage`) — pure functions exported specifically as testing seams, with module-private constants staying private.
- **Interactive + text fallback** — permission relay supports both interactive buttons and text-based `yes/no {id}` replies, giving operators flexibility.
- **Token scrubbing on all log levels** — `safeErrorMessage` applied uniformly via `.map()` in the logger factory, not just on the error level.

### Key Lessons
1. **Group small fixes into fewer, larger phases.** A phase with 1 file change has the same overhead as one with 10. Next milestone should batch related small fixes.
2. **Run deep review after core features, plan QC as a single consolidated phase.** The H/M/L severity grouping was good, but each severity didn't need its own phase.
3. **Validate during execution, not retroactively.** Nyquist compliance should be a gate, not a backfill task.
4. **Pure function extraction scales well.** 135 tests with zero mocks is a direct result of this architectural choice. Continue this pattern.

### Cost Observations
- Model mix: ~70% opus, ~25% sonnet, ~5% haiku (estimated from agent spawning patterns)
- Notable: Phase 14 P01 had 65 commits — highest of any plan, due to iterative test-fix cycles on source code changes

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 14 | 23 | Deep review → QC phases pattern established |

### Cumulative Quality

| Milestone | Tests | TypeScript LOC | Tech Debt Items |
|-----------|-------|----------------|-----------------|
| v1.0 | 135 | ~2,400 | 3 (minor) |

### Top Lessons (Verified Across Milestones)

1. Pure function extraction eliminates mock complexity and scales test coverage linearly
2. Address transport/protocol invariants in Phase 1 — retrofitting is 3x more expensive
