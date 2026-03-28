# Roadmap: claude-slack-channel

## Overview

Build a single-purpose MCP Channel server that bridges Claude Code to Slack via Socket Mode. The project delivers in four phases: core infrastructure (transport safety + Slack connectivity), the differentiating features (channel bridge + permission relay + threading), quality assurance (tests + CI), and release packaging (npm + docs). All critical pitfalls are addressed in Phase 1 by design — not retrofitted.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - MCP server scaffold + Slack Socket Mode connection with all transport safety invariants (completed 2026-03-27)
- [x] **Phase 2: Message Flow + Permission Relay** - Channel bridge, thread tracker, and the permission relay that defines the project (completed 2026-03-27)
- [x] **Phase 3: Testing + CI** - Full unit test coverage on all pure functions and GitHub Actions CI pipeline (completed 2026-03-27)
- [x] **Phase 4: Package + Documentation** - npm-publishable package, Slack app manifest, README, and community docs (completed 2026-03-27)
- [x] **Phase 5: Testability & Dead Code Cleanup** - Align test surface with runtime surface, remove dead code, add missing test coverage (QC fix) (completed 2026-03-27)
- [x] **Phase 6: Shutdown & Lifecycle Hardening** - Make shutdown idempotent and fix drain race (QC fix) (absorbed into Phase 10)
- [x] **Phase 7: Config & Security Tightening** - Close validation gap and defense-in-depth items (QC fix) (completed 2026-03-27)
- [x] **Phase 8: CI/CD Polish** - Tighten release safety and reduce CI waste (QC fix) (completed 2026-03-27)
- [x] **Phase 9: Handler Architecture — wireHandlers Extraction** - Eliminate CLI-block isolation, deduplicate reply handler, make all handlers testable (QC fix) (completed 2026-03-28)
- [ ] **Phase 10: Interactive Handler Hardening** - Fix race condition, add validation, make testable, fix shutdown drain (QC fix)
- [x] **Phase 11: CI/CD Supply Chain Hardening** - SHA-pin actions, complete release quality gates, tighten permissions (QC fix) (completed 2026-03-28)
- [x] **Phase 12: Documentation — Setup Flow & Consistency** - Fix security-relevant doc gaps and reduce setup friction (QC fix) (completed 2026-03-28)
- [ ] **Phase 13: Documentation — Content Polish** - Improve clarity and consistency in docs and changelog (QC fix)
- [ ] **Phase 14: Test Coverage Gaps** - Cover remaining untested paths and harden existing tests (QC fix)

## Phase Details

### Phase 1: Foundation
**Goal**: A working MCP server that connects to Slack via Socket Mode and safely forwards inbound messages to Claude — with every transport-layer invariant locked in from the first commit.
**Depends on**: Nothing (first phase)
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, SLCK-01, SLCK-02, SLCK-03, SLCK-04, SLCK-05, SLCK-06, SLCK-07, CONF-01, CONF-02, CONF-03, CONF-04, CONF-05
**Success Criteria** (what must be TRUE):
  1. Running the server with valid env vars connects to Slack and logs "connected" to stderr with no stdout output whatsoever
  2. Running the server with invalid or missing env vars prints a field-level error and exits with code 1
  3. A Slack message from an allowed user in the configured channel arrives as a `notifications/claude/channel` notification in Claude Code
  4. Messages from bots, wrong channels, or non-allowlisted users are silently dropped — no notification reaches Claude
  5. Sending SIGTERM or closing stdin causes the server to shut down cleanly without crashing or hanging
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffold: package.json, tsconfig, biome, types.ts, config.ts with Zod validation + config tests
- [ ] 01-02-PLAN.md — MCP server + Slack client: capabilities, startup ordering, error handlers, graceful shutdown, Socket Mode filtering and dedup

