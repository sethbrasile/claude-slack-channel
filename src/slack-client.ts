import type { Logger } from '@slack/logger'
import { LogLevel, SocketModeClient } from '@slack/socket-mode'
import { WebClient } from '@slack/web-api'
import { safeErrorMessage } from './config.ts'

// ============================================================
// Interfaces
// ============================================================

export interface MessageFilter {
  channelId: string
  allowedUserIds: string[]
}

export interface SlackEvent {
  type?: string
  channel?: string
  user?: string
  bot_id?: string
  subtype?: string
  ts?: string
  thread_ts?: string
  text?: string
}

export interface SlackMessage {
  text: string
  user: string
  channel: string
  ts: string
  thread_ts?: string
}

export type MessageHandler = (message: SlackMessage) => void | Promise<void>

// ============================================================
// Pure filter function — injectable for testability
// ============================================================

/**
 * Determines whether a Slack event should be forwarded to Claude.
 *
 * Checks (in order):
 * 1. Reject if subtype is present (e.g. bot_message, message_changed)
 * 2. Reject if bot_id is present — Bolt SDK gap: some bot messages carry bot_id
 *    but not subtype:'bot_message'. Checking bot_id prevents bot reply loops.
 * 3. Reject if channel or user is absent
 * 4. Reject if wrong channel
 * 5. Reject if user not in allowlist
 */
export function shouldProcessMessage(event: SlackEvent, filter: MessageFilter): boolean {
  if (event.subtype) return false
  if (event.bot_id) return false
  if (!event.channel || !event.user) return false
  if (event.channel !== filter.channelId) return false
  if (!filter.allowedUserIds.includes(event.user)) return false
  return true
}

// ============================================================
// Deduplication — injectable seen Set for testability
// ============================================================

/**
 * Returns true if ts has been seen before within the provided Set.
 * TTL expiry is handled in createSlackClient via a module-level Map.
 * This pure function stays simple for unit testing.
 */
export function isDuplicate(ts: string, seen: Set<string>): boolean {
  if (seen.has(ts)) return true
  seen.add(ts)
  return false
}

// ============================================================
// Stderr logger — prevents any Slack SDK output going to stdout
// ============================================================

/**
 * Returns a Logger implementation that routes all output to stderr.
 * Must be passed to both SocketModeClient and WebClient constructors
 * to prevent any Slack SDK messages from corrupting the MCP JSON-RPC
 * transport on stdout.
 */
export function createStderrLogger(): Logger {
  return {
    debug: (...msgs: unknown[]) => console.error('[slack:debug]', ...msgs),
    info: (...msgs: unknown[]) => console.error('[slack:info]', ...msgs),
    warn: (...msgs: unknown[]) => console.error('[slack:warn]', ...msgs),
    error: (...msgs: unknown[]) => console.error('[slack:error]', ...msgs),
    setLevel: (_level: LogLevel) => {},
    setName: (_name: string) => {},
    getLevel: () => LogLevel.INFO,
  }
}

// ============================================================
// Slack client factory
// ============================================================

// TTL for seen ts entries: 30 seconds
const DEDUP_TTL_MS = 30_000

/**
 * Creates the Slack Socket Mode client.
 *
 * Returns { socketMode, web } so callers can:
 * - Call socketMode.start() / socketMode.disconnect() for lifecycle management
 * - Call web.chat.postMessage() for outbound messages (reply tool, permission relay)
 *
 * IMPORTANT: This function must only be called AFTER server.connect(transport)
 * has completed. The MCP transport must be established before Slack can start
 * receiving messages and sending notifications.
 *
 * NOTE: All chat.postMessage calls must include unfurl_links: false, unfurl_media: false
 * to prevent Slack from expanding URLs in Claude's replies.
 */
export function createSlackClient(
  appToken: string,
  botToken: string,
  filter: MessageFilter,
  onMessage: MessageHandler,
): { socketMode: SocketModeClient; web: WebClient } {
  const logger = createStderrLogger()

  // TTL dedup map: ts -> expiry timestamp
  const seenTs = new Map<string, number>()

  const web = new WebClient(botToken, { logger, retryConfig: { retries: 3 } })

  const socketMode = new SocketModeClient({
    appToken,
    logger,
    autoReconnectEnabled: true,
  })

  socketMode.on(
    'message',
    async ({ event, ack }: { event: SlackEvent; ack: () => Promise<void> }) => {
      // Ack-first: Slack requires acknowledgment within 3 seconds.
      // Wrapped in own try/catch so ack failure doesn't block processing.
      try {
        await ack()
      } catch (err) {
        console.error('[slack-client] ack failed:', safeErrorMessage(err))
        return
      }

      if (!shouldProcessMessage(event, filter)) return

      // TTL dedup: expire old entries, then check/add current ts
      const now = Date.now()
      for (const [ts, expiry] of seenTs.entries()) {
        if (now > expiry) seenTs.delete(ts)
      }

      const ts = event.ts ?? ''
      if (!ts || seenTs.has(ts)) return
      seenTs.set(ts, now + DEDUP_TTL_MS)

      const msg: SlackMessage = {
        text: event.text ?? '',
        user: event.user ?? '',
        channel: event.channel ?? '',
        ts,
        ...(event.thread_ts ? { thread_ts: event.thread_ts } : {}),
      }

      await onMessage(msg)
    },
  )

  return { socketMode, web }
}
