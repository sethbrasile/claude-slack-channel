import { describe, expect, it, spyOn } from 'bun:test'
import { createStderrLogger, isDuplicate, shouldProcessMessage } from '../slack-client.ts'

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

describe('isDuplicate', () => {
  it('returns false on first call with a ts', () => {
    const seen = new Set<string>()
    expect(isDuplicate('ts1', seen)).toBe(false)
  })

  it('returns true on second call with the same ts', () => {
    const seen = new Set<string>()
    isDuplicate('ts1', seen)
    expect(isDuplicate('ts1', seen)).toBe(true)
  })

  it('returns false for a different ts value', () => {
    const seen = new Set<string>()
    isDuplicate('ts1', seen)
    expect(isDuplicate('ts2', seen)).toBe(false)
  })
})

describe('createStderrLogger', () => {
  it('routes info messages to stderr', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const logger = createStderrLogger()
    logger.info('test message')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('routes warn messages to stderr', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const logger = createStderrLogger()
    logger.warn('test warning')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('routes debug messages to stderr', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const logger = createStderrLogger()
    logger.debug('test debug')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('routes error messages to stderr', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const logger = createStderrLogger()
    logger.error('test error')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
