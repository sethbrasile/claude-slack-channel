import { beforeEach, describe, expect, it, spyOn } from 'bun:test'
import {
  BLOCK_TEXT_LIMIT,
  DETAIL_MAX_ENTRIES,
  DETAIL_TTL_MS,
  DetailStore,
} from '../detail-store.ts'

describe('DetailStore', () => {
  let store: DetailStore

  beforeEach(() => {
    store = new DetailStore()
  })

  it('store + retrieve returns stored text', () => {
    store.store('1234.5678', 'hello world')
    expect(store.retrieve('1234.5678')).toBe('hello world')
  })

  it('store same threadTs appends with separator', () => {
    store.store('1234.5678', 'first')
    store.store('1234.5678', 'second')
    expect(store.retrieve('1234.5678')).toBe('first\n---\nsecond')
  })

  it('retrieve returns null for unknown threadTs', () => {
    expect(store.retrieve('9999.0000')).toBeNull()
  })

  it('TTL expiry: store, advance time past TTL, retrieve returns null', () => {
    const now = Date.now()
    const dateSpy = spyOn(Date, 'now')

    // Store at current time
    dateSpy.mockReturnValue(now)
    store.store('1234.5678', 'expires soon')

    // Advance past TTL
    dateSpy.mockReturnValue(now + DETAIL_TTL_MS + 1)
    expect(store.retrieve('1234.5678')).toBeNull()

    dateSpy.mockRestore()
  })

  it('Max-size eviction: store 51 entries, first entry is evicted', () => {
    for (let i = 0; i < DETAIL_MAX_ENTRIES; i++) {
      store.store(`ts-${i}`, `entry-${i}`)
    }
    // First entry should still exist
    expect(store.retrieve('ts-0')).toBe('entry-0')

    // Adding one more should evict ts-0 (the oldest)
    store.store('ts-overflow', 'overflow-entry')
    expect(store.retrieve('ts-0')).toBeNull()
    expect(store.retrieve('ts-overflow')).toBe('overflow-entry')
    // Second entry should still be there
    expect(store.retrieve('ts-1')).toBe('entry-1')
  })

  it('stores and retrieves empty string (L-08)', () => {
    const store = new DetailStore()
    store.store('ts-empty', '')
    expect(store.retrieve('ts-empty')).toBe('')
  })
})

describe('DetailStore.formatDetailBlocks', () => {
  it('short text produces single block with code fence', () => {
    const result = DetailStore.formatDetailBlocks('short text')
    expect(result.blocks).toHaveLength(1)
    expect((result.blocks[0] as { text: { text: string } }).text.text).toBe('```short text```')
    expect(result.text).toBe('short text')
  })

  it('text > 3000 chars splits into multiple blocks', () => {
    const chunkSize = BLOCK_TEXT_LIMIT - 6 // 2994 — reserves space for ``` wrapper
    const longText = 'a'.repeat(chunkSize + 500)
    const result = DetailStore.formatDetailBlocks(longText)
    expect(result.blocks.length).toBe(2)

    const firstBlock = result.blocks[0] as { text: { text: string } }
    const secondBlock = result.blocks[1] as { text: { text: string } }

    // First block should have chunkSize chars inside the code fence
    expect(firstBlock.text.text).toBe(`\`\`\`${'a'.repeat(chunkSize)}\`\`\``)
    // Wrapped block text must not exceed Slack's 3000-char section limit
    expect(firstBlock.text.text.length).toBeLessThanOrEqual(BLOCK_TEXT_LIMIT)
    // Second block gets the remaining 500 chars
    expect(secondBlock.text.text).toBe(`\`\`\`${'a'.repeat(500)}\`\`\``)
  })

  it('internal triple backticks are escaped', () => {
    const textWithBackticks = 'before```after'
    const result = DetailStore.formatDetailBlocks(textWithBackticks)
    // Internal backticks should have zero-width space inserted
    expect(result.text).toBe('before``\u200b`after')
    expect(result.text).not.toContain('```')
  })

  it('returns plain-text fallback in text field', () => {
    const result = DetailStore.formatDetailBlocks('hello world')
    expect(result.text).toBe('hello world')
    expect(typeof result.text).toBe('string')
  })

  it('all blocks have section type with mrkdwn', () => {
    const result = DetailStore.formatDetailBlocks('test content')
    for (const block of result.blocks) {
      const b = block as { type: string; text: { type: string } }
      expect(b.type).toBe('section')
      expect(b.text.type).toBe('mrkdwn')
    }
  })
})
