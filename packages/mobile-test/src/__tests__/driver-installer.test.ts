import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { launchDriver } from '../driver/installer.js'

const mockExeca = vi.mocked(execa)
const mockExistsSync = vi.mocked(existsSync)

describe('launchDriver', () => {
  beforeEach(() => {
    mockExeca.mockReset()
    mockExistsSync.mockReset()
    mockExistsSync.mockReturnValue(true)

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.endsWith('/status')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ status: 'ready' }),
          text: async () => '',
          arrayBuffer: async () => new ArrayBuffer(0),
        } as Response
      }

      throw new Error(`Unexpected fetch for ${url}`)
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves the iOS launchDriver(udid) path', async () => {
    const proc = createBackgroundProcess()
    mockExeca.mockReturnValue(proc as any)

    const driver = await launchDriver('SIM-123')

    expect(mockExeca).toHaveBeenCalledWith(
      'xcodebuild',
      [
        'test-without-building',
        '-xctestrun',
        expect.stringMatching(/dist\/ios-driver\/MobileTestDriver\.xctestrun$/),
        '-destination',
        'platform=iOS Simulator,id=SIM-123',
      ],
      { reject: false },
    )
    expect(driver.port).toBe(22087)

    await driver.stop()
    expect(proc.kill).toHaveBeenCalled()
  })

  it('installs, forwards, launches, and cleans up the Android driver', async () => {
    const proc = createBackgroundProcess()
    mockExeca.mockImplementation((command, args) => {
      if (
        command === 'adb' &&
        Array.isArray(args) &&
        args.includes('shell') &&
        args.includes('instrument')
      ) {
        return proc as any
      }

      return Promise.resolve({ stdout: '' }) as any
    })

    const driver = await launchDriver({
      platform: 'android',
      udid: 'emulator-5554',
    })

    expect(mockExeca).toHaveBeenNthCalledWith(
      1,
      'adb',
      [
        '-s',
        'emulator-5554',
        'install',
        '-r',
        expect.stringMatching(/dist\/android-driver\/MobileTestDriver\.apk$/),
      ],
    )
    expect(mockExeca).toHaveBeenNthCalledWith(
      2,
      'adb',
      [
        '-s',
        'emulator-5554',
        'install',
        '-r',
        '-t',
        expect.stringMatching(/dist\/android-driver\/MobileTestDriverTest\.apk$/),
      ],
    )
    expect(mockExeca).toHaveBeenNthCalledWith(
      3,
      'adb',
      ['-s', 'emulator-5554', 'forward', 'tcp:22087', 'tcp:22087'],
    )
    expect(mockExeca).toHaveBeenNthCalledWith(
      4,
      'adb',
      [
        '-s',
        'emulator-5554',
        'shell',
        'am',
        'instrument',
        '-w',
        '-r',
        '-e',
        'debug',
        'false',
        '-e',
        'class',
        'dev.mobiletest.driver.DriverServerInstrumentation#startServer',
        '-e',
        'port',
        '22087',
        'dev.mobiletest.driver.test/androidx.test.runner.AndroidJUnitRunner',
      ],
      { reject: false },
    )
    expect(driver.port).toBe(22087)

    await driver.stop()

    expect(proc.kill).toHaveBeenCalled()
    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      ['-s', 'emulator-5554', 'shell', 'am', 'force-stop', 'dev.mobiletest.driver.test'],
    )
    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      ['-s', 'emulator-5554', 'shell', 'am', 'force-stop', 'dev.mobiletest.driver'],
    )
    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      ['-s', 'emulator-5554', 'forward', '--remove', 'tcp:22087'],
    )
  })

  it('throws a helpful error when Android driver artifacts are missing', async () => {
    mockExistsSync.mockImplementation((path) => !String(path).includes('/dist/android-driver'))

    await expect(launchDriver({
      platform: 'android',
      udid: 'emulator-5554',
    })).rejects.toThrow(`Run 'cd android-driver && ./build.sh'`)
  })
})

function createBackgroundProcess() {
  const proc: any = Promise.resolve({ exitCode: 0 })
  proc.kill = vi.fn()
  return proc
}