### Phase 2: Message Flow + Permission Relay
**Goal**: Claude receives properly-formatted channel notifications for every allowed inbound message, can reply to Slack via the `reply` tool, and operators can approve or deny Claude's tool calls from Slack without terminal access.
**Depends on**: Phase 1
**Requirements**: BRDG-01, BRDG-02, BRDG-03, PERM-01, PERM-02, PERM-03, PERM-04, PERM-05, THRD-01, THRD-02, THRD-03
**Success Criteria** (what must be TRUE):
  1. A Slack message from an allowed user arrives in Claude as a `<channel source="slack">` payload with correct meta keys (underscores, not hyphens)
  2. Claude calling the `reply` tool posts a message to Slack and the tool returns `{ content: [{ type: 'text', text: 'sent' }] }`
  3. When Claude requests a permission, a formatted approval message appears in the active Slack thread within 3 seconds
  4. Typing `yes {id}` or `no {id}` (or y/n shorthand, any case) in Slack resolves the permission and does NOT trigger a channel notification to Claude
  5. Thread replies go into the active thread; a new top-level message abandons the old thread and starts a new command context
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — ThreadTracker state machine (threads.ts) + formatInboundNotification (channel-bridge.ts), TDD
- [ ] 02-02-PLAN.md — permission.ts (parsePermissionReply + formatPermissionRequest) + refactor slack-client.ts + full server.ts wiring

### Phase 3: Testing + CI
**Goal**: Every pure function is covered by unit tests, the full test suite runs in GitHub Actions on every push and PR, and no commit can break typecheck, lint, or tests without the CI catching it.
**Depends on**: Phase 2
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-08, TEST-09, TEST-10, CICD-01, CICD-02, CICD-03
**Success Criteria** (what must be TRUE):
  1. `bun test` passes with coverage reported for all modules in `src/`
  2. `bunx tsc --noEmit` exits 0 with no type errors
  3. `bunx biome check .` exits 0 with no lint or format violations
  4. Opening a PR on GitHub triggers the CI workflow and all three checks (typecheck, lint, test) must pass before merge
  5. Pushing a `v*` tag triggers the release workflow and publishes to npm with provenance attestation
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Audit and verify unit test coverage for TEST-01 through TEST-10 (all 6 test files + tsc + biome)
- [ ] 03-02-PLAN.md — GitHub Actions CI workflow (push/PR) and release workflow (v* tags, npm publish with provenance)

### Phase 4: Package + Documentation
**Goal**: The package is installable via bunx, Slack app setup is reproducible from a manifest file, and all community-facing documentation is present so external contributors and operators can use the server without asking questions.
**Depends on**: Phase 3
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, DOCS-07, DOCS-08, DOCS-09, DOCS-10
**Success Criteria** (what must be TRUE):
  1. `package.json` has `bin`, `files`, `engines`, and `publishConfig` configured so `bunx claude-slack-channel` runs the server
  2. `slack-app-manifest.yaml` exists and contains all required OAuth scopes and Socket Mode settings needed to create a working Slack app
  3. README covers quick start, all env vars, threading behavior, permission relay, and includes a comparison table with the community implementation
  4. `examples/` contains at least one walkthrough (basic setup) that a new operator can follow end-to-end
  5. MIT LICENSE, CHANGELOG.md, CONTRIBUTING.md, and a bug report issue template are all present in the repo
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Package config: package.json publishConfig, slack-app-manifest.yaml, .env.example, MIT LICENSE (DOCS-10, DOCS-02, DOCS-03, DOCS-09)
- [ ] 04-02-PLAN.md — Community docs: README, CONTRIBUTING.md, CHANGELOG.md, examples/, issue template (DOCS-01, DOCS-04, DOCS-05, DOCS-06, DOCS-07, DOCS-08)

### Phase 5: Testability & Dead Code Cleanup
**Goal**: Align the test surface with the runtime surface so CI coverage reflects real code paths. Remove dead code and add missing test cases.
**Depends on**: Phase 4
**Requirements**: Deep-review findings H1, M2, M3, M9, M10, L5, L6, L8, L11
**Success Criteria** (what must be TRUE):
  1. `createServer()` accepts injected `web` and `tracker` dependencies and registers the `CallToolRequestSchema` handler internally — library consumers get a fully functional server
  2. `isDuplicate()` function and its tests are removed from `slack-client.ts` (dead code)
  3. The reply tool handler (unknown tool rejection, Zod validation, mention stripping, start_thread branching) has unit tests covering all branches
  4. `safeErrorMessage` tests cover `xoxp-` and `xoxa-` token patterns in addition to existing xoxb-/xapp-
  5. Edge case tests added: whitespace-only ALLOWED_USER_IDS, classifyMessage(''), formatInboundNotification with empty text, formatPermissionRequest with absent input_preview
  6. Logger tests verify message content (not just `toHaveBeenCalled`), and setLevel/setName/getLevel have basic coverage
  7. `<!everyone>` is explicitly tested in permission mention stripping
  8. SDK private property access is acknowledged in a describe-block comment in server.test.ts
  9. `bun test` passes with all new tests
