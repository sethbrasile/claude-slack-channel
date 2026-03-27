---
status: final
user_decision: act on all findings
date: 2026-03-26
type: deep-review
mode: pre-build
scope: All planning documents — implementation plan, research synthesis, Slack best practices, TypeScript/Bun setup research, CLAUDE.md
verdict: NOT READY
blocking_findings: 8
total_findings: 25
---

# Deep Review — claude-slack-channel
## 2026-03-26 | Mode: Pre-build | Scope: All planning documents

> **How to use this report:** Start with the Proposed Action Plan — each grouping is self-contained. Read Critical Findings for evidence and context. The full findings sections provide detail on demand.

### Meta
- Lenses activated: Architecture, Security, Backend/Data, Product, DevOps/Deployment, Testing
- Skills referenced: None (no project-relevant skills discovered)
- Files examined: 5 (implementation-plan.md, research-synthesis.md, slack-best-practices.md, typescript-bun-setup-research.md, CLAUDE.md)
- Filtered 1 doc-polish finding (implementer gap test): Product reviewer incorrectly flagged regex case-sensitivity — verified correct behavior via spot-check.
- **Verdict: NOT READY** — 8 blocking findings
- Blocking findings: 8 / Total findings: 25

---

### Critical Findings

**C1: Missing code for server.notification() calls in Task 7**
- severity: critical
- blocking: yes
- file: docs/implementation-plan.md:940-989 (Task 7)
- lens: Architecture, Backend/Data
- what: Task 7 provides code for the permission-request handler and the reply tool, but never provides code for the two most critical SDK calls: `server.notification()` to forward inbound Slack messages to Claude (`notifications/claude/channel`), and `server.notification()` to return the parsed permission verdict to Claude (`notifications/claude/channel/permission`).
- why: These are outbound server-to-client notifications on a transport that normally carries client-to-server calls. The exact method name, param shape, and whether `server.notification()` vs `server.sendNotification()` is correct are non-obvious from SDK docs alone. Without a code example, an implementer will guess the wrong method or wrong payload shape, producing a server that silently never delivers messages to Claude.
- fix: Add two code blocks to Task 7: (1) `await server.notification({ method: 'notifications/claude/channel', params: { content: msg.text, meta: { user: msg.user, channel: msg.channel, ts: msg.ts } } })` for inbound messages, and (2) `await server.notification({ method: 'notifications/claude/channel/permission', params: verdict })` for permission verdicts after `parsePermissionReply()` matches.

**C2: uncaughtException/unhandledRejection handlers don't exit**
- severity: critical
- blocking: yes
- file: docs/implementation-plan.md:390-395 (Task 2, CLI entry point)
- lens: Architecture, Security
- what: The `uncaughtException` and `unhandledRejection` handlers log to stderr but do not call `process.exit(1)`, leaving the process running in an undefined state after a fatal exception.
- why: A process that survives an unhandled exception may have a corrupted MCP transport or half-open WebSocket, silently passing or dropping permission requests. The research doc at typescript-bun-setup-research.md:691-698 correctly includes `process.exit(1)` in both handlers, but the plan's Task 2 code omits it.
- fix: Add `process.exit(1)` after each `console.error(...)` call in both handlers at docs/implementation-plan.md:391 and :394, matching the pattern in the research doc.

---

### High Findings

**H1: Permission verdict flow has no explicit mutual exclusivity with channel forwarding**
- severity: high
- blocking: yes
- file: docs/implementation-plan.md:946-949 (Task 7, flow step 1)
- lens: Architecture, Security, Backend/Data, Product
- what: The inbound message flow says "check for permission verdict → classify → forward to Claude" but does not specify that a matched verdict must `return` without forwarding the message as a channel notification. The `MessageHandler` type (`(message: SlackMessage) => void`) provides no mechanism to suppress forwarding. Additionally, the flow does not explicitly state that permission verdict parsing must occur only after the ALLOWED_USER_IDS check passes.
- why: An implementer could forward a permission verdict to Claude as both a `notifications/claude/channel` message AND a `notifications/claude/channel/permission` verdict. A non-allowed user could also potentially send a verdict if the branching happens before the allowlist check.
- fix: (1) Make mutual exclusivity explicit: if `parsePermissionReply()` matches, send the verdict notification and `return` — do not forward as a channel notification. (2) Either move verdict parsing into `server.ts`'s `onMessage` implementation, or add a second callback `onPermissionVerdict: (verdict: PermissionVerdict) => void` to `createSlackClient`. (3) Add a test asserting that a verdict message from a non-allowed user is ignored.

