import type { Device } from './types.js'

const DEVICE_KEY = Symbol.for('mobile-test:device')

const g = globalThis as any

export function setDevice(device: Device): void {
  g[DEVICE_KEY] = device
}

export const device: Device = new Proxy({} as Device, {
  get(_target, prop) {
    if (!g[DEVICE_KEY]) {
      throw new Error(
        'Device not initialized — are you running inside a test?\n\n' +
        'Make sure you are using the mobile-test vitest plugin in your vitest config.'
      )
    }
    const value = g[DEVICE_KEY][prop as keyof Device]
    if (typeof value === 'function') {
      return value.bind(g[DEVICE_KEY])
    }
    return value
  },
})
