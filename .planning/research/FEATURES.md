# Feature Research

**Domain:** MCP Channel Server — Slack bridge for Claude Code (open-source, automation-pipeline focus)
**Researched:** 2026-03-26
**Confidence:** HIGH — based on two reference implementations (Anthropic official Telegram/Discord plugins, jeremylongshore/claude-code-slack-channel), canonical Channel protocol spec, and Slack SDK documentation.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features any working Channel MCP server must have. Missing these = server does not function.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Channel capability declaration | Protocol requirement — without `experimental['claude/channel']`, Claude ignores the server | LOW | Must declare both `claude/channel` and `claude/channel/permission` in Server capabilities |
| `reply` tool | Claude's only way to post to Slack — missing it means one-way communication | LOW | Single tool with `text` + optional `thread_ts` |
| Socket Mode connectivity with auto-reconnect | Without it, server goes dark ~hourly (routine WebSocket disconnects) | MEDIUM | `autoReconnectEnabled: true` is default in SDK; just don't disable it |
| Inbound channel filtering (channel ID + user allowlist) | Without filtering, any Slack user in any channel drives Claude | LOW | `SLACK_CHANNEL_ID` env var + `ALLOWED_USER_IDS` env var |
| Bot-loop prevention | Missing this causes infinite loops when Claude replies to itself | LOW | Filter both `event.subtype === 'bot_message'` AND `event.bot_id` — Bolt SDK has a gap on the latter |
| Message deduplication | Socket Mode is at-least-once delivery — on reconnect, same message can arrive twice | LOW | `Set<string>` of recent `ts` values with 30-second TTL |
| Startup ordering enforcement | `server.notification()` throws if called before `server.connect()` completes; Slack events arriving before transport is ready crash the server | MEDIUM | `await server.connect()` before `await socketMode.start()` |
| Stderr-only logging | After `server.connect()`, stdout is owned by MCP JSON-RPC — any stray write corrupts the protocol | LOW | Slack SDK logger must be explicitly redirected to `console.error()`; not the default |
| Global error handlers | Unhandled exception from WebSocket silently kills the MCP subprocess | LOW | `process.on('uncaughtException')` and `process.on('unhandledRejection')` registered before transport |
| Graceful shutdown | Claude Code may close stdin before SIGTERM — without this, sockets leak and next session fails | LOW | Handle `SIGTERM`, `SIGINT`, and `process.stdin.on('close')` |
| Ack within 3 seconds | Slack drops the event and retries if not acknowledged in time — causes duplicate delivery | LOW | `ack()` as first line in every event handler, wrapped in try/catch |
| Config validation at startup | Users misconfigure tokens; bad prefixes cause cryptic Slack API errors at runtime | LOW | Zod schema validating `xoxb-`/`xapp-` prefixes, user ID format `/^[UW][A-Z0-9]+$/` |
| Prompt injection hardening | Slack message content enters Claude's context — without explicit framing, injected instructions can manipulate Claude | LOW | `instructions` field in Server constructor must frame channel content as user input, not system commands |
| `unfurl_links: false` on outbound | Claude's replies containing URLs cause Slack to expand them into large previews, adding noise to operator workflows | LOW | Add `unfurl_links: false, unfurl_media: false` to all `chat.postMessage` calls |
| MCP `instructions` field | Without it, Claude doesn't know what `<channel source="slack">` tags mean or when to call `reply` | LOW | Multi-sentence instructions in Server constructor, injected into system prompt |

### Differentiators (Competitive Advantage)

