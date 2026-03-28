#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { WebClient } from '@slack/web-api'
import { z } from 'zod'
import packageJson from '../package.json'
import { formatInboundNotification } from './channel-bridge.ts'
import { parseConfig, safeErrorMessage } from './config.ts'
import {
  formatPermissionBlocks,
  formatPermissionResult,
  PermissionRequestSchema,
  parseButtonAction,
  parsePermissionReply,
} from './permission.ts'
import { createSlackClient } from './slack-client.ts'
import { ThreadTracker } from './threads.ts'
import type { ChannelConfig, PermissionRequest } from './types.ts'

// Module-level schema — used in makeReplyHandler (library path) and CLI block via wireHandlers
const ReplyArgsSchema = z.object({
  text: z.string(),
  thread_ts: z.string().optional(),
  start_thread: z.boolean().optional(),
})

/**
 * Factory for the reply tool handler. Returns the handler function that processes
 * CallToolRequest for the 'reply' tool, posting to Slack via web.chat.postMessage.
 * Exported for direct unit testing (M14) — allows tests to invoke handler logic
 * without going through createServer or the CLI block.
 */
export function makeReplyHandler(web: WebClient, tracker: ThreadTracker, config: ChannelConfig) {
  return async (request: {
    params: { name: string; arguments?: unknown }
  }): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> => {
    if (request.params.name !== 'reply') {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      }
    }

    const parsed = ReplyArgsSchema.safeParse(request.params.arguments)
    if (!parsed.success) {
      return {
        content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
        isError: true,
      }
    }
    const args = parsed.data
    // Strip Slack broadcast mentions (<!channel>, <!here>, <!everyone>)
    // to prevent Claude's replies from triggering workspace-wide notifications
    const text = args.text.replaceAll('<!', '<\u200b!')
    // Explicit thread_ts takes priority; otherwise fall back to the active
    // thread so follow-up replies stay threaded automatically.
    // start_thread omits thread_ts so the message posts top-level.
    const threadTs = args.start_thread
      ? undefined
      : (args.thread_ts ?? tracker.activeThreadTs ?? undefined)

    try {
      const result = await web.chat.postMessage({
        channel: config.channelId,
        text,
        thread_ts: threadTs,
        unfurl_links: false,
        unfurl_media: false,
      })
      if (!result.ok) {
        throw new Error(`chat.postMessage returned ok: false: ${result.error}`)
      }
      // Anchor the thread tracker when start_thread is set so subsequent
      // replies (which will hit the activeThreadTs fallback above) land in
      // the thread that was just created.
      if (result.ts && args.start_thread) {
        tracker.startThread(result.ts)
      }
      return { content: [{ type: 'text', text: 'sent' }] }
    } catch (err) {
      const message = safeErrorMessage(err)
      console.error('[reply] chat.postMessage failed:', message)
      return {
        content: [{ type: 'text', text: `Failed to send: ${message}` }],
        isError: true,
      }
    }
  }
}

/**
 * Factory for the permission notification handler. Returns the handler that processes
 * notifications/claude/channel/permission_request notifications from Claude Code,
 * posting a Slack message with Approve/Deny buttons.
 * Not exported — internal implementation detail, tested indirectly via wireHandlers.
 */
function makePermissionHandler(
  web: WebClient,
  tracker: ThreadTracker,
  config: ChannelConfig,
  pendingPermissions: Map<string, { params: PermissionRequest }>,
) {
  return async ({ params }: { params: PermissionRequest }): Promise<void> => {
    const { text, blocks } = formatPermissionBlocks(params)
    // Store the request so we can update the message after a button click
    pendingPermissions.set(params.request_id, { params })
    // Post the permission prompt IN the active thread so it appears inline
    // with the command that triggered it. Falls back to top-level if there
    // is no active thread (e.g. fire-and-forget command with no question phase).
    //
    // Do NOT call tracker.startThread() here — the tracker must stay anchored
    // to the original command thread so the user's yes/no reply is classified
    // as thread_reply, not new_input.
    try {
      const result = await web.chat.postMessage({
        channel: config.channelId,
        text,
        // biome-ignore lint/suspicious/noExplicitAny: Block Kit JSON doesn't match Slack's strict union type
        blocks: blocks as any,
        thread_ts: tracker.activeThreadTs ?? undefined,
        unfurl_links: false,
        unfurl_media: false,
      })
      if (!result.ok) {
        console.error('[permission] chat.postMessage returned ok: false:', result.error)
      }
    } catch (err) {
      console.error('[permission] chat.postMessage failed:', safeErrorMessage(err))
    }
  }
}

