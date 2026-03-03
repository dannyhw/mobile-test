/**
 * Debug logger and performance tracker.
 *
 * Log level is stored on globalThis via Symbol.for so multiple
 * module instances share the same state (same pattern as config-context).
 */

export type LogLevel = 'silent' | 'info' | 'debug'

const LOG_LEVEL_KEY = Symbol.for('mobile-test:logLevel')
const PERF_KEY = Symbol.for('mobile-test:perfEntries')

const g = globalThis as any

interface PerfEntry {
  label: string
  duration: number
}

function getLevel(): LogLevel {
  return g[LOG_LEVEL_KEY] ?? 'info'
}

export function setLogLevel(level: LogLevel): void {
  g[LOG_LEVEL_KEY] = level
}

function getPerfEntries(): PerfEntry[] {
  if (!g[PERF_KEY]) g[PERF_KEY] = []
  return g[PERF_KEY]
}

export const log = {
  info(msg: string): void {
    if (getLevel() === 'silent') return
    console.log(`[mobile-test] ${msg}`)
  },

  debug(msg: string): void {
    if (getLevel() !== 'debug') return
    console.log(`[mobile-test:debug] ${msg}`)
  },

  /**
   * Time an async function. Logs duration at debug level and
   * records it for the timing summary.
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    try {
      return await fn()
    } finally {
      const duration = performance.now() - start
      getPerfEntries().push({ label, duration })
      if (getLevel() === 'debug') {
        console.log(`[mobile-test:debug] ${label} — ${duration.toFixed(0)}ms`)
      }
    }
  },

  /**
   * Print a table of all recorded timings, sorted by duration descending.
   */
  printTimingSummary(): void {
    const entries = getPerfEntries()
    if (entries.length === 0) return

    // Aggregate by label
    const agg = new Map<string, { count: number; total: number }>()
    for (const { label, duration } of entries) {
      const existing = agg.get(label)
      if (existing) {
        existing.count++
        existing.total += duration
      } else {
        agg.set(label, { count: 1, total: duration })
      }
    }

    const rows = [...agg.entries()]
      .map(([label, { count, total }]) => ({ label, count, total, avg: total / count }))
      .sort((a, b) => b.total - a.total)

    console.log('\n[mobile-test] ⏱ Timing Summary')
    console.log('─'.repeat(70))
    console.log(`${'Operation'.padEnd(35)} ${'Count'.padStart(6)} ${'Total'.padStart(10)} ${'Avg'.padStart(10)}`)
    console.log('─'.repeat(70))
    for (const row of rows) {
      console.log(
        `${row.label.padEnd(35)} ${String(row.count).padStart(6)} ${(row.total.toFixed(0) + 'ms').padStart(10)} ${(row.avg.toFixed(0) + 'ms').padStart(10)}`,
      )
    }
    console.log('─'.repeat(70))

    // Clear entries
    g[PERF_KEY] = []
  },
}
