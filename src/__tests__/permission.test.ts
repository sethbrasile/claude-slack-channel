import { describe, expect, it } from 'bun:test'
import { formatPermissionRequest, parsePermissionReply } from '../permission.ts'

describe('parsePermissionReply', () => {
  it("'yes abcde' returns allow verdict", () => {
    expect(parsePermissionReply('yes abcde')).toEqual({ request_id: 'abcde', behavior: 'allow' })
  })

  it("'no xyzwv' returns deny verdict", () => {
    expect(parsePermissionReply('no xyzwv')).toEqual({ request_id: 'xyzwv', behavior: 'deny' })
  })

  it("'y abcde' shorthand returns allow", () => {
    expect(parsePermissionReply('y abcde')).toEqual({ request_id: 'abcde', behavior: 'allow' })
  })

  it("'n abcde' shorthand returns deny", () => {
    expect(parsePermissionReply('n abcde')).toEqual({ request_id: 'abcde', behavior: 'deny' })
  })

  it("'  yes   abcde  ' with extra whitespace returns allow", () => {
    expect(parsePermissionReply('  yes   abcde  ')).toEqual({
      request_id: 'abcde',
      behavior: 'allow',
    })
  })

  it("'YES ABCDE' case insensitive returns allow with lowercased request_id", () => {
    expect(parsePermissionReply('YES ABCDE')).toEqual({ request_id: 'abcde', behavior: 'allow' })
  })

  it("'catch me up on Sherman' returns null (not a reply)", () => {
    expect(parsePermissionReply('catch me up on Sherman')).toBeNull()
  })

  it("'yes' alone (no ID) returns null", () => {
    expect(parsePermissionReply('yes')).toBeNull()
  })

  it("'abcde' alone (no verb) returns null", () => {
    expect(parsePermissionReply('abcde')).toBeNull()
  })

  it("'yes abcle' containing 'l' returns null (excluded from protocol alphabet)", () => {
    expect(parsePermissionReply('yes abcle')).toBeNull()
  })

  it("'yes abcd' with 4 chars returns null (too short)", () => {
    expect(parsePermissionReply('yes abcd')).toBeNull()
  })

  it("'yes abcdef' with 6 chars returns null (too long)", () => {
    expect(parsePermissionReply('yes abcdef')).toBeNull()
  })
})

describe('formatPermissionRequest', () => {
  it('includes request_id, tool_name, description, yes and no keywords', () => {
    const result = formatPermissionRequest({
      request_id: 'abcde',
      tool_name: 'Bash',
      description: 'Run shell command',
      input_preview: 'ls -la',
    })
    expect(result).toContain('abcde')
    expect(result).toContain('Bash')
    expect(result).toContain('Run shell command')
    expect(result).toContain('yes')
    expect(result).toContain('no')
  })

  it('sanitizes triple backticks in input_preview to prevent code block injection', () => {
    const result = formatPermissionRequest({
      request_id: 'abcde',
      tool_name: 'Bash',
      description: 'Run code',
      input_preview: '```rm -rf /```',
    })
    // Triple backticks in input_preview should not render as a code block in Slack
    expect(result).not.toContain('```rm -rf /```')
    // The sanitized version uses a zero-width space
    expect(result).toContain('``\u200b`')
  })

  it('strips Slack broadcast mentions in description and tool_name', () => {
    const result = formatPermissionRequest({
      request_id: 'abcde',
      tool_name: '<!channel> alert',
      description: '<!here> everyone',
      input_preview: '',
    })
    // Should not contain raw broadcast mentions
    expect(result).not.toContain('<!channel>')
    expect(result).not.toContain('<!here>')
  })

  it('strips <!everyone> broadcast mention in description', () => {
    const result = formatPermissionRequest({
      request_id: 'abcde',
      tool_name: 'notify',
      description: '<!everyone> ping all',
      input_preview: '',
    })
    expect(result).not.toContain('<!everyone>')
  })

  it('omits code block when input_preview is absent (empty string)', () => {
    const result = formatPermissionRequest({
      request_id: 'abcde',
      tool_name: 'Read',
      description: 'Read a file',
      input_preview: '',
    })
    expect(result).toContain('abcde')
    expect(result).toContain('Read')
    expect(result).toContain('Read a file')
    expect(result).not.toContain('```')
  })
})