**H2: Permission request threading breaks the ThreadTracker model**
- severity: high
- blocking: yes
- file: docs/implementation-plan.md:978-988 (Task 7, permission request handler)
- lens: Architecture, Backend/Data, Product
- what: The permission request handler posts to Slack without a `thread_ts` (top-level), then calls `tracker.startThread(result.ts)` — but this abandons any prior conversation thread and anchors the tracker to the permission prompt rather than the original command. The prose at line 948 also says "as a threaded message" which contradicts the code.
- why: An implementer following this code will break the thread model for the common case: user sends command → Claude asks for permission → user replies `yes xxxxx`. The user's natural instinct is to reply in the original command thread, but the tracker's `activeThreadTs` now points to the permission prompt, so `classifyMessage` returns `new_input` instead of `thread_reply`.
- fix: Specify whether permission prompts should be posted in-thread (pass `tracker.activeThreadTs` as `thread_ts`) or top-level (document that this abandons the prior thread). Also remove the contradictory "threaded message" prose at line 948 if top-level is intended.

**H3: Module-scope dedup Set shared across all instances and tests**
- severity: high
- blocking: yes
- file: docs/implementation-plan.md:554-563 (Task 3, `recentTs` / `isDuplicate`)
- lens: Architecture, Backend/Data
- what: `recentTs` and `isDuplicate` are module-level singletons in `slack-client.ts`. All `createSlackClient` instances and all test files that import the module share one global dedup Set.
- why: Tests using the same `ts` value will see cross-contamination. In production, a second `createSlackClient` call (reconnect scenario) shares stale state. The function is not exported, making it untestable as specified.
- fix: Move `recentTs` inside `createSlackClient`'s closure (or accept it as a constructor parameter). Export `isDuplicate` as a standalone function accepting the Set for direct unit testing.

**H4: config.test.ts is an empty stub with zero assertions**
- severity: high
- blocking: yes
- file: docs/implementation-plan.md:307-319 (Task 2, config.test.ts)
- lens: Architecture, Testing, Product
- what: The test body is empty — `it('parses valid environment variables', () => { /* nothing */ })`. It passes trivially without exercising `parseConfig` at all. Additionally, `parseConfig` calls `process.exit(1)` on failure, making error paths untestable without guidance.
- why: CI shows green for config validation even if the Zod schema, token prefix checks, or user ID regex are completely wrong. Six distinct validation paths are never exercised.
- fix: (1) Add happy-path test: call `parseConfig` with valid env, assert returned shape. (2) Add negative tests using `spyOn(process, 'exit')` for bad token prefix, invalid user ID format, missing required field. (3) Consider making `parseConfig` throw `ConfigurationError` instead of calling `process.exit(1)`, with the CLI entry point catching it.

**H5: Reply tool calls tracker.startThread on every top-level reply**
- severity: high
- blocking: yes
- file: docs/implementation-plan.md:1003-1005 (Task 7, reply tool handler)
- lens: Backend/Data
- what: The reply tool handler calls `tracker.startThread(result.ts)` whenever `!threadTs`, starting a thread for every top-level reply from Claude — including status updates, completion messages, etc., not just questions.
- why: If Claude sends "Task complete" as a top-level reply, the tracker anchors to that message. The user's next message is then misclassified relative to the intended interaction model where only questions start threads.
- fix: Clarify whether `startThread` should be called on every top-level reply or only for question threads. If only questions: add a `startThread` flag to the reply tool's input schema so Claude can signal intent, or document that the application logic controls this.

**H6: engines.bun >= 1.1.0 but text lockfile requires >= 1.2.0**
- severity: high
- blocking: yes
- file: docs/implementation-plan.md:62-63 (Task 1, package.json)
- lens: DevOps/Deployment
- what: `"engines": { "bun": ">=1.1.0" }` but `saveTextLockfile = true` requires Bun 1.2+. Research doc explicitly states "Bun 1.2+ fully supports text lockfiles."
- why: An implementer installing Bun 1.1.x per the engines constraint gets `bun.lockb` instead of `bun.lock`, causing `bun install --frozen-lockfile` in CI to fail.
- fix: Change to `"bun": ">=1.2.0"` in docs/implementation-plan.md:62-63.

