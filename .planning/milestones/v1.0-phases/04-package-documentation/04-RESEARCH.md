# Phase 4: Package + Documentation - Research

**Researched:** 2026-03-26
**Domain:** npm packaging (Bun runtime), Slack app manifests, open-source documentation conventions
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCS-01 | README covers quick start, configuration, threading, permission relay, and comparison with community implementation | README structure, community impl comparison content (docs/research-synthesis.md) |
| DOCS-02 | Slack app manifest (`slack-app-manifest.yaml`) ships in repo for reproducible setup | Slack manifest YAML schema research, required scopes identified |
| DOCS-03 | `.env.example` documents all required and optional env vars | Config schema (src/config.ts) enumerates all 5 vars |
| DOCS-04 | CONTRIBUTING.md covers dev setup, testing, linting, and PR process | Community best practices, project-specific Bun toolchain |
| DOCS-05 | CHANGELOG.md initialized with Keep a Changelog format | Keep a Changelog 1.0.0 format confirmed |
| DOCS-06 | `examples/basic-setup.md` walks through single-project setup | End-to-end operator flow documented from architecture knowledge |
| DOCS-07 | `examples/multi-project-vm.md` covers multi-channel reference architecture | Multi-channel pattern identified via architecture constraints |
| DOCS-08 | Bug report issue template with version fields and token redaction reminder | GitHub YAML issue form schema confirmed |
| DOCS-09 | MIT LICENSE file included | Standard MIT text, no special work needed |
| DOCS-10 | `package.json` configured with `bin`, `files`, `engines`, and npm publish scripts | Already implemented in current package.json — VERIFY only |
</phase_requirements>

---

## Summary

Phase 4 is a pure documentation and packaging phase. All server code is complete. The deliverables are files that ship with the package — README, examples, CONTRIBUTING, CHANGELOG, LICENSE, Slack manifest, .env.example, issue template — plus verification that `package.json` is already correctly configured.

The central technical question for this phase is **npx compatibility with a Bun-first package**. The current `package.json` points `bin` at `src/server.ts` (a `.ts` file). This works for `bunx` but silently fails for `npx` (Node.js users). Since DOCS-10 requires "npx claude-slack-channel runs the server", the plan must address whether to stay bunx-only (and document it clearly) or add a compiled entry point. Research finding: stay bunx-only and document it prominently, because the package requires Bun runtime anyway (no Node.js build step exists, no `dist/` is generated). The README must make this clear at the top.

The Slack app manifest is straightforward — it is a YAML file listing all required OAuth scopes and Socket Mode settings. The scopes for this package are minimal: `chat:write` (bot token, for posting) and `channels:history` (bot token, for reading channel events via Socket Mode). The app-level token needs only `connections:write`. No user scopes are needed.

**Primary recommendation:** Write all documentation files directly (no external tools needed), confirm `package.json` already satisfies DOCS-10, and make the Bun-only constraint visible in docs rather than engineering around it.

---

## Standard Stack

### Core
| Library/Format | Purpose | Why Standard |
|---------------|---------|--------------|
| Slack app manifest YAML | Reproducible Slack app setup | Official Slack API feature; YAML or JSON both supported |
| Keep a Changelog 1.0.0 | CHANGELOG format | Widely adopted, human-readable, well-understood by contributors |
| GitHub YAML issue forms | Bug report template | Renders as structured form, forces required fields |
| MIT LICENSE | Open-source license | Specified in project requirements; already in `package.json "license": "MIT"` |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `bun run src/server.ts` | Local dev run command | Used in .env.example and README quick-start |
| `bunx claude-slack-channel` | Package invocation (recommended) | Primary invocation method; requires Bun on host |
| `npx claude-slack-channel` | Package invocation (unsupported) | Will fail — bin points to .ts file; document clearly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bunx-only entry point | Compile to JS for npx | Adds build step, dist/ dir, CI complexity; out of scope for v1 |
| YAML issue form | Markdown issue template | Form is newer, better UX, forces structured data |

---

## Architecture Patterns

### Recommended Project Structure (after Phase 4)
```
.
├── examples/
│   ├── basic-setup.md           # DOCS-06: single project walkthrough
│   └── multi-project-vm.md      # DOCS-07: multi-channel VM architecture
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── bug-report.yml       # DOCS-08: structured bug report form
│   └── workflows/
│       ├── ci.yml               # already exists
│       └── release.yml          # already exists
├── src/                         # already complete
├── CHANGELOG.md                 # DOCS-05
├── CLAUDE.md                    # already exists
├── CONTRIBUTING.md              # DOCS-04
├── LICENSE                      # DOCS-09
├── README.md                    # DOCS-01
├── slack-app-manifest.yaml      # DOCS-02
└── .env.example                 # DOCS-03
```

