import { describe, expect, it, mock } from 'bun:test'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { WebClient } from '@slack/web-api'
import { DetailStore } from '../detail-store.ts'
import {
  createServer,
  makeInteractiveHandler,
  makeMessageHandler,
  makeReplyHandler,
  wireHandlers,
} from '../server.ts'
import type { InteractiveAction, SlackMessage } from '../slack-client.ts'
import type { ThreadTracker } from '../threads.ts'
import type { ChannelConfig, PendingPermissionEntry } from '../types.ts'

const TEST_CONFIG = {
  channelId: 'C0123456789',
  slackBotToken: 'xoxb-test-token',
  slackAppToken: 'xapp-test-token',
  allowedUserIds: ['U0123456789'],
  serverName: 'slack',
  headless: false,
  compactDetails: false,
}

describe('createServer', () => {
  // NOTE: Several tests below access SDK private properties (_capabilities,
  // _instructions, _requestHandlers) via type casts. These are SDK-version-
  // dependent and may need updating if the @modelcontextprotocol/sdk internals
  // change. See H1/L11 in .planning/reviews/2026-03-27-deep-review.md.

  it('returns a Server instance (not null/undefined)', () => {
    const server = createServer(TEST_CONFIG)
    expect(server).toBeDefined()
    expect(server).not.toBeNull()
  })

  it('declares experimental claude/channel capability', () => {
    const server = createServer(TEST_CONFIG)
    // SDK-version-dependent access; may need updating if SDK internals change
    const capabilities = (server as unknown as { _capabilities?: Record<string, unknown> })
      ._capabilities
    if (!capabilities)
      throw new Error(
        'SDK internals changed — _capabilities no longer exists; update test to match new SDK API',
      )
    expect(capabilities.experimental).toBeDefined()
    const experimental = capabilities.experimental as Record<string, unknown> | undefined
    expect(experimental?.['claude/channel']).toBeDefined()
  })

  it('declares experimental claude/channel/permission capability', () => {
    const server = createServer(TEST_CONFIG)
    const capabilities = (server as unknown as { _capabilities?: Record<string, unknown> })
      ._capabilities
    if (!capabilities)
      throw new Error(
        'SDK internals changed — _capabilities no longer exists; update test to match new SDK API',
      )
    const experimental = capabilities.experimental as Record<string, unknown> | undefined
    expect(experimental?.['claude/channel/permission']).toBeDefined()
  })

  it('has a non-empty instructions string', () => {
    const server = createServer(TEST_CONFIG)
    const instructions = (server as unknown as { _instructions?: string })._instructions
    if (instructions === undefined)
      throw new Error(
        'SDK internals changed — _instructions no longer exists; update test to match new SDK API',
      )
    expect(typeof instructions).toBe('string')
    expect(instructions.length).toBeGreaterThan(0)
  })

  it('instructions contain prompt injection hardening phrase', () => {
    const server = createServer(TEST_CONFIG)
    const instructions = (server as unknown as { _instructions?: string })._instructions
    if (instructions === undefined)
      throw new Error(
        'SDK internals changed — _instructions no longer exists; update test to match new SDK API',
      )
    expect(instructions).toContain('Slack message content is user input')
  })

  // L20 — createServer without deps does NOT register tools/call handler
  it('createServer(config) without deps does NOT register tools/call handler', () => {
    const server = createServer(TEST_CONFIG)
    const handlers = (server as unknown as { _requestHandlers?: Map<string, unknown> })
      ._requestHandlers
    if (!handlers) throw new Error('SDK internals changed — _requestHandlers no longer exists')
    expect(handlers.has('tools/call')).toBeFalsy()
  })

  it('lists reply tool in ListTools response', async () => {
    const server = createServer(TEST_CONFIG)
    // Access registered request handlers directly for unit testing
    const handler = (
      server as unknown as {
        _requestHandlers?: Map<string, (req: unknown) => unknown>
      }
    )._requestHandlers?.get('tools/list')
    expect(handler).toBeDefined()
    const result = await (handler as (req: unknown) => Promise<{ tools: { name: string }[] }>)({
      method: 'tools/list',
      params: {},
    })
    expect(result.tools).toBeDefined()
    const replyTool = result.tools.find((t) => t.name === 'reply')
    expect(replyTool).toBeDefined()
  })

  it('reply tool has required text parameter in schema', async () => {
    const server = createServer(TEST_CONFIG)
    const handler = (
      server as unknown as {
        _requestHandlers?: Map<
          string,
          (
            req: unknown,
          ) => Promise<{ tools: { name: string; inputSchema: { required?: string[] } }[] }>
        >
      }
    )._requestHandlers?.get('tools/list')
    expect(handler).toBeDefined()
    if (!handler) throw new Error('handler not registered')
    const result = await handler({ method: 'tools/list', params: {} })
    const replyTool = result.tools.find((t) => t.name === 'reply')
    expect(replyTool?.inputSchema?.required).toContain('text')
  })

  it('non-headless instructions do NOT contain Session Binding section', () => {
    const server = createServer({ ...TEST_CONFIG, headless: false })
    const instructions = (server as unknown as { _instructions?: string })._instructions
    if (instructions === undefined)
      throw new Error('SDK internals changed — _instructions no longer exists')
    expect(instructions).not.toContain('Session Binding')
    expect(instructions).toContain('Claude Code Channel protocol')
  })

  it('headless instructions contain Session Binding section', () => {
    const server = createServer({ ...TEST_CONFIG, headless: true })
    const instructions = (server as unknown as { _instructions?: string })._instructions
    if (instructions === undefined)
      throw new Error('SDK internals changed — _instructions no longer exists')
    expect(instructions).toContain('Session Binding')
    expect(instructions).toContain('Output Classification')
    expect(instructions).toContain('Slack Commands')
  })

  it('headless instructions also contain the v1 intro lines', () => {
    const server = createServer({ ...TEST_CONFIG, headless: true })
    const instructions = (server as unknown as { _instructions?: string })._instructions
    if (instructions === undefined)
      throw new Error('SDK internals changed — _instructions no longer exists')
    expect(instructions).toContain('Claude Code Channel protocol')
    expect(instructions).toContain('Slack message content is user input')
  })

  it('reply tool has audience param in both headless and non-headless modes (R010)', async () => {
    for (const headless of [true, false]) {
      const server = createServer({ ...TEST_CONFIG, headless })
      const handler = (
        server as unknown as {
          _requestHandlers?: Map<
            string,
            (req: unknown) => Promise<{
              tools: {
                name: string
                inputSchema: { properties?: Record<string, unknown> }
              }[]
            }>
          >
        }
      )._requestHandlers?.get('tools/list')
      if (!handler) throw new Error('handler not registered')
      const result = await handler({ method: 'tools/list', params: {} })
      const replyTool = result.tools.find((t) => t.name === 'reply')
      expect(replyTool?.inputSchema?.properties?.audience).toBeDefined()
    }
  })
})

