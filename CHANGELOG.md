# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> These versions were developed and released on the same day during initial build. Dates reflect the initial publish date.

## [Unreleased]

## [0.3.0] - 2026-03-27

### Added

- **Interactive Approve/Deny buttons** on permission requests — Block Kit buttons replace the text-only prompt. One tap to approve or deny; the message updates in-place to show who acted.
- Text-based `yes/no {id}` replies still work as a fallback alongside buttons.
- `formatPermissionBlocks()` and `formatPermissionResult()` exports from `permission.ts` — Block Kit message builders for permission prompts and resolved verdicts.
- `parseButtonAction()` export from `permission.ts` — parses Slack button `action_id` into a permission verdict.
- Interactive event handler in `slack-client.ts` — listens for `interactive` Socket Mode events, validates user allowlist, and forwards button actions.
- Slack app manifest now includes `interactivity.is_enabled: true` for button support.

## [0.2.0] - 2026-03-27

### Breaking Changes

These changes affect library consumers only (code that imports from `claude-slack-channel` directly). CLI users running via `bunx` are unaffected.

- **`createServer()` signature changed** — accepts optional second argument `{ web?, tracker? }` for dependency injection. Library consumers can now get a fully functional server with reply handling by passing deps. The previous stub reply handler (returned `'sent'` for all calls) is no longer registered when deps are omitted.
- **`isDuplicate()` removed** — dead code export deleted from `slack-client.ts`. Use the deduplication built into `createSlackClient()` instead.
- **`SLACK_CHANNEL_ID` validation tightened** — now requires Slack channel/group ID format (`/^[CG][A-Z0-9]+$/`). Previously accepted any non-empty string.

### Added

- `PERMISSION_ID_PATTERN` and `PERMISSION_ID_RE` exports from `permission.ts` — shared regex constant for permission request ID validation
- `validateEventTs()` export from `slack-client.ts` — pure function for ts-field validation with logging
- Idempotent shutdown guard — prevents double-execution when SIGTERM/SIGINT/stdin-close fire simultaneously
- Slack SDK logger error scrubbing — tokens in SDK error output are now redacted via `safeErrorMessage`
- Events without `ts` field now logged to stderr instead of silently dropped

### Fixed

- `safeErrorMessage` token regex broadened (`[^\s]+` instead of `[\w-]+`) to catch multi-line token patterns
- Permission ID regex duplication eliminated — single source of truth in `permission.ts`
- Double-cast patterns documented with inline comments explaining SDK type constraints
- `prepublishOnly` script now includes lint step

## [0.1.0] - 2026-03-27

### Added

- MCP server bridging Claude Code to Slack via Socket Mode
- `reply` tool for outbound messages with optional thread support
- Permission relay: approve or deny Claude tool calls from Slack via `yes/no {id}`
- ThreadTracker state machine — top-level messages = new commands, replies stay in thread
- Configurable user allowlist via ALLOWED_USER_IDS env var
- Zod config validation with field-level error messages and token scrubbing
- GitHub Actions CI workflow (typecheck, lint, test on push/PR)
- GitHub Actions release workflow (npm publish with provenance on v* tags)

[Unreleased]: https://github.com/sethbrasile/claude-slack-channel/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/sethbrasile/claude-slack-channel/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/sethbrasile/claude-slack-channel/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/sethbrasile/claude-slack-channel/releases/tag/v0.1.0