### Pattern 1: Slack App Manifest (YAML)
**What:** YAML file that operators paste into api.slack.com to create a preconfigured Slack app
**When to use:** Whenever users need to create a Slack app from scratch; eliminates 15+ manual config steps
**Required fields:**
```yaml
# Source: https://docs.slack.dev/reference/app-manifest/
_metadata:
  major_version: 2
  minor_version: 1
display_information:
  name: Claude Slack Channel
  description: MCP bridge for Claude Code automation pipelines
features:
  bot_user:
    display_name: Claude
    always_online: true
oauth_config:
  scopes:
    bot:
      - chat:write        # post messages as the bot
      - channels:history  # receive message events from public channels
      - groups:history    # receive message events from private channels
settings:
  event_subscriptions:
    bot_events:
      - message.channels  # public channel messages
      - message.groups    # private channel messages
  socket_mode_enabled: true
  is_hosted: false
  token_rotation_enabled: false
```

**App-level token scopes** (set separately when enabling Socket Mode):
- `connections:write` — generates the WebSocket URI; required for Socket Mode

### Pattern 2: Keep a Changelog Initialization
**What:** CHANGELOG.md format used by major open-source projects
**Sections:** Added, Changed, Deprecated, Removed, Fixed, Security
**Example:**
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-03-26

### Added
- Initial release: MCP server bridging Claude Code to Slack via Socket Mode
- `reply` tool for outbound messages with thread support
- Permission relay for remote tool approval via Slack
- Thread state machine (ThreadTracker) for question/answer flows
- Configurable allowlist via ALLOWED_USER_IDS env var
- Zod config validation with field-level error messages
- GitHub Actions CI and npm publish workflows
```

### Pattern 3: GitHub YAML Issue Form
**What:** Structured form at `.github/ISSUE_TEMPLATE/bug-report.yml`
**Why YAML over Markdown:** Renders as a form with required fields, prevents incomplete bug reports
**Minimum required top-level keys:** `name`, `description`, `body`

```yaml
# Source: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms
name: Bug Report
description: Report a bug with claude-slack-channel
labels: ["bug"]
body:
  - type: input
    id: version
    attributes:
      label: Package version
      placeholder: "0.1.0"
    validations:
      required: true
  - type: textarea
    id: description
    attributes:
      label: What happened?
      placeholder: Describe the bug
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Relevant logs (stderr)
      description: "IMPORTANT: Remove or redact any Slack tokens before pasting"
      render: shell
  - type: checkboxes
    id: token_check
    attributes:
      label: Token redaction
      options:
        - label: "I have confirmed no xoxb-, xoxp-, or xapp- tokens appear in my report"
          required: true
```

### Pattern 4: .env.example
**What:** Documented env var template; operators copy to `.env` and fill in values
**All vars from src/config.ts:**
```bash
# Required: Bot token (starts with xoxb-)
SLACK_BOT_TOKEN=xoxb-your-bot-token-here

# Required: App-level token for Socket Mode (starts with xapp-)
SLACK_APP_TOKEN=xapp-your-app-token-here

# Required: Channel ID (e.g. C0XXXXXXXXX — find via right-click channel > Copy link)
SLACK_CHANNEL_ID=C0XXXXXXXXX

# Required: Comma-separated Slack user IDs allowed to send commands (e.g. U0XXXXXXXXX)
# Find via: Profile > ... > Copy member ID
ALLOWED_USER_IDS=U0XXXXXXXXX,U0YYYYYYYYY

