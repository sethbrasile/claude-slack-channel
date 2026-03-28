# Phase 13: Documentation — Content Polish - Research

**Researched:** 2026-03-28
**Domain:** Markdown documentation editing (README.md, CHANGELOG.md, slack-app-manifest.yaml, examples/basic-setup.md, tsconfig.json)
**Confidence:** HIGH

## Summary

This is a pure documentation-polish phase. Every change is a targeted text edit to existing files — no code changes, no library research needed. The deep review (2026-03-28) identified seven concrete findings (M21, M22, M23, M24, L6, L13, L14) that together constitute Grouping 5: Documentation — Content Polish. All findings have unambiguous "before" and "after" states that can be read directly from the existing files.

Phase 12 (Documentation — Setup Flow & Consistency) already completed, which means all structural doc changes are in place. This phase is purely additive polish: rewriting one opening paragraph, updating one configuration table row, fixing one "What's next" snippet, editing CHANGELOG.md metadata, adding two YAML comments, and adding one JSON comment to tsconfig.json.

The work is small in scope (five files, approximately 15 targeted line edits) and HIGH confidence because the current state of each file is fully readable and each finding prescribes the exact change needed.

**Primary recommendation:** Execute each finding as its own discrete edit to a specific file and line range. There is no architectural decision to make — just faithful execution of the seven findings.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| M22 | Rewrite README.md opening paragraph to define "Socket Mode" and "MCP server" before using them | Current text at README.md:8 uses both terms without definition; parenthetical definitions resolve this |
| M21 | Fix `{id}` placeholder syntax in basic-setup.md "What's next" and lead with button interaction | basic-setup.md:122 uses `{id}` while README uses `a1b2c`; also omits mention of Approve/Deny buttons |
| M23 | Add "Appears as the MCP server name in Claude's tool list" to SERVER_NAME description in README | README.md:172 config table row is missing this context |
| M24 | Add explanatory note about same-day dates, diff link footer, and audience scope for Breaking Changes in CHANGELOG.md | All three versions dated 2026-03-27; [Unreleased] has no diff link; 0.2.0 Breaking Changes section doesn't qualify who is affected |
| L6 | Add comment in slack-app-manifest.yaml noting that `channels:history` and `groups:history` scopes are workspace-wide | slack-app-manifest.yaml:32-34 lists scopes without noting the scope breadth |
| L13 | Add inline comment in tsconfig.json explaining why `skipLibCheck: true` is set | tsconfig.json:13 has the flag with no explanation; TypeScript/Bun both parse tsconfig as JSONC so `//` comments are safe |
| L14 | Add Socket Mode comment to the `interactivity` section in slack-app-manifest.yaml | slack-app-manifest.yaml:41-42 has `is_enabled: true` comment about buttons but no note that Socket Mode requires interactivity enabled |
</phase_requirements>

---

## Standard Stack

Not applicable. This phase requires no library installation or code changes. All edits are plain text in Markdown, YAML, and JSON files.

---

## Architecture Patterns

### Files Touched

```
README.md                        # M22, M23 — opening paragraph + config table
CHANGELOG.md                     # M24 — dates note, diff links, audience scope
examples/basic-setup.md          # M21 — "What's next" section
slack-app-manifest.yaml          # L6, L14 — scope breadth comment, interactivity comment
tsconfig.json                    # L13 — skipLibCheck explanation
```

### Pattern: Surgical Line Edits

Each finding maps to a specific location. No section restructuring is required (Phase 12 already did that). The planner should create one task per file to batch all edits to that file together.

### Current State Reference (what the planner needs to know)

**M22 — README.md opening paragraph (lines 8-9):**

Current text:
```
An MCP server that bridges Claude Code sessions to a Slack channel via Socket Mode. Claude receives
commands from Slack, replies in threads, and posts permission prompts that operators approve or
deny — all from their phone if they want to. No webhooks, no public URLs, no port forwarding.
```

The terms "Socket Mode" and "MCP server" need parenthetical definitions. A lightweight inline approach: "An MCP server (a tool-plugin process that Claude Code loads on startup) that bridges Claude Code sessions to a Slack channel via Socket Mode (a WebSocket connection — no public URL required)."

**M21 — basic-setup.md "What's next" (line 122):**

Current text:
```
- To approve or deny a tool call from Slack, reply `yes {id}` or `no {id}` in the active thread when a permission request appears.
```

Two problems: (1) `{id}` is a template placeholder, while README uses the concrete example `a1b2c`. (2) The sentence describes only the text fallback, not the primary button interaction. Fix: lead with buttons, use `a1b2c` as the example ID, keep text fallback as secondary.

**M23 — README.md config table SERVER_NAME row (line 172):**

Current text:
```
| `SERVER_NAME` | No | Identifier in Claude's context. Defaults to `slack`. Useful when running multiple instances. |
```

