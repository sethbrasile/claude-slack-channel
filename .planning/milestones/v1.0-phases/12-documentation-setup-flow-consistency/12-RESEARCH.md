# Phase 12: Documentation — Setup Flow & Consistency - Research

**Researched:** 2026-03-28
**Domain:** Markdown documentation editing — README.md, example guides, YAML manifest comment
**Confidence:** HIGH

## Summary

This phase is purely a documentation fix phase — no code changes, no library research needed. Every finding has a precise file, line number, and a clear prescribed fix from the deep-review. The scope is four files: `README.md`, `examples/basic-setup.md`, `examples/multi-project-vm.md`, and `slack-app-manifest.yaml`. All changes are small targeted edits rather than structural rewrites.

The highest-leverage changes are the two High findings (H4, H5): pinning versions in example `.mcp.json` snippets so developers don't inadvertently get an unpinned install, and surfacing the Claude Code v2.1.80+ prerequisite before the setup steps begin. Both are security-relevant — they affect what a developer installs before ever reading the warning in the README.

The remaining changes (M16–M25, L21–L23) are setup-friction reducers: clearing up the `connections:write` contradiction between the manifest and README, showing the channel ID URL format inline, documenting W-prefix user IDs, fixing the bot name placeholder, clarifying the audit step, repositioning the Examples section, adding a back-link, and adding a Troubleshooting section.

