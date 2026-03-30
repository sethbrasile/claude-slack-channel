import { describe, expect, it, spyOn } from 'bun:test'
import {
  formatPermissionBlocks,
  formatPermissionRequest,
  formatPermissionResult,
  parseButtonAction,
  parsePermissionReply,
} from '../permission.ts'

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

describe('formatPermissionBlocks', () => {
  const req = {
    request_id: 'abcde',
    tool_name: 'Bash',
    description: 'Run shell command',
    input_preview: 'ls -la',
  }

  it('returns plain text fallback', () => {
    const { text } = formatPermissionBlocks(req)
    expect(text).toContain('abcde')
    expect(text).toContain('Bash')
  })

  it('returns section, actions, and context blocks', () => {
    const { blocks } = formatPermissionBlocks(req)
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toHaveProperty('type', 'section')
    expect(blocks[1]).toHaveProperty('type', 'actions')
    expect(blocks[2]).toHaveProperty('type', 'context')
  })

  it('includes Approve and Deny buttons with correct action_ids', () => {
    const { blocks } = formatPermissionBlocks(req)
    const actions = blocks[1] as { elements: { action_id: string; style: string }[] }
    expect(actions.elements).toHaveLength(2)
    const [approve, deny] = actions.elements
    expect(approve?.action_id).toBe('permission_approve_abcde')
    expect(approve?.style).toBe('primary')
    expect(deny?.action_id).toBe('permission_deny_abcde')
    expect(deny?.style).toBe('danger')
  })

  it('includes text fallback in context block', () => {
    const { blocks } = formatPermissionBlocks(req)
    const context = blocks[2] as { elements: { text: string }[] }
    const [el] = context.elements
    expect(el?.text).toContain('yes abcde')
    expect(el?.text).toContain('no abcde')
  })

  it('omits code block when input_preview is empty', () => {
    const { blocks } = formatPermissionBlocks({ ...req, input_preview: '' })
    const section = blocks[0] as { text: { text: string } }
    expect(section.text.text).not.toContain('```')
  })
})

describe('formatPermissionResult', () => {
  const req = {
    request_id: 'abcde',
    tool_name: 'Bash',
    description: 'Run shell command',
    input_preview: '',
  }

  it('shows approved result with user mention', () => {
    const { text, blocks } = formatPermissionResult(req, 'U12345', true)
    expect(text).toContain(':white_check_mark:')
    expect(text).toContain('Approved')
    expect(text).toContain('<@U12345>')
    expect(blocks).toHaveLength(2) // section + result, no actions block
  })

  it('shows denied result with user mention', () => {
    const { text, blocks } = formatPermissionResult(req, 'U12345', false)
    expect(text).toContain(':x:')
    expect(text).toContain('Denied')
    expect(text).toContain('<@U12345>')
    expect(blocks).toHaveLength(2)
  })

  it('does not include action buttons', () => {
    const { blocks } = formatPermissionResult(req, 'U12345', true)
    const types = blocks.map((b) => (b as { type: string }).type)
    expect(types).not.toContain('actions')
  })
})

// L4 — userId validation
describe('formatPermissionResult userId validation', () => {
  it('logs warning for invalid userId format and returns safe fallback (no user mention)', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const req = {
      request_id: 'abcde',
      tool_name: 'bash',
      description: 'run cmd',
      input_preview: '',
    }
    const result = formatPermissionResult(req, 'invalid-id', true)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('invalid userId format'))
    // Should not interpolate the invalid userId into the output
    expect(result.text).not.toContain('invalid-id')
    expect(result.text).toContain('unknown user')
    spy.mockRestore()
  })
})

// L17 — formatPermissionBlocks with broadcast mentions in fields
describe('formatPermissionBlocks mention stripping', () => {
  it('strips <@U12345> user mention from tool_name (zero-width space replacement)', () => {
    const req = {
      request_id: 'abcde',
      tool_name: '<@U12345> bash',
      description: 'run cmd',
      input_preview: '',
    }
    const { text } = formatPermissionBlocks(req)
    expect(text).not.toContain('<@U12345>')
    expect(text).toContain('<\u200b@U12345>')
  })

  it('strips <!subteam^ABC> broadcast from description (zero-width space replacement)', () => {
    const req = {
      request_id: 'abcde',
      tool_name: 'bash',
      description: '<!subteam^ABC> run cmd',
      input_preview: '',
    }
    const { text } = formatPermissionBlocks(req)
    expect(text).not.toContain('<!subteam^')
    expect(text).toContain('<\u200b!subteam^')
  })
})

describe('parseButtonAction', () => {
  it('parses approve action into allow verdict', () => {
    expect(parseButtonAction('permission_approve_abcde')).toEqual({
      request_id: 'abcde',
      behavior: 'allow',
    })
  })

  it('parses deny action into deny verdict', () => {
    expect(parseButtonAction('permission_deny_xyzwv')).toEqual({
      request_id: 'xyzwv',
      behavior: 'deny',
    })
  })

  it('returns null for unrelated action_id', () => {
    expect(parseButtonAction('some_other_action')).toBeNull()
  })

  it('returns null for action with l in request_id', () => {
    expect(parseButtonAction('permission_approve_abcle')).toBeNull()
  })

  it('returns null for action with wrong id length', () => {
    expect(parseButtonAction('permission_approve_abcd')).toBeNull()
    expect(parseButtonAction('permission_approve_abcdef')).toBeNull()
  })
})