Features that distinguish this server. Focused on the automation-pipeline use case that the community implementation does not serve.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Permission relay | The core differentiator: operators approve/deny Claude's sensitive tool calls from Slack without terminal access — the community implementation does not have this | HIGH | Receive `notifications/claude/channel/permission_request`, format for Slack, parse `yes/no {id}` replies, return verdict via `notifications/claude/channel/permission` |
| Thread state machine | Clean separation of conversation threads — questions from Claude start threads, replies continue them, top-level messages start new commands | MEDIUM | `ThreadTracker` classifying each incoming message as `reply` or `new_command`; enables deterministic conversation flow in automation pipelines |
| Zod config validation with typed output | Startup fails fast with clear field-level error messages instead of cryptic runtime failures | LOW | Validates token prefixes, user ID regex, provides typed `ChannelConfig` interface |
| Slack app manifest (`slack-app-manifest.yaml`) | Reproducible Slack app setup — users create the app correctly on first try instead of debugging scope errors | LOW | Ships in repo; documents exactly which bot scopes and Socket Mode settings are needed |
| npm package with provenance attestation | Installable as `npx claude-slack-channel` — lowers adoption barrier vs. "clone and run" | MEDIUM | GitHub Actions release workflow with `--provenance` flag; `bin` entry in package.json |
| Explicit automation pipeline focus in README | Users immediately know whether this tool fits their use case; avoids confusion with interactive assistant use cases | LOW | README comparison table vs. jeremylongshore implementation, acknowledgments section |
| Pure-function test architecture | All logic testable without mocking Slack or MCP — `shouldProcessMessage`, `parsePermissionReply`, `formatPermissionRequest`, `ThreadTracker` are pure functions | MEDIUM | Dependency-injected gate function pattern (adapted from community implementation with attribution) |
| CI pipeline with coverage | Open-source contributors can trust PRs don't regress behavior | LOW | GitHub Actions: typecheck, Biome lint, `bun test --coverage` |

### Anti-Features (Deliberately Out of Scope)

Features that look reasonable but conflict with the single-operator automation pipeline design.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-channel support | "Let Claude monitor multiple channels" | Deterministic routing is the point — automation pipelines need to know exactly where permission requests go; multi-channel adds routing logic and failure modes | Use a separate server instance per channel; `SLACK_CHANNEL_ID` is the config knob |
| Pairing code flow | Used by both official plugins and community implementation — "zero-config user access" | This server is for automation operators, not interactive personal assistants; pairing codes are an interactive UX pattern that adds complexity without value for unattended pipelines | `ALLOWED_USER_IDS` env var is sufficient; operators are known at deployment time |
| Rich tool surface (`react`, `edit_message`, `fetch_messages`, `download_attachment`) | Official Telegram/Discord plugins have these — "feature parity" | Out of scope for automation pipelines; `reply` is the only action an unattended pipeline needs; rich tools increase attack surface | `reply` with `thread_ts` covers all automation scenarios |
| Multi-user architecture with per-channel opt-in | Community implementation supports this | Single-operator model is simpler to reason about and audit for automation security | `ALLOWED_USER_IDS` comma-separated list handles team access |
| File exfiltration guard | Block `.env` from tool results — seen in community implementation | A useful security feature, but adds complexity and false-positive risk in automation contexts; the primary defense is the user allowlist | Document in README that Claude's tool access is controlled by MCP tool definitions, not the channel server |
| Integration tests against real Slack API | "Real end-to-end confidence" | Requires live credentials in CI, creates flaky tests on Slack API outages, adds secret management complexity | Manual integration test checklist covers this for v1; unit tests on pure functions cover the logic |
| `reply_broadcast: true` | Makes thread replies visible in main channel | Adds noise; strips some message attachments (Slack API behavior) | Top-level replies for new topics, threaded replies for continuations |
| Typing indicators | Official plugins send these | Adds a `chat.postMessage` round-trip for every inbound message; in automation pipelines, Claude's response latency is already high and indicators don't help | Skip; add only if user feedback shows it matters |

---

## Feature Dependencies

