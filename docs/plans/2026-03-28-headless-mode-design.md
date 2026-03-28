# Headless Mode Design

Date: 2026-03-28
Branch: experiment/slack-session-binding

## Problem

Claude Code channel servers bridge Slack to a local Claude session, but assume someone is watching the terminal. For unattended operation on a remote VM — scheduled jobs, autonomous work, operator control strictly via Slack — there's no mechanism to ensure important output reaches Slack, no way to send commands from Slack, and no documented setup for persistent sessions.

## Goals

- Enable fully unattended Claude Code operation where Slack is the sole operator interface
- Route all operator-facing output to Slack with configurable verbosity
- Allow operators to trigger skills/commands from Slack
- Document the persistent-session setup for immediate use
- Structure toward marketplace submission for true headless cron compatibility

## Non-Goals (Deferred)

- Job lifecycle management / job IDs (build after learning from real usage)
- Multi-project shared channel routing
- Cloud-side scheduled tasks (incompatible with channels today)

## Design

### Component 1: Configuration & Mode Switch

New env var: `HEADLESS=true|false` (default: `false`)

Parsed in `config.ts` alongside existing vars. When `true`:
- Server instructions switch to the headless instruction set
- Inbound notifications include `mode: "headless"` in meta
- The `reply` tool exposes the `audience` parameter

When `false`, behavior is identical to the current session-binding instructions. No breaking changes.

### Component 2: `audience` Parameter on `reply`

Schema change:

```ts
const ReplyArgsSchema = z.object({
  text: z.string(),
  thread_ts: z.string().optional(),
  start_thread: z.boolean().optional(),
  audience: z.enum(['operator', 'detail']).optional(),
})
```

| `audience` | Default behavior | With `COMPACT_DETAILS=true` |
|---|---|---|
| `operator` | Post to Slack, plain text | Post to Slack, plain text |
| `detail` | Post to Slack, full content | Store; post summary + "reply **details** to expand" |
| omitted | Treated as `operator` | Treated as `operator` |

What Claude tags as `operator`:
- Job started / completed summaries
- Errors, blockers, warnings
- Questions requiring input
- Milestone progress ("finished step 3/6")

What Claude tags as `detail`:
- Full test output, build logs
- Diff summaries, verbose output
- Anything the operator might want but doesn't need by default

### Component 3: Headless Instructions

The server's `instructions` field switches based on `HEADLESS`. When enabled:

1. Slack is your only operator interface. The operator cannot see your terminal. Every actionable output must go through the `reply` tool.
2. When starting work (scheduled or prompted from Slack), reply with a brief start message using `start_thread: true` to anchor the job to a thread.
3. All subsequent output for that job goes in the thread.
4. Use `audience: "operator"` for: completions, errors, blockers, questions, milestone progress, warnings.
5. Use `audience: "detail"` for: full test output, build logs, diffs, verbose summaries.
6. When you finish work, post a completion summary as `operator`. If there's a natural next step, state it and ask whether to proceed.
7. If you're stuck or need a decision, ask in Slack and wait. Do not proceed without an answer.
8. Acknowledge every inbound Slack message.
9. Don't mirror routine tool calls, file reads, or intermediate reasoning.

### Component 4: Compact Details (Opt-In)

New env var: `COMPACT_DETAILS=true|false` (default: `false`)

When enabled, `detail` audience messages are stored server-side instead of posted:

- `Map<string, DetailEntry>` keyed by thread_ts
- Max 50 entries, oldest evicted on overflow
- 1-hour TTL, checked lazily on access
- Server posts a brief note: "Details available — reply **details** to expand"

Retrieval:
- Inbound messages matching `/^details?$/i` in a thread trigger lookup
- Found: post stored text as Block Kit code blocks (split at 3000 chars for Slack limits)
- Expired/missing: reply "No details available for this thread"
- Handled server-side — never forwarded to Claude as a channel notification

When disabled (default), `detail` messages post in full, same as `operator`.

### Component 5: Persistent Session Setup & Documentation

Channels require OAuth (not API key) and the `--dangerously-load-development-channels` confirmation prompt cannot be suppressed programmatically.

**Immediate path (persistent session):**
1. Install Claude Code on VM, `claude login` (one-time interactive)
2. Start tmux/screen session
3. Launch: `claude --dangerously-load-development-channels server:slack`
4. Confirm the dev channel prompt once
5. Set `HEADLESS=true` in the channel server's env
6. Session stays alive; `/loop` or Slack messages drive work

**Limitations:**
- Process death requires interactive restart (confirmation prompt)
- Document systemd/tmux-resurrect patterns as best-effort resilience

**Marketplace submission (parallel workstream):**
- Removes the confirmation prompt entirely
- Startup becomes: `claude --channels plugin:slack@marketplace-name`
- Enables true cron/systemd compatibility
- Requires passing Anthropic's security review
- Track as a separate issue/doc

### Component 6: Command Detection

Operators can trigger skills/commands from Slack using `!` prefix (not `/` — Slack intercepts that for native slash commands).

**Server behavior:**
- Detect inbound messages matching `^!(\S+)`
- Add `command_intent: "true"` to the notification meta
- Forward the full message text to Claude

**Instruction behavior:**
- When `command_intent` meta is present, execute the referenced skill/command
- Example: `!gsd:plan-phase 2 --auto` in Slack → Claude executes `/gsd:plan-phase 2 --auto`
- Works in both headless and non-headless mode

## Architecture Impact

All changes are additive to the existing codebase:

| File | Changes |
|---|---|
| `config.ts` | Add `HEADLESS` and `COMPACT_DETAILS` env vars |
| `server.ts` | Add `audience` to reply schema, conditional instructions, detail storage |
| `channel-bridge.ts` | Add `mode` and `command_intent` to notification meta |
| `slack-client.ts` | No changes |
| `threads.ts` | No changes |
| `types.ts` | Add `DetailEntry` interface |
| `docs/` | VM setup guide, marketplace submission tracker |

## Open Questions

- Should `COMPACT_DETAILS` have a configurable TTL and max entries, or are the defaults (1hr / 50) sufficient to start?
- Should command detection support multi-word aliases (e.g., `!plan phase 2`) or strictly match the skill name format?
- What's the minimum set of information needed for a marketplace submission?
