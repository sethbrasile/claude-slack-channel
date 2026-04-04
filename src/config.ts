import { z } from 'zod'
import type { ChannelConfig } from './types.ts'

const SLACK_USER_ID_RE = /^[UW][A-Z0-9]+$/

const ConfigSchema = z.object({
  SLACK_CHANNEL_ID: z
    .string()
    .min(1, 'SLACK_CHANNEL_ID is required')
    .regex(
      /^[CG][A-Z0-9]+$/,
      'SLACK_CHANNEL_ID must be a Slack channel/group ID (e.g. C0XXX or G0XXX)',
    ),
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-', 'SLACK_BOT_TOKEN must start with xoxb-'),
  SLACK_APP_TOKEN: z.string().startsWith('xapp-', 'SLACK_APP_TOKEN must start with xapp-'),
  ALLOWED_USER_IDS: z
    .string()
    .min(1, 'ALLOWED_USER_IDS is required')
    .transform((s) =>
      s
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .refine((arr) => arr.length > 0, 'ALLOWED_USER_IDS must contain at least one valid ID'),
  SERVER_NAME: z
    .string()
    .regex(
      /^[a-zA-Z0-9_-]{1,64}$/,
      'SERVER_NAME must be alphanumeric with hyphens/underscores only',
    )
    .default('slack'),
  HEADLESS: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
})

export function parseConfig(env: Record<string, string | undefined>): ChannelConfig {
  const result = ConfigSchema.safeParse(env)
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    for (const [field, msgs] of Object.entries(errors)) {
      console.error(`  ${field}: ${msgs?.join(', ')}`)
    }
    console.error('Missing or invalid environment variables.')
    process.exit(1)
  }

  // Validate user ID format after Zod parse
  for (const id of result.data.ALLOWED_USER_IDS) {
    if (!SLACK_USER_ID_RE.test(id)) {
      console.error(`Invalid Slack user ID format: "${id}" (expected /^[UW][A-Z0-9]+$/)`)
      process.exit(1)
    }
  }

  return {
    channelId: result.data.SLACK_CHANNEL_ID,
    slackBotToken: result.data.SLACK_BOT_TOKEN,
    slackAppToken: result.data.SLACK_APP_TOKEN,
    allowedUserIds: result.data.ALLOWED_USER_IDS,
    serverName: result.data.SERVER_NAME,
    headless: result.data.HEADLESS,
  }
}

export function safeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/x(?:ox[a-z]|app)-[^\s]+/g, '[REDACTED]')
}