```
Permission relay
    └──requires──> Channel capability declaration (claude/channel/permission)
    └──requires──> Thread state machine (verdict must be sent to correct thread)
    └──requires──> Config validation (allowedUserIds must be valid to parse verdicts)

reply tool
    └──requires──> Channel capability declaration (claude/channel)
    └──requires──> Startup ordering enforcement (cannot call before transport ready)
    └──enhances──> Thread state machine (thread_ts enables threaded replies)

Thread state machine
    └──requires──> Bot-loop prevention (must not classify bot messages as commands)
    └──requires──> Message deduplication (duplicate messages would trigger duplicate threads)

Inbound message filtering
    └──requires──> Config validation (channelId and allowedUserIds must be parsed)
    └──requires──> Bot-loop prevention (filter happens before forwarding)

Startup ordering enforcement
    └──requires──> Graceful shutdown (clean disconnect on exit)
    └──requires──> Global error handlers (catch errors during startup race conditions)

npm publish workflow
    └──requires──> CI pipeline (publish only after all checks pass)
    └──requires──> Slack app manifest (users need setup instructions before running)

Slack app manifest
    └──enhances──> Config validation (manifest documents which scopes produce which tokens)
```

### Dependency Notes

- **Permission relay requires thread state machine:** When Claude sends a permission request, the operator replies in a thread. The verdict must be correctly associated with the original request by `request_id` — thread tracking ensures the reply is parsed correctly.
- **All outbound features require startup ordering enforcement:** Any call to `server.notification()` before `server.connect()` completes throws. The ordering constraint gates everything.
- **npm publish requires CI:** Provenance attestation only makes sense if CI is already verifying correctness. Publishing from a broken state defeats the purpose.
- **Bot-loop prevention and message deduplication are independent:** Both protect against duplicate message processing but for different reasons (bot replies vs. Socket Mode at-least-once delivery). They do not conflict.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what a Slack automation operator needs to use this server.

- [ ] Channel capability declaration — protocol foundation
- [ ] `reply` tool — Claude must be able to respond
- [ ] Socket Mode connectivity with auto-reconnect — server must stay alive
- [ ] Inbound channel filtering (channel ID + user allowlist) — security baseline
- [ ] Bot-loop prevention — without this, first reply causes infinite loop
- [ ] Message deduplication — Socket Mode guarantees at-least-once; dedup prevents double-processing
- [ ] Startup ordering enforcement — prevents crash-on-first-message
- [ ] Stderr-only logging — without this, first log line corrupts MCP and nothing works
- [ ] Global error handlers — unhandled WebSocket error kills the subprocess silently
- [ ] Graceful shutdown — sockets must close cleanly for next session to work
- [ ] Ack within 3 seconds — Slack retries unacked events
- [ ] Config validation at startup — without this, users spend hours debugging token format errors
- [ ] Prompt injection hardening — framing Slack content as user input, not system commands
- [ ] `unfurl_links: false` — URL previews break the operator workflow with visual noise
- [ ] MCP `instructions` field — Claude must understand the channel context
- [ ] Permission relay — the core differentiator and primary reason to use this server
- [ ] Thread state machine — required for permission relay to route verdicts correctly
- [ ] Slack app manifest — users cannot set up the Slack app without this
- [ ] Unit test coverage for all pure functions — CI cannot be trusted without it
- [ ] CI pipeline (typecheck, lint, test) — open-source quality gate
- [ ] README with comparison table and acknowledgments — operators need to know this is the right tool

### Add After Validation (v1.x)

- [ ] npm release workflow with provenance attestation — add once v1 is proven; lowers adoption barrier significantly
- [ ] Contributing guide, changelog, issue templates — add once external contributors appear
- [ ] Examples directory — add once users ask "how do I use this with my pipeline?"
- [ ] Manual integration test checklist — useful to formalize once the happy path is stable
- [ ] Lefthook pre-commit hooks — optional for contributors; ship `lefthook.yml` but don't require it

### Future Consideration (v2+)