Missing: where the name appears. Add "Appears as the MCP server name in Claude's tool list."

**M24 — CHANGELOG.md:**

Three issues:
1. All versions (0.1.0, 0.2.0, 0.3.0) are dated 2026-03-27 with no explanation. Add a note near the top (after the format/semver lines): "These versions were developed and released on the same day during initial build. Dates reflect the initial publish date."
2. `[Unreleased]` section has no diff link footer. Keep a Changelog convention: add a footer section at the bottom with diff links like `[Unreleased]: https://github.com/sethbrasile/claude-slack-channel/compare/v0.3.0...HEAD` and similar for each tagged version.
3. The Breaking Changes section in 0.2.0 does not clarify that these break library consumers (not CLI users). The `createServer()` signature change and `isDuplicate()` removal only matter if you import the package programmatically. Add a qualifier: "These affect library consumers only (code that imports `createServer` directly). CLI users running via `bunx` are unaffected."

**L6 — slack-app-manifest.yaml scope breadth (lines 32-34):**

Current:
```yaml
      - channels:history  # receive message events from public channels
      - groups:history    # receive message events from private channels
```

Add a note that these scopes are workspace-wide (not scoped to a single channel), so the bot can technically read message events from any channel it's in — not just the configured `SLACK_CHANNEL_ID`. The server filters by channel ID in code. The comment should document this so operators understand the security surface.

**L14 — slack-app-manifest.yaml interactivity section (lines 41-42):**

Current:
```yaml
  interactivity:
    is_enabled: true      # required for Approve/Deny buttons on permission requests
```

The comment explains why interactivity is enabled, but doesn't mention the Socket Mode dependency. Add: also required for Socket Mode to receive interactive payload events.

**L13 — tsconfig.json skipLibCheck (line 13):**

Confirmed current state (file verified):
```json
"skipLibCheck": true,
```

The file has no existing comments — it is pure JSON. TypeScript (and Bun) parse `tsconfig.json` as JSONC, meaning `//` comments are accepted even though the file extension is `.json`. Adding a comment is safe. The explanation to add: `skipLibCheck` suppresses type errors in `.d.ts` files from dependencies, which is standard in Bun projects because some third-party type declarations are incompatible with strict mode settings.

### Anti-Patterns to Avoid

- **Over-editing:** Don't rewrite sections that are not listed in the findings. Phase 12 already restructured Setup Flow — no structural changes belong here.
- **Inventing new content:** Each fix has a prescribed outcome in the deep review. Don't add troubleshooting entries, new sections, or material not specified in the findings.
- **Touching code files:** This phase is documentation and config comments only.

---

## Don't Hand-Roll

Not applicable. No code or tooling decisions needed.

---

## Common Pitfalls

### Pitfall 1: tsconfig.json is JSON but TypeScript parses it as JSONC

**What goes wrong:** A developer unfamiliar with TypeScript's tsconfig parsing might refuse to add `//` comments to a `.json` file because standard JSON doesn't support comments.

**Resolution (verified):** The tsconfig.json in this project has zero existing comments. However, TypeScript's own parser and Bun both treat `tsconfig.json` as JSONC — `//` line comments are accepted. This is documented TypeScript behavior and is consistent across all TypeScript versions in active use. Adding a `// ...` comment above `skipLibCheck` is safe.

**Warning signs:** If a linter reports "invalid JSON" on the tsconfig, the fix is to rename to `tsconfig.jsonc` — but that is not expected given how widespread this practice is.

### Pitfall 2: Keep a Changelog diff link footer format

**What goes wrong:** The footer link format for Keep a Changelog is specific: the `[Unreleased]` label must appear as a reference-style link at the bottom of the file, with the GitHub compare URL. Getting the format wrong means Markdown renderers won't turn them into clickable links.

**How to avoid:** The correct format is:
```markdown
[Unreleased]: https://github.com/sethbrasile/claude-slack-channel/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/sethbrasile/claude-slack-channel/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/sethbrasile/claude-slack-channel/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/sethbrasile/claude-slack-channel/releases/tag/v0.1.0
```
These go at the very end of CHANGELOG.md after all version entries.

### Pitfall 3: Breaking Changes audience scope — don't over-qualify

**What goes wrong:** Adding a long disclaimer around every breaking change creates noise. The finding asks for a single qualifier scoped to the entire section, not per-item annotations.

**How to avoid:** Add one sentence at the start of the Breaking Changes section in 0.2.0: "These changes affect library consumers only (code that imports from `claude-slack-channel` directly). CLI users running via `bunx` are unaffected."

### Pitfall 4: The `{id}` placeholder vs `a1b2c` example

**What goes wrong:** Using `{id}` in documentation looks like a template that wasn't filled in, while `a1b2c` reads like a real example. They must be consistent across the README and examples.

