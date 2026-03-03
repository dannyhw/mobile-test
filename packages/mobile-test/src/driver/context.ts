import { DriverClient } from './client.js'

const CLIENT_KEY = Symbol.for('mobile-test:driver-client')
const BUNDLE_KEY = Symbol.for('mobile-test:bundle-id')

const g = globalThis as any

export function setDriverClient(client: DriverClient): void {
  g[CLIENT_KEY] = client
}

export function getDriverClient(): DriverClient {
  if (!g[CLIENT_KEY]) {
    throw new Error(
      'Driver not connected — are you running inside a test?\n\n' +
      'Make sure the mobile-test driver is started (via vitest plugin or manually).'
    )
  }
  return g[CLIENT_KEY]
}

export function setActiveBundleId(bundleId: string): void {
  g[BUNDLE_KEY] = bundleId
}

export function getActiveBundleId(): string | null {
  return g[BUNDLE_KEY] ?? null
}