**Plans**: 0 plans (pending)

### Phase 6: Shutdown & Lifecycle Hardening
**Goal**: Make shutdown idempotent and add diagnostic logging for edge cases.
**Depends on**: Phase 5 (server.ts restructure must be stable first)
**Requirements**: Deep-review findings M1, L1
**Success Criteria** (what must be TRUE):
  1. A `shutdownInitiated` boolean guard prevents double invocation of `shutdown()` — second signal is a no-op with a log line
  2. `messageQueue` reference is captured after `socketMode.disconnect()` resolves, not read from the live variable
  3. Events with missing/empty `ts` log `[slack-client] event without ts` to stderr before discarding
  4. Empty-string `ts` does NOT pollute the `seenTs` dedup map
  5. `bun test` passes
**Plans**: 0 plans (pending)

### Phase 7: Config & Security Tightening
**Goal**: Close the SLACK_CHANNEL_ID validation gap and apply defense-in-depth improvements.
**Depends on**: Phase 5 (server.ts restructure must be stable first)
**Requirements**: Deep-review findings M4, M5, M6, M8, L9
**Success Criteria** (what must be TRUE):
  1. `SLACK_CHANNEL_ID` is validated with `.regex(/^[CG][A-Z0-9]+$/)` in the Zod config schema
  2. `createStderrLogger` applies `safeErrorMessage` to the `error` method's output before passing to `console.error`
  3. `PERMISSION_ID_RE` (pre-built anchored regex) is exported from `permission.ts` and imported in `server.ts` — no inline `new RegExp()` construction
  4. The `as unknown as Record<string, unknown>` double casts in `server.ts` are simplified to direct casts with a comment explaining the SDK constraint
  5. `safeErrorMessage` regex suffix changed from `[\w-]+` to `[^\s]+` for multi-line token coverage
  6. `bun test` passes, `bunx tsc --noEmit` exits 0
**Plans**: 0 plans (pending)

### Phase 8: CI/CD Polish
**Goal**: Tighten release safety, reduce CI waste, and add open-source hygiene features.
**Depends on**: None (independent of source code changes)
**Requirements**: Deep-review findings H2, M7, M11, L2, L3, L4, L10, L12
**Success Criteria** (what must be TRUE):
  1. Release workflow validates git tag matches `package.json` version before `npm publish`
  2. CI push trigger changed to `branches: ["main"]` — no more double-triggers on PR branches
  3. GitHub Actions versions pinned to specific releases (not floating major tags)
  4. `.github/dependabot.yml` exists with entries for npm and github-actions ecosystems
  5. `prepublishOnly` script includes `bunx biome check .` lint step
  6. `slack-app-manifest.yaml` has a comment noting DM channels are unsupported
  7. Release workflow runs `bun test --coverage` (matching CI)
  8. CI workflow includes a security audit step
**Plans**: 0 plans (pending)

### Phase 9: Handler Architecture — wireHandlers Extraction
**Goal**: Eliminate the CLI-block isolation pattern by extracting a `wireHandlers()` composition root that registers all handlers (reply, permission, interactive, onMessage). Both CLI and library paths call it, eliminating duplication and enabling testing.
**Depends on**: Phase 5 (server.ts restructure must be stable)
**Requirements**: Deep-review findings H2, M2, M3, M14, L7, L8
**Success Criteria** (what must be TRUE):
  1. A `wireHandlers(server, web, tracker, config)` function exists and registers all handlers (reply tool, permission notification, interactive callback, onMessage pipeline)
  2. Both the CLI entry point and `createServer()` library path call `wireHandlers()` — no duplicated handler bodies
  3. `PermissionRequestSchema` is defined in `permission.ts` and exported, not inline in the CLI block
  4. `pendingPermissions` uses the `PermissionRequest` type from `types.ts`
  5. `formatPermissionRequest` export scope is reviewed (unexport if only used internally)
  6. `bun test` passes, `bunx tsc --noEmit` exits 0
