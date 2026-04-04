import { describe, expect, it } from 'bun:test'
import type { ChannelNotificationParams } from '../channel-bridge.ts'
import { formatInboundNotification } from '../channel-bridge.ts'
import type { SlackMessage } from '../slack-client.ts'

describe('formatInboundNotification', () => {
  const baseMessage: SlackMessage = {
    text: 'Hello Claude',
    user: 'U0ABC123',
    channel: 'C0DEF456',
    ts: '1234567890.000100',
  }

  it('formats a top-level message with correct content, meta, and no thread_ts', () => {
    const result: ChannelNotificationParams = formatInboundNotification(baseMessage)

    expect(result.content).toBe('Hello Claude')
    expect(result.meta?.user).toBe('U0ABC123')
    expect(result.meta?.channel).toBe('C0DEF456')
    expect(result.meta?.ts).toBe('1234567890.000100')
    expect(result.meta?.thread_ts).toBeUndefined()
  })

  it('includes thread_ts in meta when present — key name uses underscore not hyphen', () => {
    const threadedMessage: SlackMessage = {
      ...baseMessage,
      thread_ts: '1234567890.000050',
    }
    const result: ChannelNotificationParams = formatInboundNotification(threadedMessage)

    expect(result.meta?.thread_ts).toBe('1234567890.000050')
  })

  it('source field equals "slack"', () => {
    const result: ChannelNotificationParams = formatInboundNotification(baseMessage)
    expect(result.source).toBe('slack')
  })

  it('all meta keys use underscores — no hyphens (BRDG-02 invariant)', () => {
    const threadedMessage: SlackMessage = {
      ...baseMessage,
      thread_ts: '1234567890.000050',
    }
    const result: ChannelNotificationParams = formatInboundNotification(threadedMessage)

    const keys = Object.keys(result.meta ?? {})
    const hyphenKeys = keys.filter((k) => k.includes('-'))
    expect(hyphenKeys).toHaveLength(0)
  })

  it('handles empty text — content is empty string', () => {
    const emptyTextMessage: SlackMessage = {
      ...baseMessage,
      text: '',
    }
    const result: ChannelNotificationParams = formatInboundNotification(emptyTextMessage)
    expect(result.content).toBe('')
  })

  it('sets meta.mode to "headless" when options.headless is true', () => {
    const result = formatInboundNotification(baseMessage, { headless: true })
    expect(result.meta?.mode).toBe('headless')
  })

  it('does not set meta.mode when options.headless is false', () => {
    const result = formatInboundNotification(baseMessage, { headless: false })
    expect(result.meta?.mode).toBeUndefined()
  })

  it('does not set meta.mode when options is omitted (backward compat)', () => {
    const result = formatInboundNotification(baseMessage)
    expect(result.meta?.mode).toBeUndefined()
  })

  it('mode meta key uses underscore — no hyphens (BRDG-02 invariant)', () => {
    const result = formatInboundNotification(baseMessage, { headless: true })
    const keys = Object.keys(result.meta ?? {})
    const hyphenKeys = keys.filter((k) => k.includes('-'))
    expect(hyphenKeys).toHaveLength(0)
  })
})