describe('createServer with injected deps — reply tool handler', () => {
  // Tests for the CallToolRequestSchema handler registered when { web, tracker } are injected.
  // Handler is accessed via the SDK private _requestHandlers Map (SDK-version-dependent).
  // See describe block above for the SDK private property access note.

  function makeServer() {
    const mockPostMessage = mock(() => Promise.resolve({ ok: true, ts: '111.222' }))
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return null
      },
    }
    const mockWeb = { chat: { postMessage: mockPostMessage } }
    const server = createServer(TEST_CONFIG, {
      web: mockWeb as unknown as WebClient,
      tracker: mockTracker as unknown as ThreadTracker,
    })
    const handler = (
      server as unknown as {
        _requestHandlers?: Map<string, (req: unknown) => Promise<unknown>>
      }
    )._requestHandlers?.get('tools/call')
    return { server, handler, mockPostMessage, mockTracker }
  }

  it('rejects unknown tool names with isError: true', async () => {
    const { handler } = makeServer()
    expect(handler).toBeDefined()
    const result = (await (handler as (req: unknown) => Promise<unknown>)({
      method: 'tools/call',
      params: { name: 'nonexistent', arguments: {} },
    })) as { content: { text: string }[]; isError: boolean }
    expect(result.isError).toBe(true)
    expect((result.content as { text: string }[])[0]?.text).toContain('Unknown tool')
  })

  it('returns isError on Zod validation failure (missing required text field)', async () => {
    const { handler } = makeServer()
    const result = (await (handler as (req: unknown) => Promise<unknown>)({
      method: 'tools/call',
      params: { name: 'reply', arguments: { thread_ts: '111' } },
    })) as { content: { text: string }[]; isError: boolean }
    expect(result.isError).toBe(true)
    expect((result.content as { text: string }[])[0]?.text).toContain('Invalid arguments')
  })

  it('strips <!channel> broadcast mention from reply text', async () => {
    const { handler, mockPostMessage } = makeServer()
    await (handler as (req: unknown) => Promise<unknown>)({
      method: 'tools/call',
      params: { name: 'reply', arguments: { text: 'Hello <!channel>' } },
    })
    const firstCall = (mockPostMessage.mock.calls as unknown as { text: string }[][])[0]
    const callArgs = firstCall?.[0]
    expect(callArgs?.text).not.toContain('<!channel>')
    // L15 — verify zero-width-space replacement is present (not silently dropped)
    expect(callArgs?.text).toContain('<\u200b!channel>')
  })

  it('strips <!here> broadcast mention from reply text', async () => {
    const { handler, mockPostMessage } = makeServer()
    await (handler as (req: unknown) => Promise<unknown>)({
      method: 'tools/call',
      params: { name: 'reply', arguments: { text: 'Hey <!here>' } },
    })
    const firstCall = (mockPostMessage.mock.calls as unknown as { text: string }[][])[0]
    const callArgs = firstCall?.[0]
    expect(callArgs?.text).not.toContain('<!here>')
    expect(callArgs?.text).toContain('<\u200b!here>')
  })

  it('strips <!everyone> broadcast mention from reply text', async () => {
    const { handler, mockPostMessage } = makeServer()
    await (handler as (req: unknown) => Promise<unknown>)({
      method: 'tools/call',
      params: { name: 'reply', arguments: { text: 'Notify <!everyone>' } },
    })
    const firstCall = (mockPostMessage.mock.calls as unknown as { text: string }[][])[0]
    const callArgs = firstCall?.[0]
    expect(callArgs?.text).not.toContain('<!everyone>')
    expect(callArgs?.text).toContain('<\u200b!everyone>')
  })

  it('does NOT call tracker.startThread when start_thread is false', async () => {
    const { handler, mockTracker } = makeServer()
    await (handler as (req: unknown) => Promise<unknown>)({
      method: 'tools/call',
      params: { name: 'reply', arguments: { text: 'hello', start_thread: false } },
    })
    expect(mockTracker.startThread.mock.calls.length).toBe(0)
  })

  it('calls tracker.startThread with result.ts when start_thread is true', async () => {
    const { handler, mockTracker } = makeServer()
    await (handler as (req: unknown) => Promise<unknown>)({
      method: 'tools/call',
      params: { name: 'reply', arguments: { text: 'question?', start_thread: true } },
    })
    const startCalls = mockTracker.startThread.mock.calls as unknown as string[][]
    expect(startCalls.length).toBe(1)
    expect(startCalls[0]?.[0]).toBe('111.222')
  })

  it('uses tracker.activeThreadTs when no thread_ts is provided', async () => {
    const mockPostMessage = mock(() => Promise.resolve({ ok: true, ts: '111.222' }))
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return '999.000'
      },
    }
    const mockWeb = { chat: { postMessage: mockPostMessage } }
    const server = createServer(TEST_CONFIG, {
      web: mockWeb as unknown as WebClient,
      tracker: mockTracker as unknown as ThreadTracker,
    })
    const handler = (
      server as unknown as {
        _requestHandlers?: Map<string, (req: unknown) => Promise<unknown>>
      }
    )._requestHandlers?.get('tools/call')
    await (handler as (req: unknown) => Promise<unknown>)({
      method: 'tools/call',
      params: { name: 'reply', arguments: { text: 'follow-up' } },
    })
    const callArgs = (mockPostMessage.mock.calls as unknown as { thread_ts?: string }[][])[0]?.[0]
    expect(callArgs?.thread_ts).toBe('999.000')
  })

  it('start_thread: true posts top-level even when tracker has an active thread', async () => {
    const mockPostMessage = mock(() => Promise.resolve({ ok: true, ts: '222.333' }))
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return '999.000'
      },
    }
    const mockWeb = { chat: { postMessage: mockPostMessage } }
    const server = createServer(TEST_CONFIG, {
      web: mockWeb as unknown as WebClient,
      tracker: mockTracker as unknown as ThreadTracker,
    })
    const handler = (
      server as unknown as {
        _requestHandlers?: Map<string, (req: unknown) => Promise<unknown>>
      }
    )._requestHandlers?.get('tools/call')
    await (handler as (req: unknown) => Promise<unknown>)({
      method: 'tools/call',
      params: { name: 'reply', arguments: { text: 'new topic', start_thread: true } },
    })
    const callArgs = (mockPostMessage.mock.calls as unknown as { thread_ts?: string }[][])[0]?.[0]
    expect(callArgs?.thread_ts).toBeUndefined()
    const startCalls = mockTracker.startThread.mock.calls as unknown as string[][]
    expect(startCalls[0]?.[0]).toBe('222.333')
  })

  it('explicit thread_ts takes priority over activeThreadTs', async () => {
    const mockPostMessage = mock(() => Promise.resolve({ ok: true, ts: '111.222' }))
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return '999.000'
      },
    }
    const mockWeb = { chat: { postMessage: mockPostMessage } }
    const server = createServer(TEST_CONFIG, {
      web: mockWeb as unknown as WebClient,
      tracker: mockTracker as unknown as ThreadTracker,
    })
    const handler = (
      server as unknown as {
        _requestHandlers?: Map<string, (req: unknown) => Promise<unknown>>
      }
    )._requestHandlers?.get('tools/call')
    await (handler as (req: unknown) => Promise<unknown>)({
      method: 'tools/call',
      params: { name: 'reply', arguments: { text: 'in specific thread', thread_ts: '888.000' } },
    })
    const callArgs = (mockPostMessage.mock.calls as unknown as { thread_ts?: string }[][])[0]?.[0]
    expect(callArgs?.thread_ts).toBe('888.000')
  })

  it('returns { content: [{ type: "text", text: "sent" }] } on success', async () => {
    const { handler } = makeServer()
    const result = (await (handler as (req: unknown) => Promise<unknown>)({
      method: 'tools/call',
      params: { name: 'reply', arguments: { text: 'hello' } },
    })) as { content: { type: string; text: string }[] }
    const firstContent = (result.content as { type: string; text: string }[])[0]
    expect(firstContent?.type).toBe('text')
    expect(firstContent?.text).toBe('sent')
  })
})

