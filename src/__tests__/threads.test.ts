import { beforeEach, describe, expect, it } from 'bun:test'
import type { MessageClassification } from '../threads.ts'
import { ThreadTracker } from '../threads.ts'

describe('ThreadTracker', () => {
  let tracker: ThreadTracker

  beforeEach(() => {
    tracker = new ThreadTracker()
  })

  it('starts with activeThreadTs === null', () => {
    expect(tracker.activeThreadTs).toBeNull()
  })

  it('startThread sets activeThreadTs', () => {
    tracker.startThread('1234567890.000100')
    expect(tracker.activeThreadTs).toBe('1234567890.000100')
  })

  it('classifyMessage(undefined) returns new_input — top-level message', () => {
    const result: MessageClassification = tracker.classifyMessage(undefined)
    expect(result).toBe('new_input')
  })

  it('classifyMessage(activeThreadTs) returns thread_reply', () => {
    tracker.startThread('1234567890.000100')
    const result: MessageClassification = tracker.classifyMessage('1234567890.000100')
    expect(result).toBe('thread_reply')
  })

  it('classifyMessage(differentTs) returns new_input — stale thread', () => {
    tracker.startThread('1234567890.000100')
    const result: MessageClassification = tracker.classifyMessage('9999999999.000100')
    expect(result).toBe('new_input')
  })

  it('abandon() sets activeThreadTs to null', () => {
    tracker.startThread('1234567890.000100')
    tracker.abandon()
    expect(tracker.activeThreadTs).toBeNull()
  })

  it('second startThread replaces first — old ts becomes new_input', () => {
    tracker.startThread('1234567890.000100')
    tracker.startThread('9999999999.000200')
    expect(tracker.activeThreadTs).toBe('9999999999.000200')
    const result: MessageClassification = tracker.classifyMessage('1234567890.000100')
    expect(result).toBe('new_input')
  })

  it('classifyMessage(anyTs) returns new_input when no thread started', () => {
    const result: MessageClassification = tracker.classifyMessage('1234567890.000100')
    expect(result).toBe('new_input')
  })

  it("classifyMessage('') returns new_input — empty string treated as top-level", () => {
    const result: MessageClassification = tracker.classifyMessage('')
    expect(result).toBe('new_input')
  })
})
