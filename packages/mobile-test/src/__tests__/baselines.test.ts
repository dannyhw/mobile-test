import { describe, it, expect } from 'vitest'
import { resolveBaselinePath, resolveLatestPath, resolveDiffPath } from '../screenshot/baselines.js'
import type { DeviceInfo } from '../device/types.js'

const device: DeviceInfo = { name: 'iPhone 16 Pro', udid: 'test-udid', platform: 'ios' }

describe('baseline path resolution', () => {
  it('resolves baseline path with device name', () => {
    expect(resolveBaselinePath('home', device)).toBe(
      'screenshots/baseline/iPhone-16-Pro/home.png',
    )
  })

  it('resolves latest path', () => {
    expect(resolveLatestPath('home', device)).toBe(
      'screenshots/latest/iPhone-16-Pro/home.png',
    )
  })

  it('resolves diff path', () => {
    expect(resolveDiffPath('home', device)).toBe(
      'screenshots/diff/iPhone-16-Pro/home.png',
    )
  })

  it('sanitizes special characters in device name', () => {
    const specialDevice: DeviceInfo = { name: 'iPhone (14) Pro Max', udid: 'x', platform: 'ios' }
    expect(resolveBaselinePath('test', specialDevice)).toBe(
      'screenshots/baseline/iPhone--14--Pro-Max/test.png',
    )
  })

  it('uses custom screenshots dir', () => {
    expect(resolveBaselinePath('home', device, './custom-dir')).toBe(
      'custom-dir/baseline/iPhone-16-Pro/home.png',
    )
  })
})