describe('makeReplyHandler — direct unit tests (M14)', () => {
  // Tests invoke makeReplyHandler directly without going through createServer or the CLI block.
  // SDK-version-dependent handler access pattern from the describe block above applies here too.

  function makeDeps() {
    const mockPostMessage = mock(() => Promise.resolve({ ok: true, ts: '111.222' }))
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return null
      },
    }
    const mockWeb = { chat: { postMessage: mockPostMessage } }
    const handler = makeReplyHandler(
      mockWeb as unknown as WebClient,
      mockTracker as unknown as ThreadTracker,
      TEST_CONFIG as ChannelConfig,
    )
    return { handler, mockPostMessage, mockTracker }
  }

  it('returns { content: [{ type: "text", text: "sent" }] } on success', async () => {
    const { handler } = makeDeps()
    const result = await handler({
      params: { name: 'reply', arguments: { text: 'hello' } },
    })
    expect(result.content[0]?.type).toBe('text')
    expect(result.content[0]?.text).toBe('sent')
    expect(result.isError).toBeUndefined()
  })

  it('returns { isError: true } for unknown tool name', async () => {
    const { handler } = makeDeps()
    const result = await handler({
      params: { name: 'nonexistent', arguments: {} },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('Unknown tool')
  })

  it('returns { isError: true } for missing required text argument', async () => {
    const { handler } = makeDeps()
    const result = await handler({
      params: { name: 'reply', arguments: { thread_ts: '111' } },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('Invalid arguments')
  })

  // M11 — postMessage ok:false returns isError:true
  it('returns isError: true when chat.postMessage returns ok: false', async () => {
    const mockPostMessage = mock(() => Promise.resolve({ ok: false, error: 'channel_not_found' }))
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return null
      },
    }
    const handler = makeReplyHandler(
      { chat: { postMessage: mockPostMessage } } as unknown as WebClient,
      mockTracker as unknown as ThreadTracker,
      TEST_CONFIG as ChannelConfig,
    )
    const result = await handler({ params: { name: 'reply', arguments: { text: 'hello' } } })
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('Failed to send')
  })

  // L3 — <@ user mention stripping in reply
  it('strips <@U12345> user mention from reply text', async () => {
    const { handler, mockPostMessage } = makeDeps()
    await handler({ params: { name: 'reply', arguments: { text: 'Hey <@U12345> check this' } } })
    const callArgs = (mockPostMessage.mock.calls as unknown as { text: string }[][])[0]?.[0]
    expect(callArgs?.text).not.toContain('<@U12345>')
    expect(callArgs?.text).toContain('<\u200b@U12345>')
  })

  it('strips <!channel> broadcast mention', async () => {
    const { handler, mockPostMessage } = makeDeps()
    await handler({ params: { name: 'reply', arguments: { text: 'Hello <!channel>' } } })
    const callArgs = (mockPostMessage.mock.calls as unknown as { text: string }[][])[0]?.[0]
    expect(callArgs?.text).not.toContain('<!channel>')
    // L15 — verify zero-width-space replacement is present
    expect(callArgs?.text).toContain('<\u200b!channel>')
  })

  it('calls tracker.startThread(ts) when start_thread: true', async () => {
    const { handler, mockTracker } = makeDeps()
    await handler({
      params: { name: 'reply', arguments: { text: 'question?', start_thread: true } },
    })
    const startCalls = mockTracker.startThread.mock.calls as unknown as string[][]
    expect(startCalls.length).toBe(1)
    expect(startCalls[0]?.[0]).toBe('111.222')
  })
})