- [ ] Typing indicators — only if user feedback shows automation operators want this signal
- [ ] File exfiltration guard — only if automation use cases involve sensitive file tool results
- [ ] Integration tests with mock Slack WebSocket server — only if CI flakiness from pure unit tests becomes a problem

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Channel capability declaration | HIGH | LOW | P1 |
| `reply` tool | HIGH | LOW | P1 |
| Socket Mode + auto-reconnect | HIGH | LOW | P1 |
| Inbound filtering (channel ID + allowlist) | HIGH | LOW | P1 |
| Bot-loop prevention | HIGH | LOW | P1 |
| Startup ordering enforcement | HIGH | LOW | P1 |
| Stderr-only logging | HIGH | LOW | P1 |
| Global error handlers | HIGH | LOW | P1 |
| Graceful shutdown | HIGH | LOW | P1 |
| Ack within 3 seconds | HIGH | LOW | P1 |
| Config validation (Zod) | HIGH | LOW | P1 |
| Prompt injection hardening | HIGH | LOW | P1 |
| `unfurl_links: false` | MEDIUM | LOW | P1 |
| MCP `instructions` field | HIGH | LOW | P1 |
| Message deduplication | MEDIUM | LOW | P1 |
| Permission relay | HIGH | HIGH | P1 |
| Thread state machine | HIGH | MEDIUM | P1 |
| Slack app manifest | HIGH | LOW | P1 |
| Unit test coverage | HIGH | MEDIUM | P1 |
| CI pipeline | HIGH | LOW | P1 |
| README + comparison table | HIGH | LOW | P1 |
| npm publish workflow | HIGH | MEDIUM | P2 |
| Contributing guide + changelog | MEDIUM | LOW | P2 |
| Examples directory | MEDIUM | LOW | P2 |
| Manual integration test checklist | MEDIUM | LOW | P2 |
| Lefthook pre-commit hooks | LOW | LOW | P2 |
| Typing indicators | LOW | LOW | P3 |
| File exfiltration guard | LOW | MEDIUM | P3 |
| Integration tests (mock Slack WS) | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Official Plugins (Telegram/Discord) | jeremylongshore/claude-code-slack-channel | This Server |
|---------|-------------------------------------|-------------------------------------------|-------------|
| Platform | Telegram, Discord | Slack | Slack |
| Permission relay | No | No | Yes — core differentiator |
| Thread state machine | No | No | Yes — required for permission relay |
| Pairing code flow | Yes | Yes | No — env var allowlist instead |
| Multi-channel | No (single channel) | Yes | No — single channel by design |
| Rich tool surface | Yes (`react`, `edit_message`, `fetch_messages`, `download_attachment`) | Yes (same set) | No — `reply` only |
| Bot-loop prevention | Yes | Yes (dual bot_id/subtype) | Yes (dual bot_id/subtype, adapted from community implementation) |
| `unfurl_links: false` | Unknown | Yes | Yes |
| Prompt injection defense | Yes | Yes | Yes |
| File exfiltration guard | Unknown | Yes | No (out of scope v1) |
| Config validation (typed) | Unknown | Unknown | Yes (Zod) |
| npm publishable | Unknown | No | Yes |
| CI pipeline | Unknown | Unknown | Yes |
| Slack app manifest | Unknown | Unknown | Yes |
| Unit test coverage | Unknown | Yes (500+ lines) | Yes |
| Open-source with attribution | Unknown | MIT | MIT (with acknowledgments) |
| Use case | Interactive personal assistant | Interactive personal assistant | Unattended automation pipeline |

---

## Sources

- [Claude Code Channels Reference](https://code.claude.com/docs/en/channels-reference) — canonical protocol spec, HIGH confidence
- [Anthropic official Telegram plugin](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/telegram) — feature reference, HIGH confidence
- [Anthropic official Discord plugin](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/discord) — feature reference, HIGH confidence
- [jeremylongshore/claude-code-slack-channel](https://github.com/jeremylongshore/claude-code-slack-channel) — community Slack implementation, HIGH confidence
- [docs/research-synthesis.md](../docs/research-synthesis.md) — synthesized research from parallel research streams, HIGH confidence
- [docs/implementation-plan.md](../docs/implementation-plan.md) — verified implementation with 9 critical gaps already resolved, HIGH confidence

---
*Feature research for: MCP Channel Server — Slack bridge (automation pipeline focus)*
*Researched: 2026-03-26*
