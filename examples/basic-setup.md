# Basic Setup: Single Project

This guide walks through the complete setup for a single Claude Code project connected to a Slack channel. By the end, you will be able to send commands to Claude from Slack and receive replies in a thread.

---

## Step 1: Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Select **From a manifest**
4. Choose your Slack workspace
5. Select the **YAML** tab and paste the entire contents of [`slack-app-manifest.yaml`](../slack-app-manifest.yaml) from this repo
6. Click **Next**, review the permissions, then click **Create**
7. Click **Install to Workspace** and authorize the app

---

## Step 2: Get your bot token

1. In your app settings, go to **OAuth & Permissions**
2. Copy the **Bot User OAuth Token** — it starts with `xoxb-`

---

## Step 3: Get your app-level token

1. In your app settings, go to **Basic Information**
2. Scroll to **App-Level Tokens** and click **Generate Token and Scopes**
3. Give it a name (e.g., `socket-mode`)
4. Add the `connections:write` scope
5. Click **Generate** and copy the token — it starts with `xapp-`

---

## Step 4: Find your Slack user ID

1. Open Slack and click on your profile picture or display name
2. Click the `...` (more actions) menu
3. Click **Copy member ID**

The ID is in the format `U0XXXXXXXXX` (regular accounts) or `W0XXXXXXXXX` (workspace accounts).

---

## Step 5: Find your channel ID

1. Right-click the Slack channel you want Claude to listen on
2. Click **Copy link**
3. The link looks like `https://yourworkspace.slack.com/archives/C0XXXXXXXXX`
4. The channel ID is the `C0XXXXXXXXX` segment at the end

---

## Step 6: Invite the bot to the channel

In the target Slack channel, type:

```
/invite @Claude
```

Press Enter. The bot must be a member of the channel to receive messages.

---

## Step 7: Configure `.mcp.json`

In your project directory, create or edit `.mcp.json`:

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

Replace the placeholder values with your actual tokens and IDs. If you have multiple operators, separate their user IDs with commas:

```json
"ALLOWED_USER_IDS": "U0XXXXXXXXX,U0YYYYYYYYY"
```

---

## Step 8: Start Claude Code

```bash
claude --dangerously-load-development-channels server:slack
```

Claude Code will launch, connect to the MCP server, and the server will connect to Slack via Socket Mode.

> **Requirements:** Claude Code v2.1.80+ and a [claude.ai](https://claude.ai) login. An API key alone is not sufficient — the Channel protocol requires claude.ai authentication.

---

## Step 9: Test the connection

In your Slack channel, send a top-level message (not a thread reply):

```
hello
```

Claude should respond in a thread within a few seconds.

---

## What's next

- To approve or deny a tool call from Slack, reply `yes {id}` or `no {id}` in the active thread when a permission request appears.
- For running Claude Code on multiple projects from a shared VM, see [examples/multi-project-vm.md](./multi-project-vm.md).
