# Headless Mode — Research Findings & Validation Plan

Date: 2026-03-29
Branch: experiment/slack-session-binding

## Research Findings

### 1. Instructions survive context compaction

The `instructions` field in the MCP Server constructor is injected into Claude's **system prompt**, not the conversation history. Context compaction summarizes conversation history but preserves the system prompt. This means headless-mode instructions will persist across compaction cycles without any special handling.

Additionally, a `PostCompact` hook event exists that can re-inject context after compaction if needed — but for our case, the system prompt path should be sufficient.

### 2. MCP server process is independent of context

The channel MCP server runs as a **stdio subprocess** of Claude Code. It is not part of the context window. The process persists through compaction, and the stdio pipe between Claude Code and the MCP server remains connected. Socket Mode reconnects are handled by the Slack SDK automatically (~hourly).

### 3. No session idle timeout

Claude Code sessions have **no documented idle timeout**. Sessions persist until:
- The process is killed (SIGTERM/SIGINT)
- stdin closes (parent process exits)
- Context window is exhausted (but compaction delays this significantly)

For a tmux/screen session, this means indefinite operation.

### 4. `audience` parameter approach is sound

- Tool schemas are returned dynamically via `ListToolsRequestSchema` handler (at request time, not connect time)
- Adding optional enum params to existing tools is valid — no protocol restrictions
- The `instructions` field can guide Claude to use specific parameter values
- Claude follows system-prompt instructions for tool usage patterns — this is the documented extensibility path

### 5. `!command` detection is instruction-driven, not protocol-driven

There is **no protocol-level mechanism** for triggering skills from channel messages. The approach is:
1. Server detects `!` prefix, adds `command_intent: "true"` to notification meta
2. `instructions` tell Claude: "When `command_intent` is present, invoke the referenced skill"
3. Claude sees the skill name in the message text and invokes the Skill tool

This works because skills are loaded into Claude's context at session start. The `command_intent` meta is a hint, not a command — Claude still has to interpret and execute.

### 6. The confirmation prompt is the only hard blocker for true automation

- `--dangerously-load-development-channels` prompts **every session start** (per-session, not persisted)
- **No documented way to suppress this programmatically**
- Marketplace-published channels skip it entirely via `--channels`
- Organization `allowedChannelPlugins` setting also skips it
- For now: interactive confirmation once in tmux, then session runs unattended

### 7. Permission handling for unattended operation

Three viable paths:
- **Permission relay** (already implemented): Claude sends permission requests to Slack, operator replies yes/no
- `--permission-mode auto`: Requires Team plan, uses Claude to evaluate safety (no human in loop)
- `--dangerously-skip-permissions`: All permissions auto-approved (container/VM only)

Permission relay is the best fit — it keeps a human in the loop via Slack.

### 8. Known risk: silent notification loss

From existing research: "Notifications can be silently undelivered with multiple MCP servers (issues #36472, #36802)." Workaround is a fresh session. For headless mode, this means we should consider a health-check mechanism (e.g., periodic heartbeat from server, alert if Claude doesn't respond).

---

## What's Actually Uncertain

After research, most of the design is on solid ground. The remaining unknowns are **behavioral**, not architectural:

| Question | Risk | Why it matters |
|---|---|---|
| Will Claude reliably tag `audience` on replies? | Medium | If Claude ignores it, headless output is noisy or silent |
| Will Claude execute `!skills` from Slack messages? | Medium | Core UX for headless command-and-control |
| Does compaction lose the "session binding" behavior? | Low | Instructions are in system prompt, should persist |
| Is compact details worth the complexity? | Design | May be premature — defer until real usage shows need |

---

## Minimal Validation Plan

**Goal:** Confirm the two behavioral unknowns with the smallest possible code change, using a live Claude Code + Slack session.

### Test 1: `audience` parameter on reply tool

**Change:** Add optional `audience` enum to `ReplyArgsSchema` and `ListToolsRequestSchema` handler. Update instructions to describe when to use each value. No server-side behavior change — just log what Claude sends.

**What to observe:**
- Does Claude include `audience` in reply tool calls?
- Does it choose `operator` vs `detail` appropriately?
- Does it still work when no `audience` is specified? (backwards compat)

**Pass criteria:** Claude uses `audience` on >80% of replies within a few-message conversation, with reasonable classification.

### Test 2: `!command` execution from Slack

**Change:** Add `command_intent` meta key detection in `channel-bridge.ts` for messages starting with `!`. Update instructions to explain the `!` prefix convention.

**What to observe:**
- Send `!help` from Slack — does Claude invoke a response?
- Send `!gsd:progress` — does Claude invoke the skill?
- Send a normal message after — does Claude treat it normally (not as a command)?

**Pass criteria:** Claude attempts to execute the skill referenced in the `!` message. Doesn't need to succeed (skill may not be available) — just needs to show intent to invoke.

### Test 3: Session persistence (manual observation)

**No code change.** Just run a headless-ish session in tmux:
- Start Claude Code with the channel server
- Send a few messages from Slack
- Wait 30+ minutes idle
- Send another message
- Confirm the session is still responsive

**Pass criteria:** Session responds after idle period without manual intervention.

---

## What to Defer

- **Compact details storage** — Skip for validation. It's an optimization that only matters if `audience: "detail"` works and produces too much noise. Validate the simpler version first.
- **Persistent session documentation** — Write after validation confirms the approach works.
- **Marketplace submission** — Entirely separate workstream. Don't block on it.
- **Health-check / heartbeat** — Nice to have, but not needed to validate the core concept.
