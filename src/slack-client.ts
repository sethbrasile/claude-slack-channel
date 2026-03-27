// Stub — implemented fully in Task 2 of plan 01-02
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { ChannelConfig } from './types.ts'

export interface MessageFilter {
  channelId: string
  allowedUserIds: string[]
}

export interface SlackEvent {
  channel?: string
  user?: string
  bot_id?: string
  subtype?: string
}

export interface SlackMessage {
  text: string
  user: string
  channel: string
  ts: string
  thread_ts?: string
}

export type MessageHandler = (message: SlackMessage) => void

export function shouldProcessMessage(event: SlackEvent, filter: MessageFilter): boolean {
  if (event.subtype) return false
  if (event.bot_id) return false
  if (!event.channel || !event.user) return false
  if (event.channel !== filter.channelId) return false
  if (!filter.allowedUserIds.includes(event.user)) return false
  return true
}

export function isDuplicate(ts: string, seen: Set<string>): boolean {
  if (seen.has(ts)) return true
  seen.add(ts)
  return false
}

export function createSlackClient(
  _config: ChannelConfig,
  _server: Server,
): { start(): Promise<void>; stop(): Promise<void> } {
  return {
    start: async () => {},
    stop: async () => {},
  }
}
