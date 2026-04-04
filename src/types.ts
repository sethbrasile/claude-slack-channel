export interface ChannelConfig {
  channelId: string
  slackBotToken: string
  slackAppToken: string
  allowedUserIds: string[]
  serverName: string
  headless: boolean
}

export interface PermissionRequest {
  request_id: string
  tool_name: string
  description: string
  input_preview: string
}

export interface PendingPermissionEntry {
  params: PermissionRequest
  expiresAt: number
}

export interface PermissionVerdict {
  request_id: string
  behavior: 'allow' | 'deny'
}