**Plans**: 2 plans

Plans:
- [ ] 09-01-PLAN.md — Move PermissionRequestSchema to permission.ts, fix pendingPermissions type, add formatPermissionRequest testability comment (M3, L7, L8)
- [ ] 09-02-PLAN.md — Extract makeReplyHandler, wireHandlers; deduplicate reply handler; wire both paths; add unit tests (H2, M2, M14)

### Phase 10: Interactive Handler Hardening
**Goal**: Eliminate the interactive button race condition, add Zod validation for interactive payloads, route interactive callbacks through messageQueue for shutdown drain, and add TTL to pendingPermissions. Absorbs Phase 6 (shutdown lifecycle) findings.
**Depends on**: Phase 9 (wireHandlers extraction makes this cleaner)
**Requirements**: Deep-review findings H1, M1, M5, M13, L1; Phase 6 findings M1, L1
**Success Criteria** (what must be TRUE):
  1. Interactive button-click callbacks are routed through `messageQueue` — no concurrent execution on double-click
  2. Interactive payloads are validated through a Zod schema before processing
  3. `pendingPermissions` entries have a TTL and size cap — stale entries are cleaned up
  4. The interactive callback is an exported function testable with mocked dependencies
  5. `shutdown()` drains interactive callbacks (via messageQueue) before closing transport
  6. Interactive handler has unit tests covering: happy path, double-click dedup, unknown request_id, malformed payload
  7. `bun test` passes
**Plans**: 0 plans (pending)

### Phase 11: CI/CD Supply Chain Hardening
**Goal**: Pin GitHub Actions to immutable SHAs, add missing quality gates to the release workflow, tighten permissions, and complete logger scrubbing.
**Depends on**: None (independent)
**Requirements**: Deep-review findings H3, M6, M7, M8, M9, M15, L12
**Success Criteria** (what must be TRUE):
  1. All GitHub Actions in ci.yml and release.yml are pinned to full commit SHAs with version comments
  2. Release workflow includes `bunx biome check .` lint step before typecheck
  3. Release workflow includes `bun audit` after `bun install --frozen-lockfile`
  4. `actions/setup-node` has `registry-url: 'https://registry.npmjs.org'`
  5. Release workflow has top-level `permissions: {}` with per-job overrides
  6. `safeErrorMessage` is applied to all four logger levels (debug, info, warn, error), not just error
  7. Dependabot config has groups and labels configured
**Plans**: 2 plans

Plans:
- [ ] 11-01-PLAN.md — SHA-pin all actions, add bun audit + biome steps to release, add registry-url + permissions deny-all, Dependabot groups/labels (H3, M6, M7, M8, M9, L12)
- [ ] 11-02-PLAN.md — Extend createStderrLogger to scrub tokens on all four logger levels + unit tests (M15)

### Phase 12: Documentation — Setup Flow & Consistency
**Goal**: Fix security-relevant documentation gaps and reduce setup friction by adding prerequisites, pinning example versions, and adding troubleshooting.
**Depends on**: None (independent)
**Requirements**: Deep-review findings H4, H5, M16, M17, M18, M19, M20, M25, L21, L22, L23
**Success Criteria** (what must be TRUE):
  1. All `.mcp.json` examples pin `claude-slack-channel@0.3.3` matching the README
  2. A "Prerequisites" section before Quick Start lists Claude Code version requirement and claude.ai login
  3. Slack admin/app-management permissions noted before Step 1
  4. Manifest comment about `connections:write` aligns with README (remove "automatic" claim)
  5. Channel ID URL format shown inline: `https://yourworkspace.slack.com/archives/C0XXXXXXXXX`
  6. `W0XXXXXXXXX` format documented alongside `U0...` for ALLOWED_USER_IDS
  7. Bot name uses `/invite @Claude` matching manifest, with note
  8. Audit step clarified: "(run this in any terminal where Claude Code is available)"
  9. Examples section position improved in README
  10. `multi-project-vm.md` has back-link to `basic-setup.md`
  11. Troubleshooting section added with common issues
