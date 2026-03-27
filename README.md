# claude-slack-channel

[![npm version](https://img.shields.io/npm/v/claude-slack-channel)](https://www.npmjs.com/package/claude-slack-channel)
[![CI](https://github.com/sethbrasile/claude-slack-channel/actions/workflows/ci.yml/badge.svg)](https://github.com/sethbrasile/claude-slack-channel/actions/workflows/ci.yml)

Claude Code Channel MCP server for Slack — bidirectional interactive bridge via Socket Mode.

> **Requires Bun runtime ([bun.sh](https://bun.sh)).**
> Use `bunx claude-slack-channel` to run. **`npx` will NOT work** — the binary entry point is a `.ts` file that only the Bun runtime can execute.

---

## What this is

`claude-slack-channel` is a Claude Code MCP server that bridges your Claude Code sessions to a Slack channel via Socket Mode. It is bidirectional: Claude receives commands from Slack, can reply to Slack, and operators can approve or deny dangerous tool calls from Slack without ever opening a terminal. Socket Mode means no public URL, no webhook setup, and no port forwarding — it works through NAT and firewalls out of the box.

---

## Quick start

### 1. Install Bun

Follow the instructions at [bun.sh](https://bun.sh) to install Bun on your system.

### 2. Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Select **From a manifest**
3. Choose your workspace
4. Paste the contents of [`slack-app-manifest.yaml`](./slack-app-manifest.yaml) from this repo into the YAML tab
5. Click **Create**, then install the app to your workspace

### 3. Get your tokens and IDs

- **Bot token** — OAuth & Permissions > Bot User OAuth Token (starts `xoxb-`)
- **App-level token** — Basic Information > App-Level Tokens > Create token with `connections:write` scope (starts `xapp-`)
- **Channel ID** — Right-click the target Slack channel > Copy link; the ID is the `C0XXXXXXXXX` segment at the end of the URL
- **Your user ID** — Click your profile > `...` menu > Copy member ID (format: `U0XXXXXXXXX` or `W0XXXXXXXXX`)

### 4. Add to `.mcp.json`

Create or edit `.mcp.json` in your project directory:

```json
{
  "mcpServers": {
    "slack": {
      "command": "bunx",
      "args": ["claude-slack-channel"],
      "env": {
        "SLACK_CHANNEL_ID": "C0XXXXXXXXX",
        "SLACK_BOT_TOKEN": "xoxb-your-bot-token-here",
        "SLACK_APP_TOKEN": "xapp-your-app-token-here",
        "ALLOWED_USER_IDS": "U0XXXXXXXXX"
      }
    }
  }
}
```

### 5. Invite the bot to your channel

In the target Slack channel, type `/invite @Claude` and press Enter.

### 6. Start Claude Code

```bash
claude --dangerously-load-development-channels server:slack
```

> Requires Claude Code v2.1.80+ and a [claude.ai](https://claude.ai) login (API key alone is not sufficient).

---

## Configuration

All configuration is via environment variables (set in `.mcp.json` `env` block or a `.env` file).

| Variable | Required | Description |
|---|---|---|
| `SLACK_BOT_TOKEN` | Yes | Bot User OAuth Token. Must start with `xoxb-`. |
| `SLACK_APP_TOKEN` | Yes | App-level token for Socket Mode. Must start with `xapp-`. |
| `SLACK_CHANNEL_ID` | Yes | The Slack channel to listen on (e.g. `C0XXXXXXXXX`). |
| `ALLOWED_USER_IDS` | Yes | Comma-separated list of Slack user IDs allowed to send commands. Each ID must start with `U0` or `W0`. |
| `SERVER_NAME` | No | Identifier shown in Claude's context. Defaults to `slack`. Use a project-specific name when running multiple server instances on a shared machine. |

---

## How it works: Threading

The server uses a `ThreadTracker` state machine to manage conversation threads. When a top-level message arrives in the Slack channel, it is treated as a new command — any previous active thread is abandoned. When Claude replies, that reply creates a Slack thread. All follow-up questions from Claude in the same session go into the same thread. When you send a new top-level message in the channel, the old thread is abandoned and a fresh session begins.

---

## How it works: Permission relay

When Claude requests a potentially dangerous tool call (e.g., running a shell command, writing files), an approval message appears in the active Slack thread. The message includes a unique permission ID. To approve the action, reply:

```
yes abc123
```

To deny it:

```
no abc123
```

Single-letter shorthands `y` and `n` are also accepted. Replies are case-insensitive. Permission replies are handled silently — they do not trigger a new channel notification or start a new thread.

---

## Comparison with community implementation

| Feature | This package | [jeremylongshore/claude-code-slack-channel](https://github.com/jeremylongshore/claude-code-slack-channel) |
|---|---|---|
| Runtime | Bun / TypeScript | Bun / TypeScript |
| Entry point | `bunx claude-slack-channel` | `bunx claude-code-slack-channel` |
| User authentication | Static `ALLOWED_USER_IDS` allowlist | Pairing code flow (code exchanged in Slack DM) |
| Permission relay | Yes — approve/deny tool calls from Slack | No |
| Thread model | `ThreadTracker` state machine — top-level = new command, replies stay in thread | Simpler threading |
| Multi-channel | No — one `SLACK_CHANNEL_ID` per instance by design | Yes — one instance can handle multiple channels |
| Architecture | Single channel, single operator pipeline focus | More feature-rich, multi-channel |

**When to use this package:** You want a focused, automation-first setup where Claude runs unattended and operators approve sensitive actions from Slack. Static user allowlist is acceptable; you don't need multi-channel routing from a single process.

**When to use jeremylongshore's implementation:** You want multi-channel support, a pairing code flow for operator onboarding, or a richer tool surface.

---

## Examples

- [Basic setup (single project)](./examples/basic-setup.md) — complete walkthrough from Slack app creation to first test message
- [Multi-project VM setup](./examples/multi-project-vm.md) — running multiple independent server instances on a shared machine

---

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, test commands, and PR process.

---

## License

[MIT](./LICENSE)
