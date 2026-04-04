import type { DetailEntry } from './types.ts'

/** Detail entries expire after 1 hour */
export const DETAIL_TTL_MS = 60 * 60 * 1000

/** Maximum stored entries before oldest-first eviction */
export const DETAIL_MAX_ENTRIES = 50

/** Max characters per Block Kit section block */
export const BLOCK_TEXT_LIMIT = 3000

export interface DetailBlocks {
  text: string
  blocks: Record<string, unknown>[]
}

/**
 * In-memory store for detail text keyed by Slack thread timestamp.
 * TTL sweep is lazy (on access), not timer-based.
 * Eviction removes the oldest entry (first Map key) when at capacity.
 */
export class DetailStore {
  private entries = new Map<string, DetailEntry>()

  /** Store detail text for a thread. Appends if the thread already has an entry. */
  store(threadTs: string, text: string): void {
    this.sweepExpired()

    const existing = this.entries.get(threadTs)
    if (existing) {
      existing.text += `\n---\n${text}`
      existing.storedAt = Date.now()
      return
    }

    // Evict oldest entry if at capacity
    if (this.entries.size >= DETAIL_MAX_ENTRIES) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey)
      }
    }

    this.entries.set(threadTs, { text, storedAt: Date.now() })
  }

  /** Retrieve detail text for a thread. Returns null if missing or expired. */
  retrieve(threadTs: string): string | null {
    const entry = this.entries.get(threadTs)
    if (!entry) return null

    if (Date.now() - entry.storedAt > DETAIL_TTL_MS) {
      this.entries.delete(threadTs)
      return null
    }

    return entry.text
  }

  /** Lazy TTL sweep — removes all expired entries. */
  private sweepExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.entries) {
      if (now - entry.storedAt > DETAIL_TTL_MS) {
        this.entries.delete(key)
      }
    }
  }

  /**
   * Format detail text as Block Kit section blocks with code fences.
   * Splits text at BLOCK_TEXT_LIMIT chars per block.
   * Escapes internal triple backticks with zero-width space.
   */
  static formatDetailBlocks(text: string): DetailBlocks {
    const escaped = text.replaceAll('```', '``\u200b`')
    const chunks: string[] = []

    // Reserve 6 chars for the triple-backtick code fence wrapper (``` prefix + ``` suffix)
    // so the final section block text stays within Slack's 3000-char limit.
    const chunkSize = BLOCK_TEXT_LIMIT - 6
    for (let i = 0; i < escaped.length; i += chunkSize) {
      chunks.push(escaped.slice(i, i + chunkSize))
    }

    const blocks: Record<string, unknown>[] = chunks.map((chunk) => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `\`\`\`${chunk}\`\`\``,
      },
    }))

    return { text: escaped, blocks }
  }
}
