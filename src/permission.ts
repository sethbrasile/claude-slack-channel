import { z } from 'zod'
import type { PermissionRequest, PermissionVerdict } from './types.ts'

// Protocol spec: request_id is 5 lowercase letters from a-z excluding 'l'
// (to avoid 1/I/l confusion on mobile screens)
export const PERMISSION_ID_PATTERN = '[a-km-z]{5}'

// Pre-built anchored regex for validating a single permission request ID.
// Exported so callers (server.ts) can use the constant directly instead of
// constructing new RegExp at call time.
export const PERMISSION_ID_RE = new RegExp(`^${PERMISSION_ID_PATTERN}$`)

const PERMISSION_REPLY_RE = new RegExp(`^\\s*(y|yes|n|no)\\s+(${PERMISSION_ID_PATTERN})\\s*$`, 'i')

export function parsePermissionReply(text: string): PermissionVerdict | null {
  const match = text.match(PERMISSION_REPLY_RE)
  if (!match?.[1] || !match[2]) return null

  const verdict = match[1].toLowerCase()
  const requestId = match[2].toLowerCase()

  return {
    request_id: requestId,
    behavior: verdict === 'y' || verdict === 'yes' ? 'allow' : 'deny',
  }
}

/** Strip Slack broadcast mentions and user mentions to prevent notification pings */
function stripMentions(s: string): string {
  return s
    .replaceAll('<!', '<\u200b!') // broadcast: <!channel>, <!here>, <!everyone>, <!subteam^>
    .replaceAll('<@', '<\u200b@') // user mentions: <@U12345>
}

/**
 * Formats a permission request as plain text (Slack mrkdwn).
 * Exported for testability — only called within permission.ts by formatPermissionBlocks
 * and formatPermissionResult.
 */
export function formatPermissionRequest(req: PermissionRequest): string {
  return [
    `:lock: *Permission Request* \`${req.request_id}\``,
    `*Tool:* \`${stripMentions(req.tool_name)}\``,
    `*Action:* ${stripMentions(req.description)}`,
    req.input_preview
      ? `\`\`\`${stripMentions(req.input_preview.replaceAll('```', '``\u200b`'))}\`\`\``
      : '',
    `Reply \`yes ${req.request_id}\` or \`no ${req.request_id}\``,
  ]
    .filter(Boolean)
    .join('\n')
}

// ============================================================
// Block Kit interactive buttons
// ============================================================

export interface PermissionBlocks {
  text: string
  // Block Kit payloads — typed as Record<string, unknown>[] for compatibility
  // with @slack/web-api's (Block | KnownBlock)[] without importing Slack types.
  blocks: Record<string, unknown>[]
}

/**
 * Returns Block Kit blocks for a permission request with Approve/Deny buttons,
 * plus a plain-text fallback for notifications and clients that don't render blocks.
 */
export function formatPermissionBlocks(req: PermissionRequest): PermissionBlocks {
  const text = formatPermissionRequest(req)

  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `:lock: *Permission Request* \`${req.request_id}\``,
          `*Tool:* \`${stripMentions(req.tool_name)}\``,
          `*Action:* ${stripMentions(req.description)}`,
          req.input_preview
            ? `\`\`\`${stripMentions(req.input_preview.replaceAll('```', '``\u200b`'))}\`\`\``
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve' },
          style: 'primary',
          action_id: `permission_approve_${req.request_id}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Deny' },
          style: 'danger',
          action_id: `permission_deny_${req.request_id}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Or reply \`yes ${req.request_id}\` / \`no ${req.request_id}\``,
        },
      ],
    },
  ]

  return { text, blocks }
}

/**
 * Returns updated blocks with buttons replaced by a verdict result line.
 * Used to update the Slack message after a button click.
 */
export function formatPermissionResult(
  req: PermissionRequest,
  userId: string,
  approved: boolean,
): PermissionBlocks {
  // Validate userId format — must be a Slack user/workspace ID
  if (!/^[UW][A-Z0-9]+$/.test(userId)) {
    console.error(`[permission] formatPermissionResult: invalid userId format`)
    // Fall back to a safe display instead of interpolating untrusted input
    const emoji = approved ? ':white_check_mark:' : ':x:'
    const action = approved ? 'Approved' : 'Denied'
    const resultText = `${emoji} ${action} by unknown user`

    const blocks: Record<string, unknown>[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `:lock: *Permission Request* \`${req.request_id}\``,
            `*Tool:* \`${stripMentions(req.tool_name)}\``,
            `*Action:* ${stripMentions(req.description)}`,
            req.input_preview
              ? `\`\`\`${stripMentions(req.input_preview.replaceAll('```', '``\u200b`'))}\`\`\``
              : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: resultText },
      },
    ]

    return { text: `${formatPermissionRequest(req)}\n${resultText}`, blocks }
  }
  const emoji = approved ? ':white_check_mark:' : ':x:'
  const action = approved ? 'Approved' : 'Denied'
  const resultText = `${emoji} ${action} by <@${userId}>`

  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `:lock: *Permission Request* \`${req.request_id}\``,
          `*Tool:* \`${stripMentions(req.tool_name)}\``,
          `*Action:* ${stripMentions(req.description)}`,
          req.input_preview
            ? `\`\`\`${stripMentions(req.input_preview.replaceAll('```', '``\u200b`'))}\`\`\``
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: resultText },
    },
  ]

  return { text: `${formatPermissionRequest(req)}\n${resultText}`, blocks }
}

const BUTTON_ACTION_RE = /^permission_(approve|deny)_([a-km-z]{5})$/

/**
 * Parses a Slack button action_id into a permission verdict.
 * Returns null if the action_id doesn't match the expected pattern.
 */
export function parseButtonAction(actionId: string): PermissionVerdict | null {
  const match = actionId.match(BUTTON_ACTION_RE)
  if (!match?.[1] || !match[2]) return null
  return {
    request_id: match[2],
    behavior: match[1] === 'approve' ? 'allow' : 'deny',
  }
}

// Exported for use in server.ts wireHandlers and CLI block.
// Validates the notifications/claude/channel/permission_request notification shape.
export const PermissionRequestSchema = z.object({
  method: z.literal('notifications/claude/channel/permission_request'),
  params: z.object({
    request_id: z.string().regex(PERMISSION_ID_RE),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string().optional().default(''),
  }),
})
