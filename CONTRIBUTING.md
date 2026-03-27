# Contributing to claude-slack-channel

Thank you for your interest in contributing. This guide covers everything you need to set up a development environment, run the test suite, and open a pull request.

---

## Prerequisites

- **Bun 1.2+** — [bun.sh](https://bun.sh). The project uses TypeScript executed directly by Bun; no Node.js or build step is needed.
- **Claude Code v2.1.80+** — Required if you want to test the server against a live Claude Code session.

---

## Setup

```bash
git clone https://github.com/sethbrasile/claude-slack-channel.git
cd claude-slack-channel
bun install
```

---

## Running tests

```bash
bun test              # run the full unit test suite
bun test --coverage   # run with coverage report
```

The test suite currently has 48+ tests. All tests must pass before opening a PR. CI runs the same command on every push and pull request.

---

## Type checking

```bash
bunx tsc --noEmit
```

TypeScript is checked in strict mode. No type errors are permitted.

---

## Linting and formatting

```bash
bunx biome check .           # check for lint and format issues
bunx biome check --write .   # auto-fix lint and format issues
```

The project uses [Biome](https://biomejs.dev) for both linting and formatting (no ESLint, no Prettier). Biome checks are enforced in CI.

---

## Architecture overview

Key design decisions relevant to contributors:

- **stdout is sacred.** After `server.connect()`, stdout is owned by the MCP JSON-RPC transport. ALL diagnostic output MUST use `console.error()`. This applies to the Slack SDK logger as well. Writing anything to stdout will corrupt the MCP protocol.

- **Startup ordering.** `server.connect(transport)` must complete before `socketMode.start()`. Notifications cannot be sent before the transport is ready.

- **Pure functions for testability.** Functions like `shouldProcessMessage`, `parsePermissionReply`, `formatPermissionRequest`, and `isDuplicate` are extracted as pure functions that take explicit parameters. They are tested directly without needing to mock module state or start a real Slack connection.

- **Single channel by design.** The server binds to exactly one `SLACK_CHANNEL_ID`. Multi-channel support is out of scope. See [examples/multi-project-vm.md](./examples/multi-project-vm.md) for the multi-project pattern.

---

## PR process

1. Fork the repository and create a branch for your change.
2. Write tests for any new behavior. Pure functions should have direct unit tests in `src/__tests__/`.
3. Ensure all CI checks pass locally before pushing:
   ```bash
   bunx tsc --noEmit && bunx biome check . && bun test
   ```
4. Open a pull request against `main`. CI will run typecheck, lint, and tests automatically.
5. Describe what the change does and why. Reference any related issues.

---

## Commit messages

No strict format is required, but descriptive messages are preferred. If you are fixing a specific bug or implementing a specific requirement, reference it in the message body.