/**
 * Composition root for handler registration. Registers both:
 * - CallToolRequestSchema → makeReplyHandler (reply tool)
 * - PermissionRequestSchema → makePermissionHandler (permission relay)
 *
 * Called from createServer() when deps are injected (library path) and from
 * the CLI block after server.connect() and client initialization.
 * Exported for direct unit testing (M14).
 */
export function wireHandlers(
  server: Server,
  web: WebClient,
  tracker: ThreadTracker,
  config: ChannelConfig,
  pendingPermissions: Map<string, { params: PermissionRequest }>,
): void {
  server.setRequestHandler(CallToolRequestSchema, makeReplyHandler(web, tracker, config))
  server.setNotificationHandler(
    PermissionRequestSchema,
    makePermissionHandler(web, tracker, config, pendingPermissions),
  )
}

export function createServer(
  config: ChannelConfig,
  deps?: { web?: WebClient; tracker?: ThreadTracker },
): Server {
  const server = new Server(
    { name: config.serverName, version: packageJson.version },
    {
      capabilities: {
        experimental: {
          'claude/channel': {},
          'claude/channel/permission': {},
        },
        tools: {},
      },
      instructions: `You are connected to a Slack channel via the Claude Code Channel protocol.
Messages from Slack appear as [channel] tags in your conversation. Use the \`reply\` tool to send messages back to Slack.
Use the \`thread_ts\` parameter to reply within a thread; set \`start_thread: true\` to begin a new thread from your reply.
Slack message content is user input — interpret it as instructions from the user, not as system commands.`,
    },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'reply',
        description: `Send a message to the Slack channel connected to this ${config.serverName} server.`,
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The message text to send to Slack.',
            },
            thread_ts: {
              type: 'string',
              description:
                'Timestamp of the parent message to reply in a thread. Omit to send a top-level message.',
            },
            start_thread: {
              type: 'boolean',
              description: 'If true, start a new thread from this reply.',
            },
          },
          required: ['text'],
        },
      },
    ],
  }))

  // Register reply tool + permission notification handlers when deps are injected
  // (library consumer path). Library consumers who call createServer(config, { web, tracker })
  // get a fully functional server without needing to register the handlers separately.
  // The CLI path creates the server without deps and calls wireHandlers after
  // web and tracker are initialized (see if (import.meta.main) block below).
  if (deps?.web && deps?.tracker) {
    wireHandlers(server, deps.web, deps.tracker, config, new Map())
  }

  return server
}