describe('wireHandlers — handler registration (M2)', () => {
  // Tests confirm that wireHandlers registers both the reply tool and permission notification
  // handlers on the server. Uses SDK-private _requestHandlers/_notificationHandlers (SDK-version-dependent).

  function makeDeps() {
    const mockPostMessage = mock(() => Promise.resolve({ ok: true, ts: '111.222' }))
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return null
      },
    }
    const mockWeb = { chat: { postMessage: mockPostMessage } }
    const pendingPermissions = new Map<string, PendingPermissionEntry>()
    const server = createServer(TEST_CONFIG as ChannelConfig)
    wireHandlers(
      server,
      mockWeb as unknown as WebClient,
      mockTracker as unknown as ThreadTracker,
      TEST_CONFIG as ChannelConfig,
      pendingPermissions,
    )
    return { server, mockPostMessage, mockTracker, pendingPermissions }
  }

  it('registers the tools/call handler on the server', () => {
    const { server } = makeDeps()
    const handlers = (server as unknown as { _requestHandlers?: Map<string, unknown> })
      ._requestHandlers
    expect(handlers?.has('tools/call')).toBe(true)
  })

  it('registers the permission_request notification handler on the server', () => {
    const { server } = makeDeps()
    // SDK-version-dependent: _notificationHandlers map is keyed by the full method string
    const handlers = (server as unknown as { _notificationHandlers?: Map<string, unknown> })
      ._notificationHandlers
    expect(handlers?.has('notifications/claude/channel/permission_request')).toBe(true)
  })

  it('createServer(config, { web, tracker }) registers the permission notification handler (M2)', () => {
    const mockPostMessage = mock(() => Promise.resolve({ ok: true, ts: '111.222' }))
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return null
      },
    }
    const mockWeb = { chat: { postMessage: mockPostMessage } }
    const server = createServer(TEST_CONFIG as ChannelConfig, {
      web: mockWeb as unknown as WebClient,
      tracker: mockTracker as unknown as ThreadTracker,
    })
    const handlers = (server as unknown as { _notificationHandlers?: Map<string, unknown> })
      ._notificationHandlers
    expect(handlers?.has('notifications/claude/channel/permission_request')).toBe(true)
  })
})