**H7: package.json missing `files` field and `prepublishOnly` script**
- severity: high
- blocking: yes
- file: docs/implementation-plan.md:52-76 (Task 1, package.json)
- lens: DevOps/Deployment
- what: No `"files"` field — `npm publish` uploads everything including `docs/`, `.github/`, `coverage/`. No `"prepublishOnly"` script — the safety net that runs typecheck + test before publish. Both are specified in the research doc (typescript-bun-setup-research.md:546-561) but missing from the plan.
- why: Published package is bloated with dev artifacts. Broken code can reach npm without running tests first.
- fix: Add `"files": ["src", "README.md", "LICENSE"]` and `"prepublishOnly": "bunx tsc --noEmit && bun test"` to the package.json spec.

**H8: No release.yml task in the implementation plan**
- severity: high
- blocking: yes
- file: docs/implementation-plan.md (missing task)
- lens: DevOps/Deployment
- what: The research doc specifies a complete `release.yml` workflow (tag-triggered GitHub Release + npm publish) at typescript-bun-setup-research.md:564-592, but the implementation plan has no task to create it.
- why: An implementer following the plan task-by-task will have CI but no automated release pipeline. npm publishes would be manual and could bypass test gates.
- fix: Add a Task 9b (or extend Task 9) to create `.github/workflows/release.yml` using the workflow from the research doc.

---

### Medium Findings

**M1: formatPermissionRequest vulnerable to triple-backtick injection in input_preview**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:814 (Task 5)
- lens: Security
- what: `input_preview` is interpolated into a Slack mrkdwn code block using triple backticks. If `input_preview` contains triple backticks, the code fence closes early, allowing the rest to render as formatted text that could visually mimic the "Reply `yes abcde`" instruction.
- why: Claude's tool inputs can contain arbitrary content. An operator reading the formatted message might approve a misleading request.
- fix: Sanitize `input_preview` — replace triple backtick occurrences with a placeholder like `[backticks redacted]`. Add a test case.

**M2: .gitignore missing .env.* variants**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:179-187 (Task 1)
- lens: Security
- what: `.gitignore` excludes `.env` but not `.env.local`, `.env.production`, etc.
- why: Contributors often create environment-specific files with real credentials.
- fix: Add `.env.*` to the `.gitignore` spec.

**M3: PermissionRequestSchema has input_preview as required, but protocol may not guarantee it**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:974 (Task 7)
- lens: Architecture
- what: `input_preview: z.string()` is required. If Claude Code omits it, Zod fails silently and the permission request is dropped.
- why: A dropped permission request leaves Claude waiting indefinitely.
- fix: Change to `z.string().optional().default('')`.

**M4: server.test.ts only asserts server is defined, not capabilities**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:293-304 (Task 2)
- lens: Testing
- what: `expect(server).toBeDefined()` cannot catch a missing `claude/channel` or `claude/channel/permission` capability.
- why: Omitting a capability causes Claude Code to silently not deliver notifications.
- fix: Assert that both experimental capabilities are present in the returned server object.

**M5: formatInboundNotification has no test for `source` field**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:625-672 (Task 4)
- lens: Testing
- what: The Channel protocol requires a `source` field. CLAUDE.md references `<channel source="slack" ...>` tags. No test checks for it.
- why: If source is missing, Claude may not recognize the notification.
- fix: Verify whether `source` is a field in `ChannelNotificationParams`; if so, add assertion `expect(result.source).toBe('slack')`.

**M6: isDuplicate is never tested and not exported**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:558-563 (Task 3)
- lens: Testing
- what: No test exercises the dedup logic. The function is not exported. Deduplication was research Gap 8.
- why: Broken dedup causes Claude to receive duplicate messages on reconnect churn.
- fix: Export and test: first call returns false, second with same ts returns true, after TTL expires returns false again.

**M7: shouldProcessMessage missing combined bot_id + subtype test**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:467-487 (Task 3)
- lens: Testing
- what: Tests check bot_id and subtype individually but never together. The dual-check is research Gap 5.
- why: A refactor removing one check would still pass all tests.
- fix: Add explicit test for the Bolt SDK gap scenario: message with `bot_id` but no `subtype` is rejected.

**M8: Task 10 references projects.yaml that doesn't exist**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:1288 (Task 10)
- lens: Product
- what: `examples/multi-project-vm.md` covers "tmux, systemd, projects.yaml, multiple channels" but the project is single-channel and `projects.yaml` is never specified.
- why: An implementer will invent a schema that has no basis in the codebase, creating docs for an unprovided feature.
- fix: Scope the example to "run one process per channel with separate env files" which matches the architecture.

