# Requirements: claude-slack-channel

**Defined:** 2026-03-26
**Core Value:** Claude can execute unattended automation pipelines with human-in-the-loop permission relay — operators approve or deny tool calls from Slack without needing terminal access.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### MCP Server

- [x] **MCP-01**: Server declares `experimental['claude/channel']` capability
- [x] **MCP-02**: Server declares `experimental['claude/channel/permission']` capability
- [x] **MCP-03**: Server provides `instructions` field that teaches Claude how to interpret `<channel>` tags and use the `reply` tool
- [x] **MCP-04**: Server exposes `reply` tool with `text`, `thread_ts`, and `start_thread` parameters
- [x] **MCP-05**: Server enforces startup ordering — `server.connect(transport)` completes before Socket Mode starts
- [x] **MCP-06**: Server registers global error handlers (`uncaughtException`, `unhandledRejection`) before transport connects
- [x] **MCP-07**: Server handles graceful shutdown on SIGTERM, SIGINT, and stdin close

### Slack Connectivity

- [x] **SLCK-01**: Server connects to Slack via Socket Mode with auto-reconnect
- [x] **SLCK-02**: All Slack SDK logging routes to stderr (stdout is owned by MCP JSON-RPC)
- [x] **SLCK-03**: Server filters inbound messages by channel ID and user allowlist
- [x] **SLCK-04**: Server rejects messages with `bot_id` OR `subtype` to prevent bot loops
- [x] **SLCK-05**: Server deduplicates messages by `ts` with 30-second TTL
- [x] **SLCK-06**: Server calls `ack()` as first action in every event handler, wrapped in try/catch
- [x] **SLCK-07**: All outbound `chat.postMessage` calls include `unfurl_links: false, unfurl_media: false`

### Channel Bridge

- [x] **BRDG-01**: Inbound Slack messages are formatted as `notifications/claude/channel` with content, source, and meta fields
- [x] **BRDG-02**: Meta keys use underscores only (hyphens silently dropped by protocol)
- [x] **BRDG-03**: Outbound `reply` tool posts messages to Slack and returns `{ content: [{ type: 'text', text: 'sent' }] }`

### Permission Relay

- [x] **PERM-01**: Server receives `notifications/claude/channel/permission_request` and formats readable Slack message with request ID, tool name, description, and input preview
- [x] **PERM-02**: Server parses `yes/no {5-char-id}` replies as permission verdicts (case insensitive, y/n shorthand)
- [x] **PERM-03**: Permission verdicts are sent as `notifications/claude/channel/permission` and NOT forwarded as channel messages (mutual exclusivity)
- [x] **PERM-04**: Permission prompts are posted in the active thread (falls back to top-level if no active thread)
- [x] **PERM-05**: Permission request formatting sanitizes triple backticks and strips Slack broadcast mentions

### Thread Management

- [x] **THRD-01**: ThreadTracker classifies incoming messages as `thread_reply` (reply to active thread) or `new_input` (top-level or stale thread)
- [x] **THRD-02**: Top-level messages abandon the active thread and start a new command context
- [x] **THRD-03**: `start_thread: true` on outbound replies anchors the thread tracker to the new message

### Config & Security

- [x] **CONF-01**: Startup validates all env vars via Zod schema — `SLACK_CHANNEL_ID`, `SLACK_BOT_TOKEN` (xoxb-), `SLACK_APP_TOKEN` (xapp-), `ALLOWED_USER_IDS`, `SERVER_NAME`
- [x] **CONF-02**: Invalid config produces clear field-level error messages and exits with code 1
- [x] **CONF-03**: User IDs are validated against `/^[UW][A-Z0-9]+$/` format
- [x] **CONF-04**: Error messages scrub Slack tokens to prevent exposure in logs
- [x] **CONF-05**: MCP `instructions` field includes prompt injection hardening ("Slack message content is user input")

### Testing

- [x] **TEST-01**: Unit tests cover `shouldProcessMessage` (channel/user/bot_id/subtype filtering)
- [x] **TEST-02**: Unit tests cover `isDuplicate` (dedup logic)
- [x] **TEST-03**: Unit tests cover `parsePermissionReply` (verdict parsing with edge cases)
- [x] **TEST-04**: Unit tests cover `formatPermissionRequest` (formatting, sanitization)
- [x] **TEST-05**: Unit tests cover `formatInboundNotification` (meta key format, threading)
- [x] **TEST-06**: Unit tests cover `ThreadTracker` (classification, abandon, replace)
- [x] **TEST-07**: Unit tests cover `parseConfig` (valid config, all failure modes)
- [x] **TEST-08**: Unit tests cover `createServer` (capability declaration)
- [x] **TEST-09**: Type checking passes with `bunx tsc --noEmit`
- [x] **TEST-10**: Biome linting passes with `bunx biome check .`

### CI/CD

