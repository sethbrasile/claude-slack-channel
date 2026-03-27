export type MessageClassification = 'thread_reply' | 'new_input'

export class ThreadTracker {
  private _activeThreadTs: string | null = null

  get activeThreadTs(): string | null {
    return this._activeThreadTs
  }

  startThread(ts: string): void {
    this._activeThreadTs = ts
  }

  abandon(): void {
    this._activeThreadTs = null
  }

  classifyMessage(threadTs: string | undefined): MessageClassification {
    if (!threadTs) return 'new_input'
    if (threadTs === this._activeThreadTs) return 'thread_reply'
    return 'new_input'
  }
}