# Optional: Identifier shown in Claude's context (default: slack)
# Use a project-specific name when running multiple instances
SERVER_NAME=slack
```

### Anti-Patterns to Avoid
- **Claiming `npx` works:** The `bin` field points to `src/server.ts`. Node.js cannot execute `.ts` files. Document `bunx` as the invocation method; mention `npx` only to warn it does NOT work.
- **Documenting multi-channel support:** Out of scope per REQUIREMENTS.md. `examples/multi-project-vm.md` should show *multiple MCP server instances* (one per channel per project), not a single instance handling multiple channels.
- **Excessive scope list in manifest:** Only include scopes the server actually uses. `channels:history` + `groups:history` (for private channels) + `chat:write`. Avoid listing unused scopes like `users:read` that aren't needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slack app creation instructions | Step-by-step prose instructions | `slack-app-manifest.yaml` | Manifest is paste-and-go; prose instructions drift and break |
| Token validation instructions | Custom format docs | Reference Zod schema in src/config.ts | It already documents the format; README can quote it |
| Changelog format | Custom format | Keep a Changelog 1.0.0 | Standard format contributors recognize immediately |
| Issue form validation | Markdown checklist | GitHub YAML issue form `validations: required: true` | Enforced at form submission, not post-hoc |

**Key insight:** Phase 4 produces text files. The "don't hand-roll" principle here means: don't invent custom conventions when well-known ones (Keep a Changelog, GitHub YAML forms, Slack manifests) exist and are better recognized by the community.

---

## Common Pitfalls

### Pitfall 1: Claiming npx support
**What goes wrong:** README says "npx claude-slack-channel" and it silently fails for Node.js users — Node cannot execute `.ts` files.
**Why it happens:** npm `bin` field convention typically points to compiled JS; this package points to source `.ts`.
**How to avoid:** State clearly: "Requires Bun runtime. Use `bunx claude-slack-channel` or `bun run src/server.ts`."
**Warning signs:** Any README section that says `npx` without qualification.

### Pitfall 2: Missing `groups:history` in manifest
**What goes wrong:** Bot cannot receive messages from private channels; operators get confused when the bot works in public channels but not private ones.
**Why it happens:** `channels:history` only covers public channels; `groups:history` covers private channels.
**How to avoid:** Include both `channels:history` and `groups:history` in the manifest.

### Pitfall 3: Documenting multi-channel as single instance
**What goes wrong:** `multi-project-vm.md` describes a single server managing multiple channels — which is not how this server works.
**Why it happens:** The word "multi-channel" is ambiguous.
**How to avoid:** `multi-project-vm.md` must show multiple *independent* server processes, each with its own `SLACK_CHANNEL_ID`. The "multi" refers to multiple Claude Code projects on a shared VM, each with its own MCP server process and Slack channel.

### Pitfall 4: Forgetting `always_online: true` for bot user
**What goes wrong:** Bot appears offline in Slack UI even when server is running, confusing operators.
**Why it happens:** Bot presence defaults to offline unless `always_online: true` is set.
**How to avoid:** Include `always_online: true` in the manifest `features.bot_user` section.

### Pitfall 5: CHANGELOG missing Unreleased section
**What goes wrong:** First release process fails because there's no `[Unreleased]` section to rename to `[0.1.0]`.
**Why it happens:** Incomplete initialization.
**How to avoid:** Always initialize CHANGELOG.md with both `## [Unreleased]` and `## [0.1.0]` sections.

---

## Code Examples

### package.json current state (DOCS-10 is already satisfied)
The current `package.json` (verified by reading the file) already has all required fields:
- `bin`: `{ "claude-slack-channel": "src/server.ts" }` — bunx entry point
- `files`: `["src", "!src/__tests__", "README.md", "LICENSE", "examples"]`
- `engines`: `{ "bun": ">=1.2.0" }`
- `scripts.prepublishOnly`: `"bunx tsc --noEmit && bun test"`

**DOCS-10 action:** Verify the current `package.json` is sufficient. The planner should NOT modify `package.json` — it already satisfies the requirement. The main concern is that `README.md` and `LICENSE` are listed in `files` but do not yet exist.

### Claude Code MCP configuration (for README quick-start)
```json
// .mcp.json
{
  "mcpServers": {
    "slack": {
      "command": "bunx",
      "args": ["claude-slack-channel"],
      "env": {
        "SLACK_CHANNEL_ID": "C0XXXXXXXXX",
        "SLACK_BOT_TOKEN": "xoxb-...",
        "SLACK_APP_TOKEN": "xapp-...",
        "ALLOWED_USER_IDS": "U0XXXXXXXXX"
      }
    }
  }
}
```

### CONTRIBUTING.md key sections
The CONTRIBUTING.md should include: prerequisites (Bun 1.2+), installation (`bun install`), test commands (`bun test`, `bun test --coverage`), type-check (`bunx tsc --noEmit`), lint (`bunx biome check .`, `bunx biome check --write .`), and a note that the PR process requires all CI checks to pass.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Markdown issue templates | GitHub YAML issue forms | YAML renders as a structured form, enforces required fields |
| Manual Slack app setup | Slack app manifest YAML | Paste manifest at api.slack.com/apps to create preconfigured app |
| `npx` for all JS packages | `bunx` for Bun-native packages | Bun packages with `.ts` entry points only work with `bunx` |

**Deprecated/outdated:**
- Markdown issue templates (`.md` in ISSUE_TEMPLATE): Still supported but YAML form is preferred for structured data collection.

