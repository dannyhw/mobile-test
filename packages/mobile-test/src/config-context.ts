/**
 * Global config state for the current test run.
 * Set by the vitest matchers-setup or manually before tests.
 *
 * Uses globalThis with Symbol.for keys so that multiple vite module
 * instances (e.g. workspace-linked packages) share the same state.
 */

const CONFIG_KEY = Symbol.for('mobile-test:config')

const g = globalThis as any

const defaults = {
  actionTimeout: 5_000,
  screenshotsDir: './screenshots',
  screenshotThreshold: 0.1,
  screenshotMaxDiffPercentage: 0,
  screenshotAntialiasing: true,
  logLevel: 'info' as 'silent' | 'info' | 'debug',
}

function getConfig() {
  if (!g[CONFIG_KEY]) {
    g[CONFIG_KEY] = { ...defaults }
  }
  return g[CONFIG_KEY]
}

export function setTestConfig(overrides: Partial<typeof defaults>): void {
  g[CONFIG_KEY] = { ...defaults, ...overrides }
}

export function getActionTimeout(): number {
  return getConfig().actionTimeout
}

export function getScreenshotsDir(): string {
  return getConfig().screenshotsDir
}

export function getLogLevel(): 'silent' | 'info' | 'debug' {
  return getConfig().logLevel
}

export function getScreenshotDefaults() {
  const config = getConfig()
  return {
    threshold: config.screenshotThreshold,
    maxDiffPercentage: config.screenshotMaxDiffPercentage,
    antialiasing: config.screenshotAntialiasing,
  }
}
