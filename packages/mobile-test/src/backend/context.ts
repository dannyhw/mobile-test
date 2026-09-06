import type { Backend } from './types.js'

/**
 * Global backend state for the current test run.
 *
 * Uses globalThis with Symbol.for keys so that multiple vite module
 * instances (e.g. workspace-linked packages) share the same state.
 */
const BACKEND_KEY = Symbol.for('mobile-test:backend')
const BUNDLE_KEY = Symbol.for('mobile-test:bundle-id')

const g = globalThis as any

export function setBackend(backend: Backend | undefined): void {
  g[BACKEND_KEY] = backend
}

export function getBackend(): Backend {
  if (!g[BACKEND_KEY]) {
    throw new Error(
      'Device backend not connected — are you running inside a test?\n\n' +
      'Make sure the mobile-test vitest plugin is configured, or call setBackend() manually.'
    )
  }
  return g[BACKEND_KEY]
}

export function hasBackend(): boolean {
  return Boolean(g[BACKEND_KEY])
}

export function setActiveBundleId(bundleId: string | null): void {
  g[BUNDLE_KEY] = bundleId
}

export function getActiveBundleId(): string | null {
  return g[BUNDLE_KEY] ?? null
}
