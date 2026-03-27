# Stack Research

**Domain:** MCP server bridging Claude Code to Slack via Socket Mode
**Researched:** 2026-03-26
**Confidence:** HIGH (verified against npm registry, official docs, and existing research synthesis)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Bun | >=1.3.11 | Runtime, package manager, test runner | Runs TypeScript directly with no compilation step; acquired by Anthropic Dec 2025 and is now the runtime Claude Code, the Claude Agent SDK, and official plugins (Telegram, Discord) are built on; fastest cold start for stdio subprocess spawning |
| TypeScript | 5.x (bundled with Bun) | Type safety, IDE support | Not installed separately — Bun ships its own TypeScript transpiler; tsconfig is used as a pure type-checker contract via `noEmit: true` |
| `@modelcontextprotocol/sdk` | ^1.28.0 | MCP server framework, stdio transport | Official Anthropic SDK; v1.28.0 is the latest stable as of March 2026; provides `McpServer`, `StdioServerTransport`, tool registration, and `server.notification()` for sending channel events to Claude |
| `@slack/socket-mode` | ^2.0.5 | Slack Socket Mode WebSocket client | v2.x is the current stable series; no public URL required, works through NAT/firewalls; SDK handles auto-reconnect (~hourly disconnects are normal and expected) |
| `@slack/web-api` | ^7.15.0 | Slack REST API client for posting messages | Required alongside `socket-mode` for outbound `chat.postMessage` calls; separate from Socket Mode by design |
| `zod` | ^4.3.6 | Runtime config validation with typed output | v4 is the current stable series as of March 2026; use `z.string().startsWith()` patterns for token prefix validation; see Zod v4 notes below |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/bun` | ^1.3.11 | TypeScript type definitions for Bun globals | Always — replaces the deprecated `bun-types` package; auto-loaded by TypeScript, no `"types"` field needed in tsconfig |
| `@biomejs/biome` | ^2.4.8 | Formatting + linting in a single binary | Always — replaces ESLint + Prettier; no plugin chain; `bunx biome ci .` in CI (strict mode, exit 1 on violations) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Biome | Formatting and linting | `biome.json` schema URL must match installed version: `https://biomejs.dev/schemas/2.4.X/schema.json`; v2 changed `ignore`/`include` to a single `includes` field and moved `organizeImports` to `assist.actions.source.organizeImports` |
| `bunx tsc --noEmit` | Type checking only | Bun runs TS directly; TypeScript is never used as a compiler in this project — only as a type checker invoked via `bunx tsc` |
| GitHub Actions + `oven-sh/setup-bun@v2` | CI pipeline | `setup-bun@v2` reads the `engines.bun` field from `package.json` automatically; run `--frozen-lockfile` to catch lockfile drift |
| `bun.lock` (text format) | Reviewable dependency lockfile | Set `saveTextLockfile = true` in `bunfig.toml`; produces JSONC-format `bun.lock` instead of binary `bun.lockb`, making PR diffs readable |

## Installation

```bash
# Runtime dependencies
bun add @modelcontextprotocol/sdk @slack/socket-mode @slack/web-api zod

# Dev dependencies (exact versions for tooling stability)
bun add -d @types/bun typescript @biomejs/biome --exact
```

