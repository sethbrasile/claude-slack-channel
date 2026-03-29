import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { parseConfig, safeErrorMessage } from '../config.ts'

const VALID_ENV = {
  SLACK_CHANNEL_ID: 'C0123456789',
  SLACK_BOT_TOKEN: 'xoxb-test-token',
  SLACK_APP_TOKEN: 'xapp-test-token',
  ALLOWED_USER_IDS: 'U0123456789',
}

describe('parseConfig', () => {
  it('parses valid environment variables', () => {
    const config = parseConfig(VALID_ENV)
    expect(config.channelId).toBe('C0123456789')
    expect(config.slackBotToken).toBe('xoxb-test-token')
    expect(config.slackAppToken).toBe('xapp-test-token')
    expect(config.allowedUserIds).toEqual(['U0123456789'])
    expect(config.serverName).toBe('slack')
  })

  it('splits comma-separated ALLOWED_USER_IDS', () => {
    const config = parseConfig({ ...VALID_ENV, ALLOWED_USER_IDS: 'U111,U222,U333' })
    expect(config.allowedUserIds).toEqual(['U111', 'U222', 'U333'])
  })

  // L16 — ALLOWED_USER_IDS trim behavior
  it('trims whitespace from individual user IDs in ALLOWED_USER_IDS', () => {
    const config = parseConfig({ ...VALID_ENV, ALLOWED_USER_IDS: ' U123 , U456 ' })
    expect(config.allowedUserIds).toEqual(['U123', 'U456'])
  })

  it('uses SERVER_NAME default of "slack" when not provided', () => {
    const config = parseConfig(VALID_ENV)
    expect(config.serverName).toBe('slack')
  })

  it('uses provided SERVER_NAME', () => {
    const config = parseConfig({ ...VALID_ENV, SERVER_NAME: 'my-slack' })
    expect(config.serverName).toBe('my-slack')
  })

  it('accepts SLACK_CHANNEL_ID with G prefix (private group)', () => {
    const config = parseConfig({ ...VALID_ENV, SLACK_CHANNEL_ID: 'G0123456789' })
    expect(config.channelId).toBe('G0123456789')
  })

  describe('validation failures', () => {
    let exitSpy: ReturnType<typeof spyOn>

    beforeEach(() => {
      exitSpy = spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called')
      }) as never)
    })

    afterEach(() => {
      exitSpy.mockRestore()
    })

    it('exits when SLACK_BOT_TOKEN does not start with xoxb-', () => {
      expect(() => parseConfig({ ...VALID_ENV, SLACK_BOT_TOKEN: 'xoxp-wrong-type' })).toThrow(
        'process.exit called',
      )
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits when SLACK_APP_TOKEN does not start with xapp-', () => {
      expect(() => parseConfig({ ...VALID_ENV, SLACK_APP_TOKEN: 'xoxb-wrong-type' })).toThrow(
        'process.exit called',
      )
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits when ALLOWED_USER_IDS contains an invalid user ID format', () => {
      expect(() => parseConfig({ ...VALID_ENV, ALLOWED_USER_IDS: 'invalid-id' })).toThrow(
        'process.exit called',
      )
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits when SLACK_CHANNEL_ID is missing', () => {
      const { SLACK_CHANNEL_ID: _, ...rest } = VALID_ENV
      expect(() => parseConfig(rest)).toThrow('process.exit called')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits when SLACK_BOT_TOKEN is missing', () => {
      const { SLACK_BOT_TOKEN: _, ...rest } = VALID_ENV
      expect(() => parseConfig(rest)).toThrow('process.exit called')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits when SLACK_APP_TOKEN is missing', () => {
      const { SLACK_APP_TOKEN: _, ...rest } = VALID_ENV
      expect(() => parseConfig(rest)).toThrow('process.exit called')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits when ALLOWED_USER_IDS is missing', () => {
      const { ALLOWED_USER_IDS: _, ...rest } = VALID_ENV
      expect(() => parseConfig(rest)).toThrow('process.exit called')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits when ALLOWED_USER_IDS is commas-only (empty after split)', () => {
      expect(() => parseConfig({ ...VALID_ENV, ALLOWED_USER_IDS: ',' })).toThrow(
        'process.exit called',
      )
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits when ALLOWED_USER_IDS is whitespace only', () => {
      expect(() => parseConfig({ ...VALID_ENV, ALLOWED_USER_IDS: '   ' })).toThrow(
        'process.exit called',
      )
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits when SLACK_CHANNEL_ID has invalid format (not C/G prefix)', () => {
      expect(() => parseConfig({ ...VALID_ENV, SLACK_CHANNEL_ID: 'not-a-channel' })).toThrow(
        'process.exit called',
      )
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })
})

describe('safeErrorMessage', () => {
  it('masks xoxb- tokens', () => {
    const err = new Error('Failed with token xoxb-123-abc-def')
    expect(safeErrorMessage(err)).not.toContain('xoxb-')
    expect(safeErrorMessage(err)).toContain('[REDACTED]')
  })

  it('masks xapp- tokens', () => {
    expect(safeErrorMessage(new Error('xapp-abc-123'))).toContain('[REDACTED]')
  })

  it('masks xoxp- tokens (user OAuth tokens)', () => {
    expect(safeErrorMessage(new Error('token xoxp-abc-123'))).toContain('[REDACTED]')
    expect(safeErrorMessage(new Error('token xoxp-abc-123'))).not.toContain('xoxp-')
  })

  it('masks xoxa- tokens (app-level tokens)', () => {
    expect(safeErrorMessage(new Error('token xoxa-abc-123'))).toContain('[REDACTED]')
    expect(safeErrorMessage(new Error('token xoxa-abc-123'))).not.toContain('xoxa-')
  })

  it('handles non-Error values', () => {
    expect(safeErrorMessage('plain string')).toBe('plain string')
  })

  // L19 — mid-word token (token embedded within a larger word)
  it('masks xoxb- token embedded in a word (mid-word token)', () => {
    const result = safeErrorMessage(new Error('errorxoxb-123abc'))
    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('xoxb-')
  })
})
