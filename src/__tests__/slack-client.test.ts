import { describe, expect, it, spyOn } from 'bun:test'
import { LogLevel } from '@slack/logger'
import { createStderrLogger, shouldProcessMessage } from '../slack-client.ts'

const FILTER = {
  channelId: 'C123',
  allowedUserIds: ['U123', 'U456'],
}

describe('shouldProcessMessage', () => {
  it('returns true for matching channel and user', () => {
    expect(shouldProcessMessage({ channel: 'C123', user: 'U123' }, FILTER)).toBe(true)
  })

  it('rejects wrong channel', () => {
    expect(shouldProcessMessage({ channel: 'C999', user: 'U123' }, FILTER)).toBe(false)
  })

  it('rejects disallowed user', () => {
    expect(shouldProcessMessage({ channel: 'C123', user: 'U999' }, FILTER)).toBe(false)
  })

  it('rejects when user field is absent', () => {
    expect(shouldProcessMessage({ channel: 'C123' }, FILTER)).toBe(false)
  })

  it('rejects when channel field is absent', () => {
    expect(shouldProcessMessage({ user: 'U123' }, FILTER)).toBe(false)
  })

  it('rejects when bot_id is present (even if user matches — Bolt SDK gap)', () => {
    expect(shouldProcessMessage({ channel: 'C123', user: 'U123', bot_id: 'B001' }, FILTER)).toBe(
      false,
    )
  })

  it('rejects when subtype is present', () => {
    expect(
      shouldProcessMessage({ channel: 'C123', user: 'U123', subtype: 'bot_message' }, FILTER),
    ).toBe(false)
  })
})

describe('createStderrLogger', () => {
  it('routes info messages to stderr with [slack:info] prefix', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const logger = createStderrLogger()
    logger.info('test message')
    expect(spy).toHaveBeenCalledWith('[slack:info]', 'test message')
    spy.mockRestore()
  })

  it('routes warn messages to stderr with [slack:warn] prefix', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const logger = createStderrLogger()
    logger.warn('test warning')
    expect(spy).toHaveBeenCalledWith('[slack:warn]', 'test warning')
    spy.mockRestore()
  })

  it('routes debug messages to stderr with [slack:debug] prefix', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const logger = createStderrLogger()
    logger.debug('test debug')
    expect(spy).toHaveBeenCalledWith('[slack:debug]', 'test debug')
    spy.mockRestore()
  })

  it('routes error messages to stderr with [slack:error] prefix', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const logger = createStderrLogger()
    logger.error('test error')
    expect(spy).toHaveBeenCalledWith('[slack:error]', 'test error')
    spy.mockRestore()
  })

  it('setLevel does not throw', () => {
    const logger = createStderrLogger()
    expect(() => logger.setLevel(LogLevel.DEBUG)).not.toThrow()
  })

  it('setName does not throw', () => {
    const logger = createStderrLogger()
    expect(() => logger.setName('test-name')).not.toThrow()
  })

  it('getLevel returns LogLevel.INFO', () => {
    const logger = createStderrLogger()
    expect(logger.getLevel()).toBe(LogLevel.INFO)
  })
})
