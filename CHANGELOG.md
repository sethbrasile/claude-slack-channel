# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
