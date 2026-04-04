# Headless Setup Guide

This guide covers running `claude-slack-channel` in headless mode on a VM or remote server, where Slack is the sole operator interface and Claude Code runs unattended in a persistent session.

**Who this is for:** VM/server operators who want Claude Code running 24/7, controllable entirely from Slack — no terminal access needed after initial setup.

> **Note:** This guide assumes you've already created and configured a Slack app with Socket Mode, bot token scopes, and event subscriptions. If you haven't, start with the [README](../README.md) or [basic setup guide](../examples/basic-setup.md) first.

---

## Prerequisites

- **Claude Code v2.1.80+** — channel protocol support required
- **Bun runtime** — install via `curl -fsSL https://bun.sh/install | bash`
- **Slack app configured** — bot token (`xoxb-`), app token (`xapp-`), channel ID, and user IDs ready
- **tmux or screen** — for persistent terminal sessions (`apt install tmux` or `apt install screen`)
- **claude.ai login** — Claude Code channels require OAuth login, not API keys. Run `claude login` interactively once on the VM

---

## Environment Variable Reference

All environment variables used by `claude-slack-channel`. The headless-specific variables are marked with ★.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SLACK_BOT_TOKEN` | Yes | — | Bot User OAuth Token (starts with `xoxb-`) |
| `SLACK_APP_TOKEN` | Yes | — | App-level token for Socket Mode (starts with `xapp-`) |
| `SLACK_CHANNEL_ID` | Yes | — | Channel to listen on (e.g. `C0XXXXXXXXX`) |
| `ALLOWED_USER_IDS` | Yes | — | Comma-separated Slack user IDs allowed to send commands. Format: `U0XXXXXXXXX` or `W0XXXXXXXXX` |
| `SERVER_NAME` | No | `slack` | MCP server name in Claude's tool list. Useful for multi-instance setups |
| ★ `HEADLESS` | No | `false` | Set to `true` to enable headless mode. Switches Claude's instructions to the session-binding protocol — decision points, errors, and milestones are mirrored to Slack. Replies gain an `audience` parameter (`operator` or `detail`) |
| ★ `COMPACT_DETAILS` | No | `false` | Set to `true` to store `detail`-audience replies server-side instead of posting full text. Retrieve stored content by typing `details` in a thread. Only meaningful when `HEADLESS=true` |

**Interactions:**
- `HEADLESS=true` is the main switch. Without it, the server uses standard channel instructions.
- `COMPACT_DETAILS=true` only takes effect when `HEADLESS=true`. When headless mode is off, the `audience` parameter is not exposed and `COMPACT_DETAILS` has no effect.
- Both variables are parsed as strings by the Zod schema — only the exact value `"true"` enables them.

---

## Persistent Session Setup

Claude Code channels use the `--dangerously-load-development-channels` flag, which prompts for interactive confirmation on every session start. This means you need a persistent terminal session (tmux or screen) to confirm the prompt once, then leave the session running.

### Using tmux

```bash
# 1. Create a new tmux session
tmux new-session -s claude

# 2. Export environment variables
export SLACK_CHANNEL_ID="C0XXXXXXXXX"
export SLACK_BOT_TOKEN="xoxb-your-bot-token"
export SLACK_APP_TOKEN="xapp-your-app-token"
export ALLOWED_USER_IDS="U0YOURUSER0"
export HEADLESS="true"
export COMPACT_DETAILS="true"  # optional

# 3. Navigate to your project directory
cd /path/to/your/project

# 4. Launch Claude Code with the channel server
claude --dangerously-load-development-channels server:slack

# 5. Confirm the development channel prompt when it appears (one-time per session)
#    Type 'y' or 'yes' when prompted

# 6. Detach from tmux: press Ctrl+B, then D
```

To reattach later:

```bash
tmux attach-session -t claude
```

### Using screen

```bash
# 1. Create a new screen session
screen -S claude

# 2. Export environment variables
export SLACK_CHANNEL_ID="C0XXXXXXXXX"
export SLACK_BOT_TOKEN="xoxb-your-bot-token"
export SLACK_APP_TOKEN="xapp-your-app-token"
export ALLOWED_USER_IDS="U0YOURUSER0"
export HEADLESS="true"
export COMPACT_DETAILS="true"  # optional

# 3. Navigate to your project directory
cd /path/to/your/project

# 4. Launch Claude Code with the channel server
claude --dangerously-load-development-channels server:slack

# 5. Confirm the development channel prompt when it appears

# 6. Detach from screen: press Ctrl+A, then D
```

To reattach later:

```bash
screen -r claude
```

> **Note:** Claude Code sessions have no idle timeout. Once confirmed, the session runs indefinitely until the process is killed or the machine restarts. Socket Mode reconnections are handled automatically by the Slack SDK (~hourly).

---

## systemd Best-Effort Unit File

> **⚠️ Critical limitation:** The `--dangerously-load-development-channels` flag prompts for interactive confirmation on **every** session start. systemd cannot answer this prompt. This means systemd **cannot cold-start** a Claude Code channel session.
>
> **Use systemd only for auto-restart** after you've already confirmed the prompt in a tmux session. If the process crashes and restarts, it will hang at the confirmation prompt and require manual intervention.
>
> Once this server is published to the marketplace, the `--channels` flag replaces `--dangerously-load-development-channels` and eliminates the prompt entirely — making true systemd management possible.

With that caveat, here's a best-effort unit file for crash recovery:

```ini
[Unit]
Description=Claude Code Slack Channel (headless)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/your/project
Environment=SLACK_CHANNEL_ID=C0XXXXXXXXX
Environment=SLACK_BOT_TOKEN=xoxb-your-bot-token
Environment=SLACK_APP_TOKEN=xapp-your-app-token
Environment=ALLOWED_USER_IDS=U0YOURUSER0
Environment=HEADLESS=true
Environment=COMPACT_DETAILS=true
ExecStart=/usr/local/bin/claude --dangerously-load-development-channels server:slack
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Install the unit file
sudo cp claude-slack.service /etc/systemd/system/
sudo systemctl daemon-reload

