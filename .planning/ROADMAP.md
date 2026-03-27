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
- [ ] **Phase 6: Shutdown & Lifecycle Hardening** - Make shutdown idempotent and fix drain race (QC fix)
- [x] **Phase 7: Config & Security Tightening** - Close validation gap and defense-in-depth items (QC fix) (completed 2026-03-27)
- [x] **Phase 8: CI/CD Polish** - Tighten release safety and reduce CI waste (QC fix) (completed 2026-03-27)

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
| 6. Shutdown & Lifecycle Hardening | 0/0 | Pending | — |
| 7. Config & Security Tightening | 0/0 | Complete    | 2026-03-27 |
| 8. CI/CD Polish | 0/0 | Complete    | 2026-03-27 |
