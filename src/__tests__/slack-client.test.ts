import { describe, expect, it, spyOn } from 'bun:test'
import { LogLevel } from '@slack/logger'
import {
  createStderrLogger,
  InteractiveBodySchema,
  isDuplicateTs,
  MAX_SEEN_TS,
  shouldProcessMessage,
  validateEventTs,
} from '../slack-client.ts'

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

  it('scrubs xoxb- tokens from debug messages', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const logger = createStderrLogger()
    logger.debug('token: xoxb-123-abc')
    // biome-ignore lint/style/noNonNullAssertion: spy is called exactly once above
    const args = spy.mock.calls[0]!
    expect(args[0]).toBe('[slack:debug]')
    expect(String(args[1])).not.toContain('xoxb-')
    spy.mockRestore()
  })

  it('scrubs xoxp- tokens from info messages', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const logger = createStderrLogger()
    logger.info('xoxp-456-def')
    // biome-ignore lint/style/noNonNullAssertion: spy is called exactly once above
    const args = spy.mock.calls[0]!
    expect(args[0]).toBe('[slack:info]')
    expect(String(args[1])).not.toContain('xoxp-')
    spy.mockRestore()
  })

  it('scrubs xapp- tokens from warn messages', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const logger = createStderrLogger()
    logger.warn('xapp-789-ghi')
    // biome-ignore lint/style/noNonNullAssertion: spy is called exactly once above
    const args = spy.mock.calls[0]!
    expect(args[0]).toBe('[slack:warn]')
    expect(String(args[1])).not.toContain('xapp-')
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

describe('validateEventTs', () => {
  it('returns ts string when present and non-empty', () => {
    expect(validateEventTs('1234567890.123456')).toBe('1234567890.123456')
  })

  it('returns null and logs [slack-client] event without ts when ts is undefined', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const result = validateEventTs(undefined)
    expect(result).toBeNull()
    expect(spy).toHaveBeenCalledWith('[slack-client] event without ts')
    spy.mockRestore()
  })

  it('returns null and logs [slack-client] event without ts when ts is empty string', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const result = validateEventTs('')
    expect(result).toBeNull()
    expect(spy).toHaveBeenCalledWith('[slack-client] event without ts')
    spy.mockRestore()
  })

  it('null return prevents seenTs pollution (seenTs.set never reached on null)', () => {
    // validateEventTs returns null for missing/empty ts.
    // The event handler checks: if (ts === null || seenTs.has(ts)) return
    // so seenTs.set() is never reached — empty-string ts cannot pollute the map.
    expect(validateEventTs(undefined)).toBeNull()
    expect(validateEventTs('')).toBeNull()
  })
})

describe('isDuplicateTs', () => {
  it('returns false on first call — not a duplicate', () => {
    const seenTs = new Map<string, number>()
    const now = Date.now()
    expect(isDuplicateTs(seenTs, '123.456', now)).toBe(false)
  })

  it('returns true on second call within TTL — same ts is a duplicate', () => {
    const seenTs = new Map<string, number>()
    const now = Date.now()
    isDuplicateTs(seenTs, '123.456', now)
    expect(isDuplicateTs(seenTs, '123.456', now + 1000)).toBe(true)
  })

  it('returns false after TTL expires — expired ts is re-accepted', () => {
    const seenTs = new Map<string, number>()
    const now = Date.now()
    isDuplicateTs(seenTs, '123.456', now)
    // 31 seconds later — past the 30s TTL
    expect(isDuplicateTs(seenTs, '123.456', now + 31_000)).toBe(false)
  })

  it('evicts oldest entry when seenTs.size === MAX_SEEN_TS before insert', () => {
    const seenTs = new Map<string, number>()
    const now = Date.now()
    // Fill the map to capacity with entries that won't expire yet (TTL = 30s)
    for (let i = 0; i < MAX_SEEN_TS; i++) {
      seenTs.set(`ts.${i}`, now + 30_000)
    }
    // The oldest entry is 'ts.0' — first key in insertion order
    expect(seenTs.has('ts.0')).toBe(true)
    // Insert a new ts — should evict 'ts.0' to stay within cap
    isDuplicateTs(seenTs, 'new.ts', now)
    expect(seenTs.has('ts.0')).toBe(false)
    expect(seenTs.has('new.ts')).toBe(true)
    expect(seenTs.size).toBe(MAX_SEEN_TS)
  })

  it('MAX_SEEN_TS is exported and equals 10_000', () => {
    expect(MAX_SEEN_TS).toBe(10_000)
  })
})

describe('InteractiveBodySchema', () => {
  const validBody = {
    actions: [{ action_id: 'approve__req-123' }],
    user: { id: 'U123' },
    channel: { id: 'C123' },
    message: { ts: '1234567890.123456' },
  }

  it('Test 1: valid body passes safeParse — returns success=true with typed data', () => {
    const result = InteractiveBodySchema.safeParse(validBody)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.actions[0]?.action_id).toBe('approve__req-123')
      expect(result.data.user.id).toBe('U123')
      expect(result.data.channel.id).toBe('C123')
      expect(result.data.message.ts).toBe('1234567890.123456')
    }
  })

  it('Test 2: body missing `actions` array fails safeParse — returns success=false', () => {
    const { actions: _actions, ...bodyWithoutActions } = validBody
    const result = InteractiveBodySchema.safeParse(bodyWithoutActions)
    expect(result.success).toBe(false)
  })

  it('Test 3: body with empty `actions` array fails (min(1) constraint)', () => {
    const result = InteractiveBodySchema.safeParse({ ...validBody, actions: [] })
    expect(result.success).toBe(false)
  })

  it('Test 4: body missing `user.id` fails safeParse', () => {
    const result = InteractiveBodySchema.safeParse({ ...validBody, user: {} })
    expect(result.success).toBe(false)
  })

  it('Test 5: body missing `channel.id` fails safeParse', () => {
    const result = InteractiveBodySchema.safeParse({ ...validBody, channel: {} })
    expect(result.success).toBe(false)
  })

  it('Test 6: body missing `message.ts` fails safeParse', () => {
    const result = InteractiveBodySchema.safeParse({ ...validBody, message: {} })
    expect(result.success).toBe(false)
  })

  it('Test 7: body with optional `message.thread_ts` present passes and preserves it', () => {
    const bodyWithThread = {
      ...validBody,
      message: { ts: '1234567890.123456', thread_ts: '1234567890.000001' },
    }
    const result = InteractiveBodySchema.safeParse(bodyWithThread)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.message.thread_ts).toBe('1234567890.000001')
    }
  })
})
