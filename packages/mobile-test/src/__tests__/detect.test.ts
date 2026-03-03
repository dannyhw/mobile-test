import { describe, it, expect, vi } from 'vitest'

// Mock execa before importing detect
vi.mock('execa', () => ({
  execaCommand: vi.fn(),
}))

import { detectBootedSimulators, getDefaultDevice } from '../device/detect.js'
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
