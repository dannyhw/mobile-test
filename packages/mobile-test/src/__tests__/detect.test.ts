import { describe, it, expect, vi } from 'vitest'

// Mock execa before importing detect
vi.mock('execa', () => ({
  execaCommand: vi.fn(),
}))

import {
  detectBootedSimulators,
  detectConnectedAndroidDevices,
  getAndroidDevice,
  getDefaultAndroidDevice,
  getDefaultDevice,
  getIOSDevice,
} from '../device/detect.js'
import { execaCommand } from 'execa'

const mockExeca = vi.mocked(execaCommand)

const simctlOutput = {
  devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-18-2': [
      {
        udid: 'ABC-123',
        name: 'iPhone 16',
        state: 'Booted',
        isAvailable: true,
      },
      {
        udid: 'DEF-456',
        name: 'iPhone 15',
        state: 'Shutdown',
        isAvailable: true,
      },
    ],
    'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
      {
        udid: 'GHI-789',
        name: 'iPhone 14',
        state: 'Booted',
        isAvailable: true,
      },
    ],
  },
}

describe('detectBootedSimulators', () => {
  it('returns only booted simulators', async () => {
    mockExeca.mockResolvedValue({ stdout: JSON.stringify(simctlOutput) } as any)

    const result = await detectBootedSimulators()

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      udid: 'ABC-123',
      name: 'iPhone 16',
      state: 'Booted',
      runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-18-2',
    })
    expect(result[1]).toEqual({
      udid: 'GHI-789',
      name: 'iPhone 14',
      state: 'Booted',
      runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0',
    })
  })

  it('returns empty array when no simulators are booted', async () => {
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ devices: { 'runtime': [{ udid: 'x', name: 'y', state: 'Shutdown', isAvailable: true }] } }),
    } as any)

    const result = await detectBootedSimulators()
    expect(result).toHaveLength(0)
  })
})

describe('getDefaultDevice', () => {
  it('returns the first booted simulator', async () => {
    mockExeca.mockResolvedValue({ stdout: JSON.stringify(simctlOutput) } as any)

    const device = await getDefaultDevice()
    expect(device.udid).toBe('ABC-123')
    expect(device.name).toBe('iPhone 16')
  })

  it('throws with helpful message when none are booted', async () => {
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ devices: {} }),
    } as any)

    await expect(getDefaultDevice()).rejects.toThrow('No booted iOS simulators found')
    await expect(getDefaultDevice()).rejects.toThrow('xcrun simctl boot')
  })
})

describe('getIOSDevice', () => {
  it('selects a named simulator when one matches', async () => {
    mockExeca.mockResolvedValue({ stdout: JSON.stringify(simctlOutput) } as any)

    const device = await getIOSDevice('iPhone 14')
    expect(device.udid).toBe('GHI-789')
  })
})

describe('detectConnectedAndroidDevices', () => {
  it('returns only connected Android devices in the ready state', async () => {
    mockExeca.mockResolvedValue({
      stdout: [
        'List of devices attached',
        'emulator-5554 device product:sdk_gphone64_arm64 model:Pixel_9_Pro device:emu64a transport_id:1',
        'R58M123456Z unauthorized usb:337641472X transport_id:2',
        '192.168.0.8:5555 device product:panther model:Pixel_8 device:panther transport_id:3',
      ].join('\n'),
    } as any)

    const result = await detectConnectedAndroidDevices()

    expect(result).toEqual([
      {
        udid: 'emulator-5554',
        name: 'Pixel 9 Pro',
        state: 'device',
        isEmulator: true,
        model: 'Pixel 9 Pro',
      },
      {
        udid: '192.168.0.8:5555',
        name: 'Pixel 8',
        state: 'device',
        isEmulator: false,
        model: 'Pixel 8',
      },
    ])
  })

  it('returns an empty array when no Android devices are connected', async () => {
    mockExeca.mockResolvedValue({
      stdout: 'List of devices attached\n\n',
    } as any)

    await expect(detectConnectedAndroidDevices()).resolves.toEqual([])
  })
})

describe('getDefaultAndroidDevice', () => {
  it('returns the first connected Android device', async () => {
    mockExeca.mockResolvedValue({
      stdout: [
        'List of devices attached',
        'emulator-5554 device product:sdk_gphone64_arm64 model:Pixel_9_Pro device:emu64a transport_id:1',
      ].join('\n'),
    } as any)

    const device = await getDefaultAndroidDevice()
    expect(device.udid).toBe('emulator-5554')
    expect(device.name).toBe('Pixel 9 Pro')
  })

  it('throws with a helpful message when no Android devices are available', async () => {
    mockExeca.mockResolvedValue({
      stdout: 'List of devices attached\n\n',
    } as any)

    await expect(getDefaultAndroidDevice()).rejects.toThrow('No connected Android devices found')
    await expect(getDefaultDevice('android')).rejects.toThrow('adb devices')
  })
})

describe('getAndroidDevice', () => {
  it('matches Android devices by partial display name', async () => {
    mockExeca.mockResolvedValue({
      stdout: [
        'List of devices attached',
        'emulator-5554 device product:sdk_gphone64_arm64 model:Pixel_9_Pro device:emu64a transport_id:1',
      ].join('\n'),
    } as any)

    const device = await getAndroidDevice('Pixel 9')
    expect(device.udid).toBe('emulator-5554')
  })

  it('throws a helpful error when a named Android device is missing', async () => {
    mockExeca.mockResolvedValue({
      stdout: [
        'List of devices attached',
        'emulator-5554 device product:sdk_gphone64_arm64 model:Pixel_9_Pro device:emu64a transport_id:1',
      ].join('\n'),
    } as any)

    await expect(getAndroidDevice('Pixel 8')).rejects.toThrow(
      'No connected Android device matched "Pixel 8".',
    )
  })
})
