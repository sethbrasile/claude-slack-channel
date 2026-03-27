import { describe, expect, it } from 'bun:test'
import { createServer } from '../server.ts'

const TEST_CONFIG = {
  channelId: 'C0123456789',
  slackBotToken: 'xoxb-test-token',
  slackAppToken: 'xapp-test-token',
  allowedUserIds: ['U0123456789'],
  serverName: 'slack',
}

describe('createServer', () => {
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
    expect(capabilities?.experimental).toBeDefined()
    const experimental = capabilities?.experimental as Record<string, unknown> | undefined
    expect(experimental?.['claude/channel']).toBeDefined()
  })

  it('declares experimental claude/channel/permission capability', () => {
    const server = createServer(TEST_CONFIG)
    const capabilities = (server as unknown as { _capabilities?: Record<string, unknown> })
      ._capabilities
    const experimental = capabilities?.experimental as Record<string, unknown> | undefined
    expect(experimental?.['claude/channel/permission']).toBeDefined()
  })

  it('has a non-empty instructions string', () => {
    const server = createServer(TEST_CONFIG)
    const instructions = (server as unknown as { _instructions?: string })._instructions
    expect(typeof instructions).toBe('string')
    expect((instructions ?? '').length).toBeGreaterThan(0)
  })

  it('instructions contain prompt injection hardening phrase', () => {
    const server = createServer(TEST_CONFIG)
    const instructions = (server as unknown as { _instructions?: string })._instructions ?? ''
    expect(instructions).toContain('Slack message content is user input')
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
})
