# claude-slack-channel

[![npm version](https://img.shields.io/npm/v/claude-slack-channel)](https://www.npmjs.com/package/claude-slack-channel)
[![CI](https://github.com/sethbrasile/claude-slack-channel/actions/workflows/ci.yml/badge.svg)](https://github.com/sethbrasile/claude-slack-channel/actions/workflows/ci.yml)

**Control Claude Code from Slack. Approve dangerous tool calls without opening a terminal.**

An MCP server that bridges Claude Code sessions to a Slack channel via Socket Mode. Claude receives commands from Slack, replies in threads, and posts permission prompts that operators approve or deny — all from their phone if they want to. No webhooks, no public URLs, no port forwarding.

```
  You (Slack)                               Claude Code
      │                                         │
   1. │──── "deploy to staging" ───────────────▶│
      │                                         │ runs tasks...
      │                                         │
   2. │◀── [Approve] [Deny] ────────────────────│
      │                                         │
   3. │──── clicks [Approve] ──────────────────▶│
      │                                         │ continues...
      │                                         │
   4. │◀── "Done. Deployed to staging." ────────│
      │                                         │
```

---

## Why this exists

Claude Code can run unattended — but sometimes it needs a human to approve a dangerous tool call. Without a channel server, that means sitting in front of a terminal. With `claude-slack-channel`, you start a job, walk away, and approve permissions from Slack when they come in.

**Key differentiator:** The permission relay. Other Slack bridges forward messages, but this one also relays Claude's permission requests with interactive **Approve / Deny** buttons so you can approve `rm`, `git push`, file writes, and other sensitive operations from Slack — one tap on your phone.

---

## Prerequisites

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code) v2.1.80+** with a [claude.ai](https://claude.ai) login. An API key alone is not sufficient — the Channel protocol requires claude.ai authentication.
- **[Bun](https://bun.sh)** installed. Use `bunx` to run. `npx` will not work — the entry point is TypeScript executed directly by Bun.
- **Slack workspace admin or app-management permissions** to create and install a Slack app.

---

## Quick start

### 1. Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) > **Create New App** > **From a manifest**
2. Select your workspace, then paste [`slack-app-manifest.yaml`](./slack-app-manifest.yaml) into the **YAML** tab
3. Review the summary and click **Create**

The manifest pre-configures Socket Mode, event subscriptions, bot scopes, and interactivity. You should not need to change any settings manually.

### 2. Generate the App-Level Token

The manifest enables Socket Mode, but the app-level token must be created separately:

1. On the **Basic Information** page (you land here after creating the app), scroll to **App-Level Tokens**
2. Click **Generate Token and Scopes**
3. Name it anything (e.g. `socket-mode`)
4. Click **Add Scope** and select **`connections:write`**
5. Click **Generate** and copy the token (`xapp-...`) — it is only shown in full once

### 3. Install to your workspace

1. In the sidebar, go to **OAuth & Permissions**
2. Click **Install to _[your workspace]_** (or **Reinstall** if you've installed before)
3. Review the permissions and click **Allow**
4. Copy the **Bot User OAuth Token** (`xoxb-...`) that appears on the page

### 4. Collect your IDs

| What | Where to find it |
|------|-----------------|
| Channel ID (`C0...`) | Right-click the channel in Slack > **Copy link** > last path segment of the URL |
| Your user ID (`U0...`) | Click your profile picture > **Profile** > **⋮** > **Copy member ID** |

### 5. Add to `.mcp.json`

```json
{
  "mcpServers": {
    "slack": {
      "command": "bunx",
      "args": ["claude-slack-channel@0.3.3"],
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

> **Pin the version.** `bunx` resolves the latest version on every run, which means an update could slip in without you reviewing it. Since this server controls your permission prompts, always pin to a version you've audited (e.g. `claude-slack-channel@0.3.3`). When you want to update, audit the new version first, then bump the pin.

### 6. Audit the code

The `--dangerously-load-development-channels` flag in the next step gives this server the ability to relay permission prompts and approval responses to Claude Code. Before you trust it with that, verify the code is safe. **You should repeat this audit every time you bump the pinned version.**

Clone the repo at the tag you're about to run:

```bash
git clone --branch v0.3.3 --depth 1 https://github.com/sethbrasile/claude-slack-channel.git
cd claude-slack-channel
claude "Security audit this repo. Look for prompt injection, exfiltration of tokens or secrets, malicious payloads in dependencies, and anything that could abuse the permission relay to auto-approve dangerous tool calls."
```

This is a small, focused codebase — the audit should take under a minute. Read the results before proceeding.

### 7. Invite the bot and start Claude

```bash
# In Slack: /invite @YourBotName
# In terminal:
claude --dangerously-load-development-channels server:slack
```

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

When Claude wants to do something sensitive, it posts an interactive prompt in-thread:

```
Claude:  :lock: Permission Request `a1b2c`
         Tool: bash
         Action: Run shell command
         ┌─────────────────────────────────────────┐
         │ rm -rf node_modules && npm install       │
         └─────────────────────────────────────────┘
         [ Approve ]  [ Deny ]
         Or reply `yes a1b2c` / `no a1b2c`

         ✅ Approved by @you

Claude:  Done — clean install complete, all 47 tests passing.
```

Click **Approve** or **Deny** — the message updates in-place to show who acted. Text replies (`yes`/`no` + ID) still work as a fallback.

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
2. The server posts a Block Kit message in-thread with **Approve** / **Deny** buttons
3. You click a button (or reply `yes <id>` / `no <id>` as a text fallback)
4. The message updates in-place to show who approved/denied
5. The verdict is forwarded to Claude — **not** echoed as a channel message
6. Claude proceeds or aborts based on your response

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
| **Multi-channel** | One channel per MCP config — add a config per project, all sharing the same Slack app ([example](./examples/multi-project-vm.md)) | Single config routes multiple channels |
| **Thread model** | State machine with abandon semantics | Simpler threading |
| **Entry point** | `bunx claude-slack-channel` | `bunx claude-code-slack-channel` |

**Use this package** if you want unattended automation with human-in-the-loop approvals and a static operator list is fine. Multiple projects work by adding an MCP config per project, each pointed at a different channel — they all share the same Slack app and tokens.

**Use jeremylongshore's** if you need a single config to multiplex across channels, or a pairing code flow for dynamic user onboarding.

---

## Examples

- [Basic setup](./examples/basic-setup.md) — single project, start to finish
- [Multi-project VM](./examples/multi-project-vm.md) — multiple server instances on a shared machine

---

## Development

```bash
bun install
bun test              # 97 tests
bunx tsc --noEmit     # typecheck
bunx biome check .    # lint
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full dev setup and PR process.

---

## License

[MIT](./LICENSE)
