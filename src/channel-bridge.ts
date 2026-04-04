import type { SlackMessage } from './slack-client.ts'

export interface ChannelNotificationParams {
  content: string
  source?: string
  meta?: Record<string, string>
}

export function formatInboundNotification(
  msg: SlackMessage,
  options?: { headless?: boolean },
): ChannelNotificationParams {
  const meta: Record<string, string> = {
    user: msg.user,
    channel: msg.channel,
    ts: msg.ts,
  }
  if (msg.thread_ts) {
    meta.thread_ts = msg.thread_ts // underscore only — hyphens silently dropped by protocol
  }
  // Detect !command prefix — signals Claude should treat this as a skill invocation
  if (/^!\S+/.test(msg.text)) {
    meta.command_intent = 'true'
  }
  if (options?.headless) {
    meta.mode = 'headless'
  }
  return { content: msg.text, source: 'slack', meta }
}
