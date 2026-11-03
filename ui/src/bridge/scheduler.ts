export interface Scheduler {
  now(): number
  after(ms: number, fn: () => void): () => void
}

export const realScheduler: Scheduler = {
  now: () => Date.now(),
  after: (ms, fn) => {
    const id = setTimeout(fn, ms)
    return () => clearTimeout(id)
  },
}

interface Timer {
  at: number
  order: number
  fn: () => void
}

export class ManualScheduler implements Scheduler {
  private current: number
  private order = 0
  private timers: Timer[] = []

  constructor(startAt = 0) {
    this.current = startAt
  }

  now(): number {
    return this.current
  }

  after(ms: number, fn: () => void): () => void {
    const timer: Timer = { at: this.current + Math.max(0, ms), order: this.order, fn }
    this.order += 1
    this.timers.push(timer)
    return () => {
      this.timers = this.timers.filter((candidate) => candidate !== timer)
    }
  }

  pending(): number {
    return this.timers.length
  }

  advance(ms: number): void {
    const target = this.current + Math.max(0, ms)
    for (;;) {
      const due = this.timers
        .filter((timer) => timer.at <= target)
        .sort((left, right) => left.at - right.at || left.order - right.order)[0]
      if (!due) break
      this.timers = this.timers.filter((timer) => timer !== due)
      this.current = Math.max(this.current, due.at)
      due.fn()
    }
    this.current = Math.max(this.current, target)
  }
}