# Do NOT enable/start via systemd directly — it will hang at the confirmation prompt.
# Instead:
# 1. Start the session interactively in tmux first
# 2. Confirm the development channel prompt
# 3. Then, if the process crashes, systemd will restart it
#    (but the restart will also hang at the prompt)
```

> **Recommendation:** For now, stick with tmux/screen for persistent sessions. Use systemd only if you need log rotation or process monitoring integration. True systemd compatibility requires marketplace publication, which eliminates the confirmation prompt.

---

## Permission Handling

In headless mode, Claude still requests permission for potentially dangerous operations (file writes, shell commands). Since no one is watching the terminal, you need a strategy for handling these.

### Option 1: Permission relay via Slack (Recommended)

The server's built-in permission relay posts approve/deny requests directly to Slack with interactive buttons. This is the default behavior — no additional configuration needed.

When Claude requests permission:
1. The server posts a Block Kit message in the active thread with **Approve** and **Deny** buttons
2. You click the button from your phone or desktop Slack
3. The verdict is forwarded to Claude, which proceeds or aborts

This keeps a human in the loop while supporting fully remote operation.

> **Note:** Make sure `ALLOWED_USER_IDS` includes all users who should be able to approve/deny permissions. Only listed users can interact with permission buttons.

### Option 2: Auto-approve permissions

```bash
claude --dangerously-load-development-channels server:slack --permission-mode auto
```

Claude evaluates each permission request and auto-approves based on safety analysis. Requires a Claude Team plan. No human approval needed, but Claude may still decline risky operations.

### Option 3: Skip all permissions

```bash
claude --dangerously-load-development-channels server:slack --dangerously-skip-permissions
```

All permissions are auto-approved without evaluation. Use **only** in isolated environments (containers, disposable VMs) where the blast radius is contained.

> **Recommendation:** Use the permission relay (Option 1) for production headless setups. It provides remote approval with zero additional configuration.

---

## Compact Details

When `HEADLESS=true`, Claude tags every reply with an `audience` parameter:

- **`operator`** — decisions, errors, blockers, questions, milestone progress, completion summaries. Always posted to Slack in full.
- **`detail`** — full test output, build logs, diffs, verbose summaries. Useful but not urgent.

### Default behavior (COMPACT_DETAILS=false)

Both `operator` and `detail` messages are posted to Slack in full. This can get noisy if Claude is producing verbose output.

### Compact mode (COMPACT_DETAILS=true)

When compact details is enabled:

1. **`operator` messages** are posted normally — you always see decisions, errors, and questions
2. **`detail` messages** are stored server-side instead of posted. The server posts a brief note: *"Details available — reply **details** to expand"*
3. **Retrieval:** Type `details` in the thread to fetch the stored content. The server responds with the full text formatted as Block Kit code blocks

**Storage limits:**

| Parameter | Value |
|---|---|
| TTL | 1 hour from last update |
| Max stored entries | 50 (oldest evicted first) |
| Block text limit | 3,000 characters per Block Kit section (longer text is split across multiple blocks) |

> **Note:** Detail retrieval is handled entirely server-side — the `details` keyword is intercepted before reaching Claude. This means Claude never sees "details" as a user message and won't try to respond to it.

---

## Troubleshooting

### Session died or disconnected

**Symptom:** Messages to Slack go unanswered.

**Fix:** Reattach to the tmux/screen session and check if the process is still running:

```bash
# tmux
tmux attach-session -t claude

# screen
screen -r claude
```

If the process exited, restart it and confirm the development channel prompt again.

### Claude not responding after long idle

**Symptom:** Session was working, went idle for hours, now Claude doesn't respond to new Slack messages.

Claude Code sessions have no idle timeout, so the session itself should still be alive. Check these:

1. **Socket Mode reconnection** — The Slack SDK reconnects automatically (~hourly), but network interruptions or VM sleep can break the WebSocket. Reattach to the tmux session and look for connection error messages.
2. **Context exhaustion** — Long-running sessions can fill the context window. Context compaction delays this significantly, but eventually the session may become unresponsive. Restart the session if this happens.
3. **MCP server process** — The channel server runs as a subprocess. If it crashed, Claude Code won't receive Slack messages. Check for error output in the terminal.

### Confirmation prompt on restart

**Symptom:** Process restarted (manually or via systemd) and is stuck waiting for input.

The `--dangerously-load-development-channels` flag prompts for confirmation on every session start. Reattach to the tmux session and type `y` to confirm.

> **Permanent fix:** Once the server is published to the Anthropic marketplace, use `--channels` instead of `--dangerously-load-development-channels`. This eliminates the prompt entirely.

### Permission requests not appearing in Slack

**Symptom:** Claude seems stuck, but no permission buttons appear in the channel.

1. **Check `ALLOWED_USER_IDS`** — Only users in this list can trigger the permission relay. Verify your user ID is included.
2. **Check the channel** — Permission requests are posted in the active thread. If no thread exists, the request may appear as a top-level message.
3. **Check bot permissions** — The bot needs `chat:write` scope to post messages. Verify in your Slack app configuration.

### Multiple instances interfering

If you're running multiple Claude Code sessions on the same machine (e.g., for different projects), each must use a separate `SLACK_CHANNEL_ID`. See the [multi-project VM guide](../examples/multi-project-vm.md) for the setup pattern.
