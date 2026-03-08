import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'
import { setTestConfig } from '../config-context.js'
import { getActiveBundleId } from '../driver/context.js'
import { AndroidDevice } from '../device/android-device.js'

const mockExeca = vi.mocked(execa)

describe('AndroidDevice', () => {
  beforeEach(() => {
    mockExeca.mockReset()
    setTestConfig({
      androidAppId: undefined,
    })
  })

  it('launches using the configured Android app ID when no override is provided', async () => {
    setTestConfig({ androidAppId: 'com.example.android' })

    mockExeca.mockImplementation(async (_command, args) => {
      if (args.includes('resolve-activity')) {
        return {
          stdout: 'priority=0 preferredOrder=0 match=0x108000\ncom.example.android/.MainActivity',
        } as any
      }

      return { stdout: '' } as any
    })

    const device = new AndroidDevice('emulator-5554', 'Pixel 9 Pro')
    await device.launch()

    expect(mockExeca).toHaveBeenNthCalledWith(
      1,
      'adb',
      ['-s', 'emulator-5554', 'shell', 'am', 'force-stop', 'com.example.android'],
      undefined,
    )
    expect(mockExeca).toHaveBeenNthCalledWith(
      2,
      'adb',
      [
        '-s',
        'emulator-5554',
        'shell',
        'cmd',
        'package',
        'resolve-activity',
        '--brief',
        'com.example.android',
      ],
      undefined,
    )
    expect(mockExeca).toHaveBeenNthCalledWith(
      3,
      'adb',
      [
        '-s',
        'emulator-5554',
        'shell',
        'am',
        'start',
        '-W',
        '-n',
        'com.example.android/.MainActivity',
      ],
      undefined,
    )
    expect(getActiveBundleId()).toBe('com.example.android')
  })

  it('opens Android deep links with the configured app ID', async () => {
    setTestConfig({ androidAppId: 'com.example.android' })
    mockExeca.mockResolvedValue({ stdout: '' } as any)

    const device = new AndroidDevice('emulator-5554', 'Pixel 9 Pro')
    await device.openUrl({ scheme: 'exampleapp', path: '/form' })

    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      [
        '-s',
        'emulator-5554',
        'shell',
        'am',
        'start',
        '-W',
        '-a',
        'android.intent.action.VIEW',
        '-d',
        'exampleapp:///form',
        'com.example.android',
      ],
      undefined,
    )
  })

  it('captures screenshots through adb exec-out when no driver is attached', async () => {
    mockExeca.mockResolvedValue({ stdout: Buffer.from('png-data') } as any)

    const device = new AndroidDevice('emulator-5554', 'Pixel 9 Pro')
    const screenshot = await device.takeScreenshot()

    expect(screenshot).toEqual(Buffer.from('png-data'))
    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      ['-s', 'emulator-5554', 'exec-out', 'screencap', '-p'],
      { encoding: 'buffer' },
    )
  })

  it('sends emulator geo fix commands for location overrides', async () => {
    mockExeca.mockResolvedValue({ stdout: '' } as any)

    const device = new AndroidDevice('emulator-5554', 'Pixel 9 Pro')
    await device.setLocation(51.5074, -0.1278)

    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      ['-s', 'emulator-5554', 'emu', 'geo', 'fix', '-0.1278', '51.5074'],
      undefined,
    )
  })

  it('throws a helpful error when location overrides are requested on a physical device', async () => {
    const device = new AndroidDevice('R58M123456Z', 'Pixel 8')

    await expect(device.setLocation(51.5074, -0.1278)).rejects.toThrow(
      'Android location overrides currently require an emulator serial',
    )
  })
})