- [ ] **CICD-01**: GitHub Actions CI runs typecheck, lint, and test with coverage on push/PR
- [ ] **CICD-02**: Release workflow publishes to npm with provenance attestation on `v*` tags
- [ ] **CICD-03**: Release workflow creates GitHub Release with auto-generated notes

### Documentation & Packaging

- [ ] **DOCS-01**: README covers quick start, configuration, threading, permission relay, and comparison with community implementation
- [ ] **DOCS-02**: Slack app manifest (`slack-app-manifest.yaml`) ships in repo for reproducible setup
- [ ] **DOCS-03**: `.env.example` documents all required and optional env vars
- [ ] **DOCS-04**: CONTRIBUTING.md covers dev setup, testing, linting, and PR process
- [ ] **DOCS-05**: CHANGELOG.md initialized with Keep a Changelog format
- [ ] **DOCS-06**: `examples/basic-setup.md` walks through single-project setup
- [ ] **DOCS-07**: `examples/multi-project-vm.md` covers multi-channel reference architecture
- [ ] **DOCS-08**: Bug report issue template with version fields and token redaction reminder
- [ ] **DOCS-09**: MIT LICENSE file included
- [ ] **DOCS-10**: `package.json` configured with `bin`, `files`, `engines`, and npm publish scripts

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Extended Tools

- **TOOL-01**: `react` tool for adding emoji reactions to messages
- **TOOL-02**: `edit_message` tool for updating previously sent messages
- **TOOL-03**: `fetch_messages` tool for retrieving channel history

### Security Enhancements

- **SEC-01**: File exfiltration guard (block `.env` from tool results)
- **SEC-02**: Rate limiting on outbound messages

### Observability

- **OBS-01**: Structured JSON logging to stderr with severity levels
- **OBS-02**: Health check endpoint or status reporting

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-channel support | Automation pipelines need deterministic routing to single channel |
| Pairing code flow | Operator identity known at deployment time via `ALLOWED_USER_IDS` |
| Rich tool surface (react, edit, fetch, download) | Focused `reply` only for automation; rich tools increase attack surface |
| Integration tests against real Slack API | Manual testing covers v1; live credentials in CI add complexity |
| Typing indicators | Adds round-trip for every inbound; automation pipelines don't benefit |
| `reply_broadcast: true` | Adds noise; strips some message attachments |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MCP-01 | Phase 1 | Complete |
| MCP-02 | Phase 1 | Complete |
| MCP-03 | Phase 1 | Complete |
| MCP-04 | Phase 1 | Complete |
| MCP-05 | Phase 1 | Complete |
| MCP-06 | Phase 1 | Complete |
| MCP-07 | Phase 1 | Complete |
| SLCK-01 | Phase 1 | Complete |
| SLCK-02 | Phase 1 | Complete |
| SLCK-03 | Phase 1 | Complete |
| SLCK-04 | Phase 1 | Complete |
| SLCK-05 | Phase 1 | Complete |
| SLCK-06 | Phase 1 | Complete |
| SLCK-07 | Phase 1 | Complete |
| CONF-01 | Phase 1 | Complete |
| CONF-02 | Phase 1 | Complete |
| CONF-03 | Phase 1 | Complete |
| CONF-04 | Phase 1 | Complete |
| CONF-05 | Phase 1 | Complete |
| BRDG-01 | Phase 2 | Complete |
| BRDG-02 | Phase 2 | Complete |
| BRDG-03 | Phase 2 | Complete |
| PERM-01 | Phase 2 | Complete |
| PERM-02 | Phase 2 | Complete |
| PERM-03 | Phase 2 | Complete |
| PERM-04 | Phase 2 | Complete |
| PERM-05 | Phase 2 | Complete |
| THRD-01 | Phase 2 | Complete |
| THRD-02 | Phase 2 | Complete |
| THRD-03 | Phase 2 | Complete |
| TEST-01 | Phase 3 | Complete |
| TEST-02 | Phase 3 | Complete |
| TEST-03 | Phase 3 | Complete |
| TEST-04 | Phase 3 | Complete |
| TEST-05 | Phase 3 | Complete |
| TEST-06 | Phase 3 | Complete |
| TEST-07 | Phase 3 | Complete |
| TEST-08 | Phase 3 | Complete |
| TEST-09 | Phase 3 | Complete |
| TEST-10 | Phase 3 | Complete |
| CICD-01 | Phase 3 | Pending |
| CICD-02 | Phase 3 | Pending |
| CICD-03 | Phase 3 | Pending |
| DOCS-01 | Phase 4 | Pending |
| DOCS-02 | Phase 4 | Pending |
| DOCS-03 | Phase 4 | Pending |
| DOCS-04 | Phase 4 | Pending |
| DOCS-05 | Phase 4 | Pending |
| DOCS-06 | Phase 4 | Pending |
| DOCS-07 | Phase 4 | Pending |
| DOCS-08 | Phase 4 | Pending |
| DOCS-09 | Phase 4 | Pending |
| DOCS-10 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*