**Primary recommendation:** Work through the four files in order of impact — README.md first (most findings, most user-facing), then examples/basic-setup.md (version pin + What's Next copy), then examples/multi-project-vm.md (version pin + back-link), then slack-app-manifest.yaml (one-line comment fix).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| H4 | Pin `claude-slack-channel@0.3.3` in all `.mcp.json` example snippets | Found in examples/basic-setup.md:77 and examples/multi-project-vm.md:45,64 — both use bare `"claude-slack-channel"` |
| H5 | Add "Prerequisites" section before Quick Start listing Claude Code v2.1.80+ and claude.ai login | Current prerequisite is at README.md:114 — after 7 steps of setup |
| M16 | Note Slack admin/app-management permissions before Step 1 | README.md:39-45 — no permission note exists |
| M17 | Remove "automatic" claim from manifest comment about `connections:write` | slack-app-manifest.yaml:9 — says "granted automatically when Socket Mode is enabled" but README:54 says add it manually |
| M18 | Show Channel ID URL format inline in README | README.md:68 — says "last path segment" but no URL example |
| M19 | Document `W0XXXXXXXXX` format alongside `U0...` in README config table | README.md:165 — only shows `U0...` |
| M20 | Use `/invite @Claude` with note, matching manifest display_name | README.md:109 — says `@YourBotName` |
| M25 | Add "(run this in any terminal where Claude Code is available)" to audit step | README.md:96 — Step 6 audit wording lacks this clarification |
| L21 | Move Examples section higher in README, before Development | README.md:222-227 — currently after Comparison, which is after Architecture |
| L22 | Add back-link from multi-project-vm.md to basic-setup.md | examples/multi-project-vm.md — no link to basic-setup.md exists |
| L23 | Add Troubleshooting section with common issues | No troubleshooting section in any doc |
</phase_requirements>

## Standard Stack

Not applicable — this is a documentation-only phase. All edits are to Markdown files and one YAML comment. No libraries are installed or changed.

## Architecture Patterns

### Files in Scope

```
README.md                          # 11 findings touch this file
examples/basic-setup.md            # H4 (version pin) + What's Next copy
examples/multi-project-vm.md       # H4 (version pin) + L22 (back-link)
slack-app-manifest.yaml            # M17 (one comment line)
```

### Change Map by File

**README.md** — 9 findings:

| Finding | Location | Change |
|---------|----------|--------|
| H5 | Before line 36 (Quick start heading) | Insert "Prerequisites" section |
| M16 | Before Step 1 (line 39) | Add admin/app-management note |
| M18 | Line 68 (Channel ID row) | Add URL example inline |
| M19 | Line 165 (ALLOWED_USER_IDS row) | Add `W0XXXXXXXXX` to description |
| M20 | Line 109 | Change `@YourBotName` to `@Claude` with note |
| M25 | Lines 92-104 (Step 6) | Add clarifying parenthetical |
| L21 | Lines 222-227 (Examples section) | Move section above Development |
| L23 | New section | Add Troubleshooting after Examples |

**examples/basic-setup.md** — 2 findings:

| Finding | Location | Change |
|---------|----------|--------|
| H4 | Line 77 (args array) | Change `"claude-slack-channel"` to `"claude-slack-channel@0.3.3"` |
| What's Next | Lines 122-123 | Use concrete ID placeholder and mention buttons |

**examples/multi-project-vm.md** — 3 findings:

| Finding | Location | Change |
|---------|----------|--------|
| H4 | Line 45 (project-alpha args) | Pin version |
| H4 | Line 64 (project-beta args) | Pin version |
| L22 | End of file | Add back-link sentence to basic-setup.md |

**slack-app-manifest.yaml** — 1 finding:

| Finding | Location | Change |
|---------|----------|--------|
| M17 | Lines 9-10 | Remove "automatically" and align with README wording |

### H5 — Prerequisites Section Content

The section must appear before "## Quick start" (currently line 36). Based on what the README already says at line 114 and line 37:

```markdown
## Prerequisites

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code) v2.1.80+** with a [claude.ai](https://claude.ai) login. An API key alone is not sufficient — the Channel protocol requires claude.ai authentication.
- **[Bun](https://bun.sh)** installed. Use `bunx` to run. `npx` will not work — the entry point is TypeScript executed directly by Bun.
- **Slack workspace admin or app-management permissions** to create and install a Slack app.
```

This consolidates the existing Bun note (currently inline at line 37-38) and the version note (currently buried at line 114) into one visible gating section.

### M16 — Slack Admin Note Placement

The note about admin permissions fits naturally in the Prerequisites section (above). It should NOT be repeated before Step 1 if the Prerequisites section already covers it — that would be redundant. The review finding says "add a prerequisite note" — placing it in the new Prerequisites section satisfies this.

### M17 — Manifest Comment Fix

Current comment (lines 6-10):
```yaml
# NOTE: The app-level token (xapp-) requires the "connections:write" scope.
# This scope is set separately when you enable Socket Mode in Slack app settings:
#   App Settings > Socket Mode > Enable Socket Mode > Generate Token
# The "connections:write" scope is NOT part of this manifest — it is granted
# automatically when Socket Mode is enabled.
```

The last line contradicts the README (Step 2, line 54), which tells users to manually add the scope. Remove "automatically" and reword to remove the contradiction:

```yaml
# NOTE: The app-level token (xapp-) requires the "connections:write" scope.
# This scope is set separately when you generate the app-level token:
#   Basic Information > App-Level Tokens > Generate Token and Scopes > Add "connections:write"
# The "connections:write" scope is NOT part of this manifest.
```

### M18 — Channel ID URL Format

Current README line 68:
```
| Channel ID (`C0...`) | Right-click the channel in Slack > **Copy link** > last path segment of the URL |
```

Add the URL format inline:
```
| Channel ID (`C0...`) | Right-click the channel in Slack > **Copy link** > last path segment of the URL (e.g. `https://yourworkspace.slack.com/archives/C0XXXXXXXXX`) |
```

### M19 — W0 User ID Format

Current README line 165:
```
| `ALLOWED_USER_IDS` | Yes | Comma-separated Slack user IDs allowed to send commands |
```

Update to:
```
| `ALLOWED_USER_IDS` | Yes | Comma-separated Slack user IDs allowed to send commands. Format: `U0XXXXXXXXX` (regular) or `W0XXXXXXXXX` (workspace accounts) |
```

### M20 — Bot Name Fix

Current README line 109:
```bash
# In Slack: /invite @YourBotName
```

Replace with:
```bash
# In Slack: /invite @Claude  (the display name set in the manifest)
```

### M25 — Audit Step Clarification

Current README lines 92-104 (Step 6) — the final sentence before the code block. After the introductory paragraph, add the parenthetical clarification so the instruction reads naturally. The review specifies: "(run this in any terminal where Claude Code is available)".

The code block already shows `claude "Security audit..."` which implies Claude Code must be available. Adding the clarification to the introductory text removes ambiguity about whether Slack must be set up first.

### L21 — Examples Section Repositioning

Current README structure (after Configuration, How it works):
1. Comparison with community implementation (~line 208)
2. Examples (~line 222)
3. Development (~line 231)

Target structure:
1. Examples (moved up)
2. Comparison with community implementation
3. Development

The Examples section is two lines — easy to cut and paste above Comparison.

### L22 — Back-link in multi-project-vm.md

The file currently ends at line 116. Add a sentence pointing back:

```markdown
If you haven't completed the one-time Slack app setup yet, start with [basic-setup.md](./basic-setup.md) first.
```

This fits naturally as the first line after the "Important" note at line 5, or at the top as a brief intro note.

### L23 — Troubleshooting Section

No troubleshooting section exists anywhere. It belongs in README.md after the Examples section. Common issues to cover based on the architecture and config validation:

| Symptom | Cause | Fix |
|---------|-------|-----|
| Claude doesn't respond to messages | Bot not invited to channel, or wrong `SLACK_CHANNEL_ID` | Run `/invite @Claude` in the channel; verify the channel ID matches the `C0...` segment in the URL |
| Server starts but disconnects immediately | Invalid `SLACK_APP_TOKEN` (must start with `xapp-`) or `connections:write` scope missing | Check token prefix; verify scope was added when generating the app-level token |
| "Invalid config" on startup | Missing or malformed env vars | Check all four required vars are set; user IDs must start with `U` or `W` |
| Permission buttons appear but clicking does nothing | Interactive callbacks misconfigured in the Slack app | Verify interactivity is enabled in Slack app settings (the manifest enables it by default) |
| Works locally but fails on a remote VM | Firewall blocking outbound WebSocket | Socket Mode uses port 443 outbound only — confirm outbound HTTPS is allowed |

## Don't Hand-Roll

Not applicable — this phase edits existing documentation content. Nothing should be built from scratch.

## Common Pitfalls

### Pitfall 1: Introducing New Inconsistencies Between Files

**What goes wrong:** Fixing a value in one file but not the other creates a new inconsistency. For example, fixing the version pin in `basic-setup.md` but forgetting `multi-project-vm.md` (two snippets there).
**Why it happens:** There are three `.mcp.json` snippets across two files — easy to miss one.
**How to avoid:** After edits, grep for `"claude-slack-channel"` (bare, without version) to verify no unpinned instances remain.
**Warning signs:** Any `args: ["claude-slack-channel"]` without `@` version suffix.

### Pitfall 2: Removing the Bun Note While Adding Prerequisites

**What goes wrong:** The existing Bun note at README.md lines 37-38 is a block quote right before the Quick Start steps. If the Prerequisites section consolidates it, the inline note should be removed to avoid duplication. Forgetting to remove it leaves redundant content.
**How to avoid:** After adding Prerequisites section, delete the `> **Requires [Bun](https://bun.sh)...` block quote that currently lives under the Quick start heading.

### Pitfall 3: Manifest Comment Rewrite Changes Meaning

**What goes wrong:** Rewriting the manifest comment to remove "automatically" but accidentally implying the scope is in the manifest, or that no manual step is needed.
**How to avoid:** The new comment must clearly state the scope is NOT in the manifest and IS set manually during app-level token generation. Keep the step reference to Basic Information > App-Level Tokens.

### Pitfall 4: Troubleshooting Section Too Long

**What goes wrong:** Troubleshooting sections balloon into comprehensive guides and go stale. This is a v1 project — keep it to 4-6 of the most probable first-time setup issues.
**How to avoid:** Limit to errors a developer would hit during the Quick Start steps. Don't cover every possible Slack API error.

## Code Examples

### Version Pin Pattern (H4)

The README already uses the pinned version correctly. The examples must match:

```json
"args": ["claude-slack-channel@0.3.3"]
```

Both project-alpha and project-beta snippets in `multi-project-vm.md` need this fix (lines 45 and 64).

### Manifest Comment — Before and After (M17)

Before (lines 6-10):
```yaml
# NOTE: The app-level token (xapp-) requires the "connections:write" scope.
# This scope is set separately when you enable Socket Mode in Slack app settings:
#   App Settings > Socket Mode > Enable Socket Mode > Generate Token
# The "connections:write" scope is NOT part of this manifest — it is granted
# automatically when Socket Mode is enabled.
```

After:
```yaml
# NOTE: The app-level token (xapp-) requires the "connections:write" scope.
# This scope is set separately when you generate the app-level token:
#   Basic Information > App-Level Tokens > Generate Token and Scopes > Add "connections:write"
# The "connections:write" scope is NOT part of this manifest.
```

## State of the Art

Not applicable — documentation is timeless within the bounds of the product version it describes. No framework versions or library APIs involved.

## Open Questions

1. **What version should example snippets pin to?**
   - What we know: README pins `@0.3.3`. The deep-review finding says "pin all examples to `@0.3.3` matching the README."
   - What's unclear: Whether 0.3.3 is still the latest published version at the time of this phase's execution.
   - Recommendation: Match whatever the README currently pins. If README is already updated by another phase, match that. Do not change the README version pin in this phase — this phase aligns examples to README, not the other way around.

2. **Where exactly in README does the Troubleshooting section go?**
   - What we know: L21 repositions Examples before Development. L23 adds Troubleshooting.
   - Recommendation: Place Troubleshooting after Examples and before Development. Order: Configuration → How it works → Examples → Troubleshooting → Development → License.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | bunfig.toml or inline — no separate config file |
| Quick run command | `bun test` |
| Full suite command | `bun test --coverage` |

### Phase Requirements → Test Map

This phase is documentation-only. No automated tests cover Markdown content. Validation is manual review.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| H4 | Version pinned in all .mcp.json examples | manual | `grep -r '"claude-slack-channel"' examples/ README.md` (should return 0 matches without @version) | N/A |
| H5 | Prerequisites section exists before Quick Start | manual | Read README.md | N/A |
| M16 | Admin note present | manual | Read README.md Prerequisites | N/A |
| M17 | "automatic" removed from manifest comment | manual | Read slack-app-manifest.yaml | N/A |
| M18 | URL format inline in config table | manual | Read README.md config table | N/A |
| M19 | W0XXXXXXXXX documented | manual | Read README.md config table | N/A |
| M20 | @Claude used with note | manual | Read README.md Step 7 | N/A |
| M25 | Audit step clarification present | manual | Read README.md Step 6 | N/A |
| L21 | Examples before Development | manual | Read README.md section order | N/A |
| L22 | Back-link in multi-project-vm.md | manual | Read examples/multi-project-vm.md | N/A |
| L23 | Troubleshooting section exists | manual | Read README.md | N/A |

### Sampling Rate

- **Per task commit:** `bun test` (confirms no source files accidentally modified break tests)
- **Per wave merge:** `bun test --coverage && bunx tsc --noEmit && bunx biome check .`
- **Phase gate:** All 11 manual checks above pass before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. This phase adds no code, so no new test files are needed.

## Sources

### Primary (HIGH confidence)

- Direct file reads: `README.md`, `examples/basic-setup.md`, `examples/multi-project-vm.md`, `slack-app-manifest.yaml` — current content verified
- `.planning/reviews/2026-03-28-deep-review.md` — precise file:line findings with exact prescribed fixes

### Secondary (MEDIUM confidence)

None required — all information comes from the files being edited and the authoritative deep-review.

## Metadata

**Confidence breakdown:**
- Change inventory: HIGH — every finding maps to a specific file and line in the deep-review
- Prescribed fixes: HIGH — deep-review specifies exact wording for all changes
- Troubleshooting content: MEDIUM — derived from architecture knowledge, not from user reports

**Research date:** 2026-03-28
**Valid until:** Until README.md version pin changes (30 days otherwise)
