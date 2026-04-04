# Multi-Project VM: Running Multiple Instances

This guide explains how to run Claude Code for multiple independent projects on a shared machine (e.g., a VM or a development server), with each project having its own Slack channel.

> **Important:** Each project requires its own independent MCP server process with its own dedicated Slack channel. There is no multi-channel mode in a single server process — each `claude-slack-channel` instance binds to exactly one `SLACK_CHANNEL_ID`.

> **Note:** If you haven't completed the one-time Slack app setup yet, start with [basic-setup.md](./basic-setup.md) first.

---

## Overview

When you have multiple projects on one machine, the pattern is:

- One Slack channel per project (e.g., `#project-alpha`, `#project-beta`)
- One `.mcp.json` per project directory, each pointing to a different channel
- One independent `bunx claude-slack-channel` process per active Claude Code session

Commands sent to `#project-alpha` only reach the Claude Code session running in the `project-alpha` directory. Commands sent to `#project-beta` only reach the session in `project-beta`. The channels are completely isolated.

---

## Setup

### Step 1: Create one Slack channel per project

In your Slack workspace, create a dedicated channel for each project:
- `#project-alpha`
- `#project-beta`

Invite the Claude bot to each channel with `/invite @Claude`.

### Step 2: Get the channel IDs

For each channel, right-click it in Slack and copy the link. The channel ID is the `C0XXXXXXXXX` segment at the end of the URL.

### Step 3: Configure `.mcp.json` in each project directory

Create a separate `.mcp.json` in each project directory. Use a different `SLACK_CHANNEL_ID` and `SERVER_NAME` for each project.

**`~/projects/project-alpha/.mcp.json`**
```json
{
  "mcpServers": {
    "slack": {
      "command": "bunx",
      "args": ["claude-slack-channel@0.3.4"],
      "env": {
        "SLACK_CHANNEL_ID": "C0ALPHA00000",
        "SLACK_BOT_TOKEN": "xoxb-your-shared-bot-token",
        "SLACK_APP_TOKEN": "xapp-your-shared-app-token",
        "ALLOWED_USER_IDS": "U0YOURUSER0",
        "SERVER_NAME": "project-alpha"
      }
    }
  }
}
```

**`~/projects/project-beta/.mcp.json`**
```json
{
  "mcpServers": {
    "slack": {
      "command": "bunx",
      "args": ["claude-slack-channel@0.3.4"],
      "env": {
        "SLACK_CHANNEL_ID": "C0BETA000000",
        "SLACK_BOT_TOKEN": "xoxb-your-shared-bot-token",
        "SLACK_APP_TOKEN": "xapp-your-shared-app-token",
        "ALLOWED_USER_IDS": "U0YOURUSER0",
        "SERVER_NAME": "project-beta"
      }
    }
  }
}
```

### Step 4: Review the resulting project layout

```
~/projects/
├── project-alpha/
│   └── .mcp.json   # SLACK_CHANNEL_ID=C0ALPHA..., SERVER_NAME=project-alpha
└── project-beta/
    └── .mcp.json   # SLACK_CHANNEL_ID=C0BETA...,  SERVER_NAME=project-beta
```

---

## Running Claude Code sessions

Start each Claude Code session from its own project directory:

```bash
# Terminal 1 — project-alpha
cd ~/projects/project-alpha
claude --dangerously-load-development-channels server:slack
```

```bash
# Terminal 2 — project-beta
cd ~/projects/project-beta
claude --dangerously-load-development-channels server:slack
```

Each session launches its own `bunx claude-slack-channel` process, bound to the channel specified in that directory's `.mcp.json`.

---

## Notes

- **Shared tokens are fine.** Both projects can share the same `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN`. The bot posts to different channels based on `SLACK_CHANNEL_ID`.
- **Shared `ALLOWED_USER_IDS` is fine.** The same operator user IDs can be listed in every project's config.
- **`SERVER_NAME` identifies the project in Claude's context.** Use a descriptive name so Claude knows which project it is working in.
- **Each server instance is completely independent.** There is no multi-channel mode in a single server process. Routing is enforced at the channel level — each instance only listens on and posts to its own channel.
- **Sessions are isolated by directory.** Claude Code reads `.mcp.json` from the current working directory, so each project's Claude session uses its own config automatically.
