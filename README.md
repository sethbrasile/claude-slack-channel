# claude-slack-channel

[![npm version](https://img.shields.io/npm/v/claude-slack-channel)](https://www.npmjs.com/package/claude-slack-channel)
[![CI](https://github.com/sethbrasile/claude-slack-channel/actions/workflows/ci.yml/badge.svg)](https://github.com/sethbrasile/claude-slack-channel/actions/workflows/ci.yml)

**Control Claude Code from Slack. Approve dangerous tool calls without opening a terminal.**

An MCP server that bridges Claude Code sessions to a Slack channel via Socket Mode. Claude receives commands from Slack, replies in threads, and posts permission prompts that operators approve or deny — all from their phone if they want to. No webhooks, no public URLs, no port forwarding.

```
  You (Slack)                                Claude Code
      │                                          │
   1. │──── "deploy to staging" ────────────────▶│
      │                                          │ runs tasks...
      │                                          │
   2. │◀─── 🔒 "Allow rm -rf node_modules?" ────│
      │                                          │
   3. │──── "yes a1b2c" ───────────────────────▶│
      │                                          │ continues...
      │                                          │
   4. │◀─── "Done. Deployed to staging." ────────│
      │                                          │
```

---

## Why this exists

Claude Code can run unattended — but sometimes it needs a human to approve a dangerous tool call. Without a channel server, that means sitting in front of a terminal. With `claude-slack-channel`, you start a job, walk away, and approve permissions from Slack when they come in.

**Key differentiator:** The permission relay. Other Slack bridges forward messages, but this one also relays Claude's permission requests so you can approve `rm`, `git push`, file writes, and other sensitive operations from Slack.

---

## Quick start

> **Requires [Bun](https://bun.sh).** Use `bunx` to run. `npx` will not work — the entry point is TypeScript executed directly by Bun.

### 1. Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) > **Create New App** > **From a manifest**
2. Paste [`slack-app-manifest.yaml`](./slack-app-manifest.yaml) into the YAML tab
3. Install the app to your workspace

### 2. Grab your credentials

| What | Where to find it |
|------|-----------------|
| Bot token (`xoxb-...`) | OAuth & Permissions > Bot User OAuth Token |
| App token (`xapp-...`) | Basic Information > App-Level Tokens > create with `connections:write` |
| Channel ID (`C0...`) | Right-click channel > Copy link > last segment of URL |
| Your user ID (`U0...`) | Click your profile > ... > Copy member ID |

### 3. Add to `.mcp.json`

```json
{
  "mcpServers": {
    "slack": {
      "command": "bunx",
      "args": ["claude-slack-channel"],
      "env": {
        "SLACK_CHANNEL_ID": "C0XXXXXXXXX",
        "SLACK_BOT_TOKEN": "xoxb-your-bot-token",
        "SLACK_APP_TOKEN": "xapp-your-app-token",
        "ALLOWED_USER_IDS": "U0XXXXXXXXX"
      }
    }
  }
}
```

### 4. Invite the bot and start Claude

```bash
# In Slack: /invite @YourBotName
# In terminal:
claude --dangerously-load-development-channels server:slack
```

> Requires Claude Code v2.1.80+ and a [claude.ai](https://claude.ai) login (API key alone is not sufficient).

---

## What it looks like

### Sending a command

Type a message in the Slack channel. Claude receives it and starts working.

```
You:     Fix the failing test in src/utils.ts
Claude:  Looking at the test file now...
         [thread] Found it — the mock was returning undefined instead of [].
         Fixed and tests pass. Here's what I changed: ...
```

### Permission relay

When Claude wants to do something sensitive, it asks in-thread:

```
Claude:  :lock: Permission Request `a1b2c`
         Tool: bash
         Description: Run shell command
         ```
         rm -rf node_modules && npm install
         ```
         Reply `yes a1b2c` or `no a1b2c`

You:     yes a1b2c

Claude:  Done — clean install complete, all 47 tests passing.
```

### New commands

Send a new top-level message to start a fresh session. The old thread is abandoned automatically.

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `SLACK_BOT_TOKEN` | Yes | Bot User OAuth Token (starts with `xoxb-`) |
| `SLACK_APP_TOKEN` | Yes | App-level token for Socket Mode (starts with `xapp-`) |
| `SLACK_CHANNEL_ID` | Yes | Channel to listen on (e.g. `C0XXXXXXXXX`) |
| `ALLOWED_USER_IDS` | Yes | Comma-separated Slack user IDs allowed to send commands |
| `SERVER_NAME` | No | Identifier in Claude's context. Defaults to `slack`. Useful when running multiple instances. |

---

## How it works

### Threading

The server tracks one active thread at a time using a `ThreadTracker` state machine:

- **Top-level message** = new command. Any previous thread is abandoned.
- **Claude's first reply** creates a Slack thread. Follow-ups stay in that thread.
- **Your reply in-thread** continues the conversation.
- **New top-level message** = fresh start.

### Permission relay

1. Claude requests permission for a tool call (e.g., `bash`, `write`)
2. The server formats the request and posts it in the active thread
3. You reply `yes <id>` or `no <id>` (shorthands `y`/`n` work, case-insensitive)
4. The verdict is forwarded to Claude — **not** echoed as a channel message
5. Claude proceeds or aborts based on your response

### Architecture

```
src/
├── server.ts          # MCP server + CLI entry, wires everything together
├── config.ts          # Zod env var validation + token scrubbing
├── slack-client.ts    # Socket Mode, message filtering, dedup
├── channel-bridge.ts  # Formats Slack messages as Channel notifications
├── permission.ts      # Permission verdict parsing + request formatting
├── threads.ts         # ThreadTracker state machine
└── types.ts           # Shared interfaces
```

Single process, no database, no external dependencies beyond Slack. The server connects via Socket Mode (WebSocket), so it works behind NAT and firewalls without any network configuration.

---

## Comparison with community implementation

| | This package | [jeremylongshore/claude-code-slack-channel](https://github.com/jeremylongshore/claude-code-slack-channel) |
|---|---|---|
| **Permission relay** | Yes — approve/deny from Slack | No |
| **User auth** | Static allowlist (`ALLOWED_USER_IDS`) | Pairing code flow |
| **Multi-channel** | No — one channel per instance | Yes |
| **Thread model** | State machine with abandon semantics | Simpler threading |
| **Entry point** | `bunx claude-slack-channel` | `bunx claude-code-slack-channel` |

**Use this package** if you want unattended automation with human-in-the-loop approvals and a static operator list is fine.

**Use jeremylongshore's** if you need multi-channel routing or a pairing code flow for dynamic user onboarding.

---

## Examples

- [Basic setup](./examples/basic-setup.md) — single project, start to finish
- [Multi-project VM](./examples/multi-project-vm.md) — multiple server instances on a shared machine

---

## Development

```bash
bun install
bun test              # 64 tests
bunx tsc --noEmit     # typecheck
bunx biome check .    # lint
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full dev setup and PR process.

---

## License

[MIT](./LICENSE)