---

## Open Questions

1. **Should the manifest include `groups:history` for private channels?**
   - What we know: The filter in `slack-client.ts` checks `event.channel !== filter.channelId` — it works regardless of channel type, but the bot only receives events for channels it has the right scope.
   - What's unclear: Does the bot token need `groups:history` if the operator only uses a public channel?
   - Recommendation: Include `groups:history` in the manifest anyway. It is harmless if the channel is public and prevents a confusing failure if the operator uses a private channel. Confidence: MEDIUM.

2. **Does `package.json` need a `publishConfig` field?**
   - What we know: The release workflow uses `npm publish --provenance --access public`.
   - What's unclear: Whether `--access public` in the CLI command is sufficient or whether `publishConfig.access: "public"` should also be in `package.json` for safety.
   - Recommendation: Add `"publishConfig": { "access": "public" }` to `package.json` as a belt-and-suspenders measure. Confidence: MEDIUM.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | none — Bun auto-discovers `__tests__/` and `*.test.ts` |
| Quick run command | `bun test` |
| Full suite command | `bun test --coverage` |

### Phase Requirements → Test Map

Phase 4 is documentation-only. No behavior is added that requires automated unit tests. All requirements produce static files (YAML, Markdown, JSON fragments) rather than runtime behavior. Validation is structural (file existence, key presence) not behavioral.

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| DOCS-01 | README exists with required sections | manual | — | Read file, verify sections |
| DOCS-02 | slack-app-manifest.yaml exists and parses | smoke | `bunx js-yaml slack-app-manifest.yaml` (optional) | Manual review of required keys |
| DOCS-03 | .env.example documents all 5 vars | manual | — | Cross-check against src/config.ts |
| DOCS-04 | CONTRIBUTING.md exists with required sections | manual | — | Read file |
| DOCS-05 | CHANGELOG.md has correct format | manual | — | Read file |
| DOCS-06 | examples/basic-setup.md exists | manual | — | Read file |
| DOCS-07 | examples/multi-project-vm.md exists | manual | — | Read file |
| DOCS-08 | .github/ISSUE_TEMPLATE/bug-report.yml parses | smoke | `cat` + visual check | GitHub validates on push |
| DOCS-09 | LICENSE exists and contains MIT text | manual | `grep -q "MIT" LICENSE` | Simple existence check |
| DOCS-10 | package.json has bin/files/engines | smoke | `bun run -e "const p=require('./package.json'); console.log(!!p.bin,!!p.files,!!p.engines)"` | Already satisfied |

### Sampling Rate
- **Per task commit:** `bun test` (existing tests must stay green — no regressions)
- **Per wave merge:** `bun test --coverage` + `bunx tsc --noEmit` + `bunx biome check .`
- **Phase gate:** All files exist, all DOCS-01–10 manually verified before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure (48 unit tests) covers all prior phases. Phase 4 adds no new runtime code, so no new test files are needed. The planner should confirm existing tests still pass after adding documentation files (no code impact expected).

---

## Sources

### Primary (HIGH confidence)
- Source files read directly: `src/server.ts`, `src/config.ts`, `src/slack-client.ts`, `package.json`, `docs/research-synthesis.md` — authoritative ground truth for what the server does
- [Keep a Changelog 1.0.0](https://keepachangelog.com/en/1.0.0/) — canonical changelog format
- [Slack App Manifest Reference](https://docs.slack.dev/reference/app-manifest/) — official Slack docs for manifest YAML schema
- [GitHub Issue Form Syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) — official GitHub docs

### Secondary (MEDIUM confidence)
- [Zowe Docs: Slack Socket Mode scopes](https://docs.zowe.org/v3.0.x/user-guide/zowe-chat/chat_prerequisite_slack_socket_mode/) — lists required bot scopes including `channels:history`, `groups:history`, `chat:write`
- [ctxinf: Publish Bun package to npm](https://blog.ctxinf.com/en/note/bun/2025/1.publish-executable-to-npm-and-bunx) — confirms bunx-only limitation for `.ts` bin entries

### Tertiary (LOW confidence)
- WebSearch results on CONTRIBUTING.md conventions — standard patterns, no single authoritative source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — manifest schema from official docs, package.json read directly from disk
- Architecture: HIGH — all source files read directly, no inference needed
- Pitfalls: HIGH — pitfall 1 (npx) directly verified by reading bin field in package.json; others from official docs

**Research date:** 2026-03-26
**Valid until:** 2026-09-26 (stable domain — Slack manifest schema and Keep a Changelog format are versioned and stable)
