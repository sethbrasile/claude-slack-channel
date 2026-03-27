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

/** Strip Slack broadcast mentions to prevent @channel/@here notifications */
function stripMentions(s: string): string {
  return s.replaceAll('<!', '<\u200b!')
}

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