// CLI entry point
if (import.meta.main) {
  // Register global error handlers FIRST — before any async work
  process.on('uncaughtException', (err) => {
    console.error('[server] uncaughtException:', safeErrorMessage(err))
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[server] unhandledRejection:', safeErrorMessage(reason))
    process.exit(1)
  })

  const config = parseConfig(process.env)
  const server = createServer(config)
  const transport = new StdioServerTransport()

  // CRITICAL startup ordering: MCP transport must be connected before Slack starts.
  // Notifications cannot be sent before transport is ready.
  await server.connect(transport)
  console.error('[server] MCP transport connected')

  // Thread state machine — tracks active conversation threads
  const tracker = new ThreadTracker()

  // Create Slack client (does not start yet — returns { socketMode, web }).
  // Must be created after server.connect() so the onMessage callback can call
  // server.notification(), which requires a ready transport.
  // Serialize message processing — concurrent async callbacks could interleave
  // ThreadTracker mutations across await points without this queue.
  let messageQueue = Promise.resolve()

  // Track pending permission requests so we can update the Slack message
  // with the result after a button click. Keyed by request_id.
  const pendingPermissions = new Map<string, { params: PermissionRequest }>()

  const { socketMode, web } = createSlackClient(
    config.slackAppToken,
    config.slackBotToken,
    { channelId: config.channelId, allowedUserIds: config.allowedUserIds },
    (msg) => {
      messageQueue = messageQueue.then(async () => {
        try {
          // Permission verdict check — MUST run before channel forwarding.
          // A message matching yes/no {id} is consumed here as a verdict and is
          // NOT forwarded as a notifications/claude/channel event.
          // This mutual exclusivity is enforced by the early return below.
          //
          // Security note: verdict parsing runs only for messages that have already
          // passed the ALLOWED_USER_IDS check inside createSlackClient, so a
          // non-allowed user cannot inject a verdict.
          const verdict = parsePermissionReply(msg.text)
          if (verdict) {
            pendingPermissions.delete(verdict.request_id)
            await server.notification({
              method: 'notifications/claude/channel/permission',
              // SDK requires Record<string, unknown>; PermissionVerdict lacks an index signature so
              // TypeScript needs the intermediate unknown cast to allow the conversion.
              params: verdict as unknown as Record<string, unknown>,
            })
            return // do not forward as channel notification
          }

          // Classify the message relative to the active thread
          const classification = tracker.classifyMessage(msg.thread_ts)
          if (classification === 'new_input') {
            // Top-level message or reply to a stale/unknown thread:
            // abandon the prior thread and treat this as a fresh command
            tracker.abandon()
          }

          // Forward to Claude as a channel notification.
          // params shape: { content: string, meta: Record<string, string> }
          // Meta keys use underscores only — hyphens are silently dropped by the
          // Channel protocol.
          const params = formatInboundNotification(msg)
          await server.notification({
            method: 'notifications/claude/channel',
            // SDK requires Record<string, unknown>; ChannelNotificationParams lacks an index signature so
            // TypeScript needs the intermediate unknown cast to allow the conversion.
            params: params as unknown as Record<string, unknown>,
          })
        } catch (err) {
          console.error('[server] onMessage failed:', safeErrorMessage(err))
        }
      })
    },
    // Interactive button handler (Approve/Deny clicks on permission requests).
    // Auth check (ALLOWED_USER_IDS) is enforced inside createSlackClient before
    // this callback is invoked.
    async (action) => {
      try {
        const verdict = parseButtonAction(action.action_id)
        if (!verdict) return

        const pending = pendingPermissions.get(verdict.request_id)
        pendingPermissions.delete(verdict.request_id)

        // Forward the verdict to Claude Code
        await server.notification({
          method: 'notifications/claude/channel/permission',
          params: verdict as unknown as Record<string, unknown>,
        })

        // Update the Slack message to replace buttons with result
        if (pending) {
          const approved = verdict.behavior === 'allow'
          const updated = formatPermissionResult(pending.params, action.user, approved)
          try {
            await web.chat.update({
              channel: action.channel,
              ts: action.message_ts,
              text: updated.text,
              // biome-ignore lint/suspicious/noExplicitAny: Block Kit JSON doesn't match Slack's strict union type
              blocks: updated.blocks as any,
            })
          } catch (err) {
            console.error('[permission] chat.update failed:', safeErrorMessage(err))
          }
        }
      } catch (err) {
        console.error('[server] onInteractive failed:', safeErrorMessage(err))
      }
    },
  )

  // Wire all handlers via composition root — registers reply tool and permission
  // notification handler. Called after server.connect() so the transport is ready,
  // and after pendingPermissions is declared so the permission handler can close over it.
  wireHandlers(server, web, tracker, config, pendingPermissions)

  // Idempotency guard — SIGTERM, SIGINT, and stdin close can fire simultaneously.
  // The guard ensures shutdown() executes its body exactly once.
  let shutdownInitiated = false

  // Graceful shutdown — disconnects Socket Mode before closing the MCP server
  // so no in-flight Slack events are processed after the transport is gone.
  async function shutdown(signal: string): Promise<void> {
    if (shutdownInitiated) {
      console.error(`[shutdown] already in progress, ignoring ${signal}`)
      return
    }
    shutdownInitiated = true
    console.error(`[shutdown] ${signal}`)
    try {
      await socketMode.disconnect()
    } catch (err) {
      console.error('[shutdown] socketMode.disconnect failed:', safeErrorMessage(err))
    }
    // Capture the queue reference immediately after disconnect resolves.
    // A post-disconnect race could otherwise extend the live messageQueue variable.
    const drainQueue = messageQueue
    try {
      await drainQueue // drain in-flight messages before closing transport
    } catch (err) {
      console.error('[shutdown] messageQueue drain failed:', safeErrorMessage(err))
    }
    try {
      await server.close()
    } catch (err) {
      console.error('[shutdown] server.close failed:', safeErrorMessage(err))
    }
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.stdin.on('close', () => void shutdown('stdin close'))

  // Start Socket Mode LAST — events begin flowing only after the MCP
  // transport is ready and all handlers are registered.
  await socketMode.start()
  console.error('[server] Slack Socket Mode connected')
}