**M9: Task 8 missing startup failure test cases**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:1143-1153 (Task 8)
- lens: Product
- what: No checklist items for invalid tokens, missing env vars, or bot-not-in-channel scenarios.
- why: These are the most common first-run failures. Without testing error messages, the first-run experience is unverified.
- fix: Add checklist items: start with missing token → legible error, start with bot not invited → legible error, invalid user ID → legible error.

**M10: CI coverage reporter inconsistency**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:1197 (Task 9)
- lens: DevOps/Deployment
- what: CI runs `bun test --coverage` without `--coverage-reporter=lcov`. Research doc specifies lcov + Codecov upload.
- why: Coverage output disappears after CI job. No tracking over time.
- fix: Add `--coverage-reporter=lcov` and Codecov upload step, or explicitly note the omission is intentional for v0.x.

**M11: Task 10 missing CONTRIBUTING.md and community health files**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:1210-1215 (Task 10)
- lens: Product
- what: Task 10 omits CONTRIBUTING.md, CHANGELOG.md, and .github/ issue/PR templates despite the research doc identifying them as essential.
- why: Publishing without CONTRIBUTING.md signals an unmaintained project.
- fix: Add CONTRIBUTING.md, CHANGELOG.md, and .github/ISSUE_TEMPLATE/bug_report.md to Task 10.

**M12: Task 2/7 shutdown handler duplication risk**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:404-418 and 1017-1027
- lens: Product
- what: Task 2 creates a shutdown handler without `socketMode.disconnect()`. Task 7 provides a replacement but doesn't explicitly say to remove Task 2's handler.
- why: An implementer could end up with two SIGTERM handlers, or preserve the incomplete Task 2 version.
- fix: Add a note in Task 7 Step 1: "Remove the shutdown handler from Task 2 and replace it with this version."

**M13: Biome schema version pinning gap**
- severity: medium
- blocking: no
- file: docs/implementation-plan.md:134 (Task 1)
- lens: Product
- what: `biome.json` pins schema to 2.4.9 but `bun add -d --exact @biomejs/biome` installs whatever is latest.
- why: Version drift causes spurious schema validation warnings.
- fix: Pin install version: `bun add -d --exact @biomejs/biome@2.4.9`.

---

### Low Findings

**L1: ALLOWED_USER_IDS edge case — commas-only input produces empty array**
- severity: low
- blocking: no
- file: docs/implementation-plan.md:251-252
- lens: Security
- what: `","` passes `.min(1)` on the string, then `.filter(Boolean)` produces an empty array. The per-ID loop silently passes over empty arrays.
- fix: Add `.refine(arr => arr.length > 0, ...)` after the transform.

**L2: .mcp.json example shows inline tokens without warning**
- severity: low
- blocking: no
- file: docs/implementation-plan.md:1112-1128
- lens: Security, DevOps/Deployment
- what: Example shows real-looking token placeholders inline. No warning about not committing this file with real values.
- fix: Add a caution note about not committing .mcp.json with real tokens.

**L3: Internal PPMC repo reference in published plan**
- severity: low
- blocking: no
- file: docs/implementation-plan.md:11
- lens: Product
- what: References `ppmc/docs/plans/2026-03-26-automation-vm-design.md` — a private internal document.
- fix: Remove or replace with inline context summary before publishing.

**L4: parsePermissionReply missing boundary-length tests**
- severity: low
- blocking: no
- file: docs/implementation-plan.md:756-764
- lens: Testing
- what: No tests for 4-char or 6-char IDs (wrong length). A future change to `{5}` quantifier wouldn't be caught.
- fix: Add `parsePermissionReply('yes abcd')` → null and `parsePermissionReply('yes abcdef')` → null.

---

### Structural Patterns

#### Pattern: Missing Integration Seams

**Symptoms:** C1 (no notification code), H1 (verdict/forwarding ambiguity), H2 (permission threading conflict), H5 (startThread on every reply)
**Root cause:** The plan specifies individual modules with clear unit-level interfaces but leaves the integration surface (Task 7) as prose + partial snippets rather than complete code. The modules are well-designed in isolation; the problems emerge at their connection points.
**Instance-level fix:** Add code snippets and explicit branching logic to Task 7 for each integration point.
**Structural fix:** Write Task 7 as a complete, copy-pasteable `server.ts` file (like Tasks 2-6 do for their respective modules) rather than a collection of code fragments with prose transitions. This eliminates ambiguity about ordering, branching, and mutual exclusivity.
**Recommendation:** USE THE STRUCTURAL FIX. The individual module specs are solid — the risk is entirely in how they're wired together. A complete integration file is the most direct way to eliminate all four findings simultaneously.