describe('makeInteractiveHandler — direct unit tests (M13)', () => {
  // Tests invoke makeInteractiveHandler directly without going through createServer or the CLI block.
  // Button action_id format: permission_approve_{5-char-id} or permission_deny_{5-char-id}
  // where ID is 5 lowercase letters from [a-km-z] (no 'l').

  // Valid request_id: 'abcde' — all chars in [a-km-z]
  const REQUEST_ID = 'abcde'

  function makeDeps() {
    const mockUpdate = mock(() => Promise.resolve({ ok: true }))
    const mockNotification = mock(() => Promise.resolve())
    const mockServer = { notification: mockNotification }
    const mockWeb = { chat: { update: mockUpdate } }
    const pendingPermissions = new Map<string, PendingPermissionEntry>()
    const handler = makeInteractiveHandler(
      mockWeb as unknown as WebClient,
      mockServer as unknown as Server,
      pendingPermissions,
      TEST_CONFIG as ChannelConfig,
    )
    return { handler, mockUpdate, mockNotification, pendingPermissions }
  }

  // A valid action with matching request_id
  const VALID_ACTION: InteractiveAction = {
    action_id: `permission_approve_${REQUEST_ID}`,
    user: 'U0123456789',
    channel: 'C0123456789',
    message_ts: '1234567890.000100',
  }

  function seedPending(pendingPermissions: Map<string, PendingPermissionEntry>) {
    pendingPermissions.set(REQUEST_ID, {
      params: {
        request_id: REQUEST_ID,
        tool_name: 'bash',
        description: 'Run a shell command',
        input_preview: 'echo hello',
      },
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
  }

  it('happy path: sends verdict notification and updates Slack message', async () => {
    const { handler, mockUpdate, mockNotification, pendingPermissions } = makeDeps()
    seedPending(pendingPermissions)

    await handler(VALID_ACTION)

    expect(mockNotification.mock.calls.length).toBe(1)
    const notifCall = (mockNotification.mock.calls as unknown as { method: string }[][])[0]?.[0]
    expect(notifCall?.method).toBe('notifications/claude/channel/permission')
    expect(mockUpdate.mock.calls.length).toBe(1)
  })

  it('double-click dedup: second call with same request_id is a no-op', async () => {
    const { handler, mockUpdate, mockNotification, pendingPermissions } = makeDeps()
    seedPending(pendingPermissions)

    await handler(VALID_ACTION)
    await handler(VALID_ACTION)

    expect(mockNotification.mock.calls.length).toBe(1)
    expect(mockUpdate.mock.calls.length).toBe(1)
  })

  it('unknown request_id: no notification sent', async () => {
    const { handler, mockNotification } = makeDeps()
    // pendingPermissions is empty — request_id not found

    await handler(VALID_ACTION)

    expect(mockNotification.mock.calls.length).toBe(0)
  })

  it('malformed action_id: no notification sent', async () => {
    const { handler, mockNotification, mockUpdate } = makeDeps()
    const malformedAction: InteractiveAction = {
      action_id: 'not_a_button_action',
      user: 'U0123456789',
      channel: 'C0123456789',
      message_ts: '1234567890.000100',
    }

    await handler(malformedAction)

    expect(mockNotification.mock.calls.length).toBe(0)
    expect(mockUpdate.mock.calls.length).toBe(0)
  })
})

describe('makeReplyHandler — compact detail storage (S02)', () => {
  const COMPACT_CONFIG: ChannelConfig = {
    channelId: 'C0123456789',
    slackBotToken: 'xoxb-test-token',
    slackAppToken: 'xapp-test-token',
    allowedUserIds: ['U0123456789'],
    serverName: 'slack',
    headless: false,
    compactDetails: true,
  }

  function makeDeps(config: ChannelConfig = COMPACT_CONFIG) {
    const mockPostMessage = mock(() => Promise.resolve({ ok: true, ts: '111.222' }))
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return '999.000'
      },
    }
    const mockWeb = { chat: { postMessage: mockPostMessage } }
    const detailStore = new DetailStore()
    const handler = makeReplyHandler(
      mockWeb as unknown as WebClient,
      mockTracker as unknown as ThreadTracker,
      config,
      detailStore,
    )
    return { handler, mockPostMessage, mockTracker, detailStore }
  }

  it('compactDetails + audience:detail + threadTs → stores text, posts note, returns stored (compact)', async () => {
    const { handler, mockPostMessage, detailStore } = makeDeps()
    const result = await handler({
      params: {
        name: 'reply',
        arguments: { text: 'Full build log here...', thread_ts: '888.000', audience: 'detail' },
      },
    })

    // Should return 'stored (compact)' instead of 'sent'
    expect(result.content[0]?.text).toBe('stored (compact)')
    expect(result.isError).toBeUndefined()

    // Should have stored the original text (not mention-stripped)
    const stored = detailStore.retrieve('888.000')
    expect(stored).toBe('Full build log here...')

    // Should have posted a brief note, not the full text
    expect(mockPostMessage.mock.calls.length).toBe(1)
    const callArgs = (mockPostMessage.mock.calls as unknown as Record<string, unknown>[][])[0]?.[0]
    expect(callArgs?.text).toContain('Details stored')
    expect(callArgs?.text).toContain('details')
    expect(callArgs?.thread_ts).toBe('888.000')
    // The note text should NOT contain the original detail text
    expect(callArgs?.text).not.toContain('Full build log here')
  })

  it('compactDetails + audience:detail + no threadTs → posts full text (fallback)', async () => {
    // Override activeThreadTs to null so there's no thread context
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return null
      },
    }
    const mockPostMsg = mock(() => Promise.resolve({ ok: true, ts: '111.222' }))
    const mockWeb = { chat: { postMessage: mockPostMsg } }
    const store = new DetailStore()
    const h = makeReplyHandler(
      mockWeb as unknown as WebClient,
      mockTracker as unknown as ThreadTracker,
      COMPACT_CONFIG,
      store,
    )

    // No thread_ts arg, no activeThreadTs → threadTs is undefined → falls through to normal post
    const result = await h({
      params: {
        name: 'reply',
        arguments: { text: 'detail text', audience: 'detail' },
      },
    })

    // Should post normally since there's no thread to key storage
    expect(result.content[0]?.text).toBe('sent')
    const callArgs = (mockPostMsg.mock.calls as unknown as Record<string, unknown>[][])[0]?.[0]
    expect(callArgs?.text).not.toContain('Details stored')
  })

  it('compactDetails + audience:operator → posts full text (no storage)', async () => {
    const { handler, mockPostMessage, detailStore } = makeDeps()
    const result = await handler({
      params: {
        name: 'reply',
        arguments: { text: 'Progress update', thread_ts: '888.000', audience: 'operator' },
      },
    })

    expect(result.content[0]?.text).toBe('sent')
    // Should NOT have stored anything
    expect(detailStore.retrieve('888.000')).toBeNull()
    // Should have posted the full text
    const callArgs = (mockPostMessage.mock.calls as unknown as Record<string, unknown>[][])[0]?.[0]
    expect(callArgs?.thread_ts).toBe('888.000')
  })

  it('compactDetails=false + audience:detail → posts full text (R011 backward compat)', async () => {
    const { handler, mockPostMessage } = makeDeps({
      ...COMPACT_CONFIG,
      compactDetails: false,
    })
    const result = await handler({
      params: {
        name: 'reply',
        arguments: { text: 'Full detail log', thread_ts: '888.000', audience: 'detail' },
      },
    })

    // Should post normally when compactDetails is off
    expect(result.content[0]?.text).toBe('sent')
    const callArgs = (mockPostMessage.mock.calls as unknown as Record<string, unknown>[][])[0]?.[0]
    expect(callArgs?.thread_ts).toBe('888.000')
  })
})