**Plans**: 2 plans

Plans:
- [ ] 12-01-PLAN.md — README.md: Prerequisites section, config table improvements, bot invite fix, audit clarity, Examples repositioning, Troubleshooting section
- [ ] 12-02-PLAN.md — Example version pins, manifest comment fix, multi-project back-link

### Phase 13: Documentation — Content Polish
**Goal**: Improve clarity and consistency in docs and changelog — rewrite jargon-heavy opening, fix placeholder syntax, update config descriptions, and fix changelog.
**Depends on**: Phase 12 (structural doc changes first, then polish)
**Requirements**: Deep-review findings M21, M22, M23, M24, L6, L13, L14
**Success Criteria** (what must be TRUE):
  1. Opening paragraph defines "Socket Mode," "MCP server," and "Channel protocol" before using them
  2. Placeholder syntax is consistent across README and examples (no `{id}` vs concrete mismatch)
  3. Permission flow description leads with button interaction, not just text fallback
  4. SERVER_NAME description includes "Appears as the MCP server name in Claude's tool list"
  5. Changelog has explanatory note about same-day dates, diff link footer, and audience scope for breaking changes
  6. Manifest scope breadth (workspace-wide) documented in a comment
  7. Interactivity section in manifest has Socket Mode comment
**Plans**: 0 plans (pending)

### Phase 14: Test Coverage Gaps
**Goal**: Cover remaining untested code paths and harden existing test assertions.
**Depends on**: Phase 9 (wireHandlers extraction enables CLI-path testing)
**Requirements**: Deep-review findings M4, M10, M11, M12, L2, L3, L4, L5, L9, L10, L11, L15, L16, L17, L18, L19, L20
**Success Criteria** (what must be TRUE):
  1. `classifyMessage('')` explicitly guards empty string — returns `'new_input'`
  2. SDK private property tests have guard assertions that fail loudly if internals change
  3. Test exists for `chat.postMessage` returning `{ ok: false, error: '...' }` — verifies `isError: true` response
  4. TTL dedup logic tested: duplicate `ts` suppressed, expired `ts` re-accepted
  5. `seenTs` map has upper-bound cap tested
  6. Broadcast mention stripping tested for `<@UXXXXX>` and `<!subteam^>` patterns
  7. `userId` in `formatPermissionResult` validated against pattern
  8. `safeErrorMessage` tested with mid-word token pattern
  9. Forced-exit timeout exists in shutdown (process doesn't hang if `server.close()` never resolves)
  10. `bin` entry point behavior documented or tested
  11. `examples/` excluded from npm `files` array (or justified if included)
  12. Broadcast mention test assertions verify replacement character
  13. `ALLOWED_USER_IDS` trim behavior tested
  14. `formatPermissionBlocks` tested with broadcast mentions
  15. `classifyMessage('')` test description accurate
  16. `safeErrorMessage` tested with mid-word token
  17. `createServer` without deps tested for tool/call handler boundary
  18. `bun test` passes
**Plans**: 0 plans (pending)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-03-27 |
| 2. Message Flow + Permission Relay | 2/2 | Complete    | 2026-03-27 |
| 3. Testing + CI | 2/2 | Complete   | 2026-03-27 |
| 4. Package + Documentation | 2/2 | Complete   | 2026-03-27 |
| 5. Testability & Dead Code Cleanup | 0/0 | Complete    | 2026-03-27 |
| 6. Shutdown & Lifecycle Hardening | 0/0 | Absorbed → Phase 10 | — |
| 7. Config & Security Tightening | 0/0 | Complete    | 2026-03-27 |
| 8. CI/CD Polish | 0/0 | Complete    | 2026-03-27 |
| 9. Handler Architecture — wireHandlers Extraction | 2/2 | Complete   | 2026-03-28 |
| 10. Interactive Handler Hardening | 0/0 | Pending | — |
| 11. CI/CD Supply Chain Hardening | 2/2 | Complete    | 2026-03-28 |
| 12. Documentation — Setup Flow & Consistency | 2/2 | Complete   | 2026-03-28 |
| 13. Documentation — Content Polish | 0/0 | Pending | — |
| 14. Test Coverage Gaps | 0/0 | Pending | — |