#### Pattern: Research-to-Plan Drift

**Symptoms:** H6 (engines.bun version), H7 (files/prepublishOnly), H8 (release.yml), M10 (coverage reporter), M11 (community health files)
**Root cause:** The research docs are thorough and correct, but several of their recommendations were not carried into the implementation plan's task list. The plan was likely written first, then the research was done and applied to update existing tasks, but new tasks implied by the research (release workflow, community files) were not added.
**Instance-level fix:** Update each affected task individually.
**Structural fix:** Add a reconciliation checklist at the end of the plan that cross-references every actionable item in the research synthesis against a plan task. Items without a corresponding task get added.
**Recommendation:** Instance fixes are sufficient because this is a one-time plan update, not a recurring process. Fix each item and move on.

---

### Proposed Action Plan

#### Grouping 1: Fix Task 7 Integration Spec
- Goal: Eliminate all integration ambiguity by completing the Task 7 specification
- Findings addressed:
  - C1: Missing server.notification() code (critical)
  - H1: Permission verdict flow ambiguity (high)
  - H2: Permission request threading conflict (high)
  - H5: Reply tool startThread on every reply (high)
  - M12: Shutdown handler duplication (medium)
- Fix approach: Structural — rewrite Task 7 as a complete `server.ts` file rather than prose + fragments. Include explicit branching for verdict vs. channel notification, threading decisions for permission prompts, and startThread semantics.
- Scope: docs/implementation-plan.md Task 7 (lines 935-1058)
- Effort: medium
- Dependencies: None

#### Grouping 2: Fix Error Handling
- Goal: Ensure fatal errors terminate the process
- Findings addressed:
  - C2: uncaughtException/unhandledRejection handlers don't exit (critical)
- Fix approach: Instance fixes — add `process.exit(1)` to both handlers.
- Scope: docs/implementation-plan.md Task 2 (lines 390-395)
- Effort: small
- Dependencies: None

#### Grouping 3: Fix Testability Issues
- Goal: Make all critical paths testable and tested
- Findings addressed:
  - H3: Module-scope dedup Set (high)
  - H4: Empty config.test.ts (high)
  - M4: server.test.ts only checks defined (medium)
  - M5: Missing source field test (medium)
  - M6: isDuplicate untested (medium)
  - M7: Missing combined bot_id+subtype test (medium)
  - L4: Missing boundary-length tests (low)
- Fix approach: Instance fixes — move dedup into closure, populate test stubs, add missing test cases.
- Scope: docs/implementation-plan.md Tasks 2-6 (test sections)
- Effort: medium
- Dependencies: None

#### Grouping 4: Fix DevOps/Publishing Gaps
- Goal: Ensure the package can be published correctly with CI gates
- Findings addressed:
  - H6: engines.bun version constraint (high)
  - H7: Missing files field and prepublishOnly (high)
  - H8: Missing release.yml task (high)
  - M10: CI coverage reporter (medium)
  - M13: Biome version pinning (medium)
- Fix approach: Instance fixes — update package.json spec, add release.yml task, fix version constraints.
- Scope: docs/implementation-plan.md Tasks 1 and 9
- Effort: small
- Dependencies: None

#### Grouping 5: Fix Security Hardening Gaps
- Goal: Close remaining security gaps in the spec
- Findings addressed:
  - M1: Triple-backtick injection in input_preview (medium)
  - M2: .gitignore missing .env.* (medium)
  - M3: input_preview required vs optional (medium)
  - L1: ALLOWED_USER_IDS empty array edge case (low)
  - L2: .mcp.json inline tokens warning (low)
- Fix approach: Instance fixes — sanitize input_preview, expand .gitignore, make input_preview optional, add refine check.
- Scope: docs/implementation-plan.md Tasks 1, 5, 7
- Effort: small
- Dependencies: None

#### Grouping 6: Fix Documentation Gaps
- Goal: Complete the open-source project documentation spec
- Findings addressed:
  - M8: projects.yaml reference in multi-project example (medium)
  - M9: Missing startup failure test cases (medium)
  - M11: Missing CONTRIBUTING.md and community files (medium)
  - L3: Private PPMC repo reference (low)
- Fix approach: Instance fixes — scope multi-project example, add checklist items, add community file tasks.
- Scope: docs/implementation-plan.md Tasks 8 and 10
- Effort: small
- Dependencies: None
