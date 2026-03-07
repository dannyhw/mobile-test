import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('execa', () => ({
  execaCommand: vi.fn(),
}))

vi.mock('../screenshot/normalize.js', () => ({
  normalizeStatusBar: vi.fn().mockResolvedValue(undefined),
}))

import { execaCommand } from 'execa'
import { setTestConfig } from '../config-context.js'
import { getActiveBundleId } from '../driver/context.js'
import { IOSDevice } from '../device/ios-device.js'
import { normalizeStatusBar } from '../screenshot/normalize.js'

const mockExeca = vi.mocked(execaCommand)
const mockNormalizeStatusBar = vi.mocked(normalizeStatusBar)

describe('IOSDevice', () => {
  beforeEach(() => {
    mockExeca.mockReset()
    mockNormalizeStatusBar.mockReset()
    mockNormalizeStatusBar.mockResolvedValue(undefined)
    setTestConfig({
      iosBundleId: undefined,
      iosScheme: undefined,
    })
  })

  it('launches using the configured bundle ID when no override is provided', async () => {
    const client = {
      terminateApp: vi.fn().mockResolvedValue(undefined),
      launchApp: vi.fn().mockResolvedValue(undefined),
    } as any

    setTestConfig({ iosBundleId: 'com.example.app' })

    const device = new IOSDevice('SIM-123', 'iPhone 16', client)
    await device.launch()

    expect(client.terminateApp).toHaveBeenCalledWith('com.example.app')
    expect(client.launchApp).toHaveBeenCalledWith('com.example.app')
    expect(getActiveBundleId()).toBe('com.example.app')
    expect(mockNormalizeStatusBar).toHaveBeenCalledWith('SIM-123')
  })

  it('opens a composed deep link after launch when given a path', async () => {
    const client = {
      terminateApp: vi.fn().mockResolvedValue(undefined),
      launchApp: vi.fn().mockResolvedValue(undefined),
    } as any

    setTestConfig({
      iosBundleId: 'com.example.app',
      iosScheme: 'exampleapp',
    })

    const device = new IOSDevice('SIM-123', 'iPhone 16', client)
    await device.launch({ path: '/form' })

    expect(client.launchApp).toHaveBeenCalledWith('com.example.app')
    expect(mockExeca).toHaveBeenCalledWith('xcrun simctl openurl SIM-123 exampleapp:///form')
    expect(mockNormalizeStatusBar).toHaveBeenCalledWith('SIM-123')
  })

  it('uses the shell fallback when no driver client is attached', async () => {
    setTestConfig({ iosBundleId: 'com.example.app' })

    const device = new IOSDevice('SIM-123', 'iPhone 16')
    await device.launch()

    expect(mockExeca).toHaveBeenCalledWith('xcrun simctl launch SIM-123 com.example.app')
    expect(mockNormalizeStatusBar).toHaveBeenCalledWith('SIM-123')
  })

  it('uses structured openUrl overrides', async () => {
    setTestConfig({ iosScheme: 'exampleapp' })

    const device = new IOSDevice('SIM-123', 'iPhone 16')
    await device.openUrl({ path: '/form' })

    expect(mockExeca).toHaveBeenCalledWith('xcrun simctl openurl SIM-123 exampleapp:///form')
    expect(mockNormalizeStatusBar).toHaveBeenCalledWith('SIM-123')
  })

  it('prefers an explicit full URL over scheme/path composition', async () => {
    const device = new IOSDevice('SIM-123', 'iPhone 16')
    await device.openUrl('otherapp://form')

    expect(mockExeca).toHaveBeenCalledWith('xcrun simctl openurl SIM-123 otherapp://form')
    expect(mockNormalizeStatusBar).toHaveBeenCalledWith('SIM-123')
  })
})
