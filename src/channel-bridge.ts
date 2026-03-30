import type { SlackMessage } from './slack-client.ts'

export interface ChannelNotificationParams {
  content: string
  source?: string
  meta?: Record<string, string>
}

export function formatInboundNotification(msg: SlackMessage): ChannelNotificationParams {
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
  return { content: msg.text, source: 'slack', meta }
}