describe('makeMessageHandler — direct unit tests (S04)', () => {
  // Tests invoke makeMessageHandler directly without going through createServer or the CLI block.
  // Covers: details interception (R006, R007, R008), permission verdict routing, and normal forwarding.

  const COMPACT_CONFIG: ChannelConfig = {
    channelId: 'C0123456789',
    slackBotToken: 'xoxb-test-token',
    slackAppToken: 'xapp-test-token',
    allowedUserIds: ['U0123456789'],
    serverName: 'slack',
    headless: false,
    compactDetails: true,
  }

  // Valid permission request_id: 5 lowercase letters from [a-km-z] (no 'l')
  const REQUEST_ID = 'abcde'

  function makeDeps(configOverrides?: Partial<ChannelConfig>) {
    const mockPostMessage = mock(() => Promise.resolve({ ok: true }))
    const mockNotification = mock(() => Promise.resolve())
    const mockServer = { notification: mockNotification }
    const mockWeb = { chat: { postMessage: mockPostMessage } }
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return null
      },
    }
    const pendingPermissions = new Map<string, PendingPermissionEntry>()
    const detailStore = new DetailStore()
    const config: ChannelConfig = { ...COMPACT_CONFIG, ...configOverrides }
    const handler = makeMessageHandler(
      mockServer as unknown as Server,
      mockWeb as unknown as WebClient,
      mockTracker as unknown as ThreadTracker,
      config,
      pendingPermissions,
      detailStore,
    )
    return {
      handler,
      mockPostMessage,
      mockNotification,
      mockTracker,
      pendingPermissions,
      detailStore,
      config,
    }
  }

  function makeMsg(overrides: Partial<SlackMessage> = {}): SlackMessage {
    return {
      text: 'hello',
      user: 'U0123456789',
      channel: 'C0123456789',
      ts: '1234567890.000100',
      ...overrides,
    }
  }

  it("'details' in thread + stored data → posts Block Kit blocks, does NOT forward to Claude (R006, R007, R008)", async () => {
    const { handler, mockPostMessage, mockNotification, detailStore } = makeDeps()
    const threadTs = '999.000'
    detailStore.store(threadTs, 'Full build output here...')

    await handler(makeMsg({ text: 'details', thread_ts: threadTs }))

    // Should post Block Kit blocks to Slack
    expect(mockPostMessage.mock.calls.length).toBe(1)
    const callArgs = (mockPostMessage.mock.calls as unknown as Record<string, unknown>[][])[0]?.[0]
    expect(callArgs?.blocks).toBeDefined()
    expect(callArgs?.thread_ts).toBe(threadTs)
    // Should NOT forward to Claude
    expect(mockNotification.mock.calls.length).toBe(0)
  })

  it("'detail' (singular) in thread → same behavior (R006)", async () => {
    const { handler, mockPostMessage, mockNotification, detailStore } = makeDeps()
    const threadTs = '999.000'
    detailStore.store(threadTs, 'Build log...')

    await handler(makeMsg({ text: 'detail', thread_ts: threadTs }))

    expect(mockPostMessage.mock.calls.length).toBe(1)
    const callArgs = (mockPostMessage.mock.calls as unknown as Record<string, unknown>[][])[0]?.[0]
    expect(callArgs?.blocks).toBeDefined()
    expect(mockNotification.mock.calls.length).toBe(0)
  })

  it("'DETAILS' (uppercase) in thread → same behavior (R006)", async () => {
    const { handler, mockPostMessage, mockNotification, detailStore } = makeDeps()
    const threadTs = '999.000'
    detailStore.store(threadTs, 'Build log...')

    await handler(makeMsg({ text: 'DETAILS', thread_ts: threadTs }))

    expect(mockPostMessage.mock.calls.length).toBe(1)
    const callArgs = (mockPostMessage.mock.calls as unknown as Record<string, unknown>[][])[0]?.[0]
    expect(callArgs?.blocks).toBeDefined()
    expect(mockNotification.mock.calls.length).toBe(0)
  })

  it("'details' in thread + no stored data → posts 'No details found' message", async () => {
    const { handler, mockPostMessage, mockNotification } = makeDeps()
    const threadTs = '999.000'
    // No detailStore.store() — empty store

    await handler(makeMsg({ text: 'details', thread_ts: threadTs }))

    expect(mockPostMessage.mock.calls.length).toBe(1)
    const callArgs = (mockPostMessage.mock.calls as unknown as Record<string, unknown>[][])[0]?.[0]
    expect(callArgs?.text).toContain('No details found')
    expect(callArgs?.thread_ts).toBe(threadTs)
    // Should NOT forward to Claude
    expect(mockNotification.mock.calls.length).toBe(0)
  })

  it("'details' top-level (no thread_ts) → forwarded to Claude (R008)", async () => {
    const { handler, mockPostMessage, mockNotification } = makeDeps()

    await handler(makeMsg({ text: 'details' }))
    // No thread_ts → details interception does not apply

    // Should forward to Claude as a channel notification
    expect(mockNotification.mock.calls.length).toBe(1)
    const notifCall = (mockNotification.mock.calls as unknown as { method: string }[][])[0]?.[0]
    expect(notifCall?.method).toBe('notifications/claude/channel')
    // Should NOT post to Slack
    expect(mockPostMessage.mock.calls.length).toBe(0)
  })

  it("'details' with compactDetails=false → forwarded to Claude (R008)", async () => {
    const { handler, mockPostMessage, mockNotification } = makeDeps({ compactDetails: false })

    await handler(makeMsg({ text: 'details', thread_ts: '999.000' }))

    // compactDetails is off → handler should forward to Claude, not intercept
    expect(mockNotification.mock.calls.length).toBe(1)
    const notifCall = (mockNotification.mock.calls as unknown as { method: string }[][])[0]?.[0]
    expect(notifCall?.method).toBe('notifications/claude/channel')
    expect(mockPostMessage.mock.calls.length).toBe(0)
  })

  it('non-details message → forwarded to Claude via server.notification', async () => {
    const { handler, mockPostMessage, mockNotification, mockTracker } = makeDeps()

    await handler(makeMsg({ text: 'please build the feature' }))

    expect(mockNotification.mock.calls.length).toBe(1)
    const notifCall = (mockNotification.mock.calls as unknown as { method: string }[][])[0]?.[0]
    expect(notifCall?.method).toBe('notifications/claude/channel')
    expect(mockTracker.classifyMessage.mock.calls.length).toBe(1)
    expect(mockPostMessage.mock.calls.length).toBe(0)
  })

  it('permission verdict message → consumed, notification sent, NOT forwarded', async () => {
    const { handler, mockPostMessage, mockNotification, pendingPermissions } = makeDeps()
    // Seed a pending permission request
    pendingPermissions.set(REQUEST_ID, {
      params: {
        request_id: REQUEST_ID,
        tool_name: 'bash',
        description: 'Run a shell command',
        input_preview: 'echo hello',
      },
      expiresAt: Date.now() + 10 * 60 * 1000,
    })

    await handler(makeMsg({ text: `yes ${REQUEST_ID}` }))

    // Should send permission verdict notification
    expect(mockNotification.mock.calls.length).toBe(1)
    const notifCall = (mockNotification.mock.calls as unknown as { method: string }[][])[0]?.[0]
    expect(notifCall?.method).toBe('notifications/claude/channel/permission')
    // Should NOT forward as a regular channel message
    expect(mockPostMessage.mock.calls.length).toBe(0)
    // Pending entry should be deleted
    expect(pendingPermissions.has(REQUEST_ID)).toBe(false)
  })
})

describe('wireHandlers — with DetailStore param (S02)', () => {
  it('registers tools/call handler when detailStore is passed', () => {
    const mockPostMessage = mock(() => Promise.resolve({ ok: true, ts: '111.222' }))
    const mockTracker = {
      startThread: mock((_ts: string) => {}),
      abandon: mock(() => {}),
      classifyMessage: mock((_ts: string | undefined) => 'new_input' as const),
      get activeThreadTs() {
        return null
      },
    }
    const mockWeb = { chat: { postMessage: mockPostMessage } }
    const pendingPermissions = new Map<string, PendingPermissionEntry>()
    const detailStore = new DetailStore()
    const server = createServer(TEST_CONFIG as ChannelConfig)
    wireHandlers(
      server,
      mockWeb as unknown as WebClient,
      mockTracker as unknown as ThreadTracker,
      TEST_CONFIG as ChannelConfig,
      pendingPermissions,
      detailStore,
    )
    const handlers = (server as unknown as { _requestHandlers?: Map<string, unknown> })
      ._requestHandlers
    expect(handlers?.has('tools/call')).toBe(true)
  })
})