Note: Do not install `bun` itself as an npm package — it runs the project. The `engines.bun` field in `package.json` communicates the minimum version to CI and users.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@slack/socket-mode` | `@slack/bolt` | Bolt is better for multi-workspace apps and HTTP endpoints; this project has no HTTP endpoint and uses raw Socket Mode for fine-grained control over message filtering and `bot_id` handling |
| `zod` v4 | `zod` v3 | v3 if the broader project ecosystem is pinned to v3; v3 ships as a subpath `import { z } from "zod/v3"` during the transition window. For a greenfield project, use v4. |
| `@biomejs/biome` | ESLint + Prettier | ESLint if you need a rule ecosystem that Biome doesn't yet cover; Prettier if team insists on separate formatter. For this project, Biome is correct — single dependency, no plugin chain, significantly faster. |
| Bun | Node.js + tsx | Node if deploying to an environment without Bun support or if publishing as a library where consumers run Node; for this MCP server (spawned by Claude Code on developer machines), Bun is appropriate and preferred by Anthropic |
| `@modelcontextprotocol/sdk` v1.x | `@modelcontextprotocol/sdk` v2.x (future) | v2 was anticipated for Q1 2026 but has not yet shipped as stable; use v1.28.x until v2 is released and ecosystem adoption confirms stability |
| `StdioServerTransport` | StreamableHTTP transport | HTTP transport for remote MCP servers accessible over a network; this project is a stdio subprocess spawned by Claude Code — stdio is the only correct transport |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `bun-types` | Deprecated; replaced by `@types/bun` since Bun incorporated official DefinitelyTyped support | `@types/bun` |
| `"types": ["bun-types"]` in tsconfig | Incompatible with `@types/bun`; causes duplicate type definitions and TS errors | Remove `"types"` from tsconfig; `@types/*` packages are auto-loaded |
| `"outDir"`, `"rootDir"`, `"declaration"` in tsconfig | These emit-related options conflict with `"noEmit": true`; Bun runs TS directly and never compiles to JS | Remove all emit options; only `noEmit: true` |
| `"module": "ESNext"` in tsconfig | Causes TypeScript to transform module syntax; Bun handles this itself | `"module": "Preserve"` — tells TS to leave module syntax alone |
| stdout after `server.connect()` | After the MCP transport connects, stdout is owned by JSON-RPC; any non-protocol write corrupts the stream and crashes Claude Code | `console.error()` for all logging including the Slack SDK logger (redirect via custom `LogLevel`-compatible logger) |
| Slack `@slack/bolt` | Bolt's abstraction wraps `ack()` in ways that are harder to test and control; also wraps the logger in ways that can leak to stdout | `@slack/socket-mode` directly for this use case |
| `bunx biome check --write` in CI | Auto-fix in CI masks violations rather than failing the build | `bunx biome ci .` in CI (fails on any violation, never modifies files) |

## Stack Patterns by Variant

**If deploying as a remote MCP server (not subprocess):**
- Replace `StdioServerTransport` with `StreamableHttpServerTransport`
- Add an HTTP framework (Bun's built-in `Bun.serve()` is sufficient)
- Remove the stdin-close graceful shutdown handler (not applicable)

**If targeting Zod v3 (existing project with v3 dependencies):**
- Import as `import { z } from "zod/v3"` — the v3 subpath is available while the ecosystem migrates
- Key API differences: `z.string().email()` in v3 vs `z.email()` in v4; `z.string().uuid()` in v3 vs `z.uuid()` in v4 (different UUID compliance)

**If publishing to npm (which this project does):**
- Set `"files": ["src", "!src/__tests__", "README.md", "LICENSE"]` in package.json
- Add `"prepublishOnly": "bunx tsc --noEmit && bun test"` to catch regressions before publish
- Use `npm publish --provenance` for attestation (GitHub Actions has native support)

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@modelcontextprotocol/sdk` ^1.28.0 | `@slack/socket-mode` ^2.0.5 | No known conflicts; both are pure ESM packages compatible with Bun's module resolution |
| `@biomejs/biome` ^2.4.8 | Bun 1.3.x | Use `bunx biome` not `npx biome`; Biome 2.x requires schema URL update from 1.x (`/schemas/2.X.Y/schema.json`) |
| `zod` ^4.3.6 | `@modelcontextprotocol/sdk` ^1.28.0 | MCP SDK does not use Zod internally; no version coupling; safe to use Zod v4 independently |
| `@types/bun` ^1.3.11 | TypeScript 5.x | `@types/bun` mirrors the Bun runtime version (1.3.11 types = 1.3.11 runtime); keep in sync |
| `@slack/socket-mode` ^2.0.5 | `@slack/web-api` ^7.15.0 | These are always used together; the node-slack-sdk monorepo ships them as separate packages but they share compatible internal types |

## Zod v4 Notes

Zod v4 (current stable) has breaking API changes from v3. For this project's config validation use case:

- Token prefix validation: `z.string().startsWith('xoxb-')` — unchanged API
- User ID format: `z.string().regex(/^[UW][A-Z0-9]+$/)` — unchanged API
- Object parsing: `z.object({...}).parse(process.env)` — unchanged API
- Error handling: use `schema.safeParse()` for graceful validation errors at startup

The string format methods that changed (`z.email()`, `z.uuid()`, etc.) are not needed for this project's validation patterns.

## MCP SDK Key API Notes

The `McpServer` constructor accepts an `instructions` string in the server info object. This string is injected into Claude's system prompt and is critical for the Channel protocol — without it, Claude doesn't understand the `<channel source="slack" ...>` notification format or when to call the `reply` tool.

```typescript
const server = new McpServer({
  name: 'claude-slack-channel',
  version: '0.1.0',
  instructions: 'You are connected to Slack channel #channel-name via Socket Mode. ...'
})
```

The `capabilities` second parameter is where experimental Channel capabilities are declared:

```typescript
const server = new McpServer(
  { name: '...', version: '...', instructions: '...' },
  {
    capabilities: {
      experimental: {
        'claude/channel': {},
        'claude/channel/permission': {},
      }
    }
  }
)
```

Confidence on exact `capabilities` key format: MEDIUM — derived from the Channel protocol spec (`experimental/claude/channel`) and research synthesis; not independently verified against SDK source. The meta key rule (underscores only in notification payloads) does NOT apply to capability declaration keys.

## Sources

- [npm: @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — confirmed v1.28.0 as latest (March 25, 2026)
- [GitHub: modelcontextprotocol/typescript-sdk releases](https://github.com/modelcontextprotocol/typescript-sdk/releases) — verified v1.28.0 release date and recent changelog
- [npm: @slack/socket-mode](https://www.npmjs.com/package/@slack/socket-mode) — confirmed v2.0.5 as latest
- [npm: @slack/web-api](https://www.npmjs.com/package/@slack/web-api) — confirmed v7.15.0 as latest
- [Slack: Migrating socket-mode to v2.x](https://docs.slack.dev/tools/node-slack-sdk/migration/migrating-socket-mode-package-to-v2/) — v2 breaking changes (event renames, property removals)
- [npm: @biomejs/biome](https://www.npmjs.com/package/@biomejs/biome) — confirmed v2.4.8 as latest (March 2026)
- [Biome: Upgrade to v2](https://biomejs.dev/guides/upgrade-to-biome-v2/) — confirmed `includes` field consolidation, `organizeImports` move to `assist`
- [npm: zod](https://www.npmjs.com/package/zod) — confirmed v4.3.6 as latest
- [Zod v4 migration guide](https://zod.dev/v4/changelog) — verified breaking changes; confirmed v4 is stable
- [npm: @types/bun](https://www.npmjs.com/package/@types/bun) — confirmed v1.3.11 mirrors Bun runtime v1.3.11
- [Bun v1.3.11 blog](https://bun.com/blog/bun-v1.3.11) — confirmed latest Bun release
- [MCP TypeScript SDK server docs](https://ts.sdk.modelcontextprotocol.io/documents/server.html) — McpServer constructor patterns
- `docs/research-synthesis.md` (project file) — 9 critical gaps, tsconfig corrections, Slack patterns (HIGH confidence — prior research by this project)

---
*Stack research for: Claude Code Channel MCP server for Slack*
*Researched: 2026-03-26*