**How to avoid:** README.md already uses `a1b2c` throughout the permission relay section (verified at lines 143-149). Match that in basic-setup.md line 122.

---

## Code Examples

### M24 — CHANGELOG.md diff link footer

```markdown
[Unreleased]: https://github.com/sethbrasile/claude-slack-channel/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/sethbrasile/claude-slack-channel/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/sethbrasile/claude-slack-channel/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/sethbrasile/claude-slack-channel/releases/tag/v0.1.0
```

### M21 — basic-setup.md "What's next" replacement

```markdown
## What's next

- When a permission request appears, click **Approve** or **Deny** in-thread. Or reply `yes a1b2c` / `no a1b2c` (replace `a1b2c` with the request ID shown in the prompt) as a text fallback.
- For running Claude Code on multiple projects from a shared VM, see [examples/multi-project-vm.md](./multi-project-vm.md).
```

### L6 — slack-app-manifest.yaml scope comment

```yaml
      # NOTE: channels:history and groups:history grant workspace-wide read access to
      # message events in any channel the bot joins — not scoped to SLACK_CHANNEL_ID alone.
      # The server filters by SLACK_CHANNEL_ID in code. Review before granting to
      # shared workspaces with sensitive channels.
      - channels:history  # receive message events from public channels
      - groups:history    # receive message events from private channels
```

### L14 — slack-app-manifest.yaml interactivity comment

```yaml
  interactivity:
    is_enabled: true      # required for Approve/Deny buttons; also required for Socket Mode
                          # to receive interactive payload events (button clicks)
```

### L13 — tsconfig.json skipLibCheck comment

```jsonc
// suppresses type errors in .d.ts files from dependencies; needed because some
// third-party type declarations are incompatible with strict mode settings
"skipLibCheck": true,
```

### M22 — README.md opening paragraph suggestion

```markdown
An MCP server (a tool-plugin process that Claude Code loads on startup) that bridges Claude Code
sessions to a Slack channel via Socket Mode (a WebSocket connection — no public URL required).
Claude receives commands from Slack, replies in threads, and posts permission prompts that
operators approve or deny — all from their phone if they want to. No webhooks, no public URLs,
no port forwarding.
```

### M23 — README.md SERVER_NAME description

```
| `SERVER_NAME` | No | Appears as the MCP server name in Claude's tool list. Defaults to `slack`. Useful when running multiple instances. |
```

---

## State of the Art

Not applicable — no library research required for doc-only edits.

---

## Open Questions

None. All findings have been verified against the current file state.

The only pre-research uncertainty was whether tsconfig.json already used comments (resolved: it does not, but JSONC comments are safe to add).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | package.json `"test": "bun test"` |
| Quick run command | `bun test` |
| Full suite command | `bun test --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| M22 | README opening paragraph updated | manual-only | N/A — doc review | N/A |
| M21 | basic-setup.md "What's next" updated | manual-only | N/A — doc review | N/A |
| M23 | SERVER_NAME description updated | manual-only | N/A — doc review | N/A |
| M24 | CHANGELOG.md dates note + diff links + audience scope | manual-only | N/A — doc review | N/A |
| L6 | Manifest scope breadth comment added | manual-only | N/A — doc review | N/A |
| L13 | tsconfig.json skipLibCheck comment added | manual-only | N/A — doc review | N/A |
| L14 | Manifest interactivity Socket Mode comment added | manual-only | N/A — doc review | N/A |

All phase requirements are documentation and comment changes — no automated test coverage is possible. Verification is manual review of each file after editing.

The existing test suite must remain green after edits. Since no TypeScript source files are touched, this is trivially guaranteed — but run it anyway as a gate:

```bash
bun test
bunx tsc --noEmit
bunx biome check .
```

### Sampling Rate

- **Per task commit:** `bun test` (sanity check — no code changed)
- **Per wave merge:** `bun test --coverage`
- **Phase gate:** `bun test` green + manual verification of all 7 findings before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. No new test files needed.

---

## Sources

### Primary (HIGH confidence)

- Direct file reads of README.md, CHANGELOG.md, slack-app-manifest.yaml, examples/basic-setup.md, tsconfig.json — current state verified line by line
- `.planning/reviews/2026-03-28-deep-review.md` — findings M21, M22, M23, M24, L6, L13, L14 read verbatim

### Secondary (MEDIUM confidence)

- Keep a Changelog format: https://keepachangelog.com/en/1.0.0/ — diff link footer format is a well-established convention
- TypeScript JSONC support for tsconfig.json — standard documented behavior; TypeScript's own handbook notes this

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Findings scope: HIGH — all seven findings read directly from deep-review and cross-checked against current file content
- Edit prescription: HIGH — each finding states what to change; no design decisions required
- CHANGELOG diff link format: MEDIUM — standard Keep a Changelog pattern; format verified from keepachangelog.com documentation

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable; doc content doesn't change until next release)
