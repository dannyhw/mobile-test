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
        args.join(' ') === '-s emulator-5554 shell dumpsys activity'
      ) {
        return Promise.resolve({ stdout: '' }) as any
      }

      if (
        command === 'adb' &&
        Array.isArray(args) &&
        args.join(' ') === '-s emulator-5554 shell dumpsys accessibility'
      ) {
        return Promise.resolve({ stdout: '' }) as any
      }

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

    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      ['-s', 'emulator-5554', 'shell', 'dumpsys', 'activity'],
    )
    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      ['-s', 'emulator-5554', 'shell', 'dumpsys', 'accessibility'],
    )
    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      [
        '-s',
        'emulator-5554',
        'install',
        '-r',
        expect.stringMatching(/dist\/android-driver\/MobileTestDriver\.apk$/),
      ],
    )
    expect(mockExeca).toHaveBeenCalledWith(
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
    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      ['-s', 'emulator-5554', 'forward', 'tcp:22087', 'tcp:22087'],
    )
    expect(mockExeca).toHaveBeenCalledWith(
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

  it('stops conflicting Android instrumentation before launching the driver', async () => {
    const proc = createBackgroundProcess()
    let accessibilityReads = 0

    mockExeca.mockImplementation((command, args) => {
      if (
        command === 'adb' &&
        Array.isArray(args) &&
        args.join(' ') === '-s emulator-5554 shell dumpsys activity'
      ) {
        return Promise.resolve({
          stdout: 'Active instrumentation:\n' +
            '  Instrumentation #0: ActiveInstrumentation{b68999 {dev.mobile.maestro.test/androidx.test.runner.AndroidJUnitRunner} 1 procs}\n',
        }) as any
      }

      if (
        command === 'adb' &&
        Array.isArray(args) &&
        args.join(' ') === '-s emulator-5554 shell dumpsys accessibility'
      ) {
        accessibilityReads += 1
        return Promise.resolve({
          stdout: accessibilityReads === 1 ? 'Ui Automation[eventTypes=TYPES_ALL_MASK]' : '',
        }) as any
      }

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

    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      ['-s', 'emulator-5554', 'shell', 'am', 'force-stop', 'dev.mobile.maestro.test'],
    )
    expect(mockExeca).toHaveBeenCalledWith(
      'adb',
      ['-s', 'emulator-5554', 'shell', 'am', 'force-stop', 'dev.mobile.maestro'],
    )

    await driver.stop()
  })

  it('surfaces Android instrumentation crashes with process output and logcat', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:22087')
    }))

    const proc = createExitedProcess({
      exitCode: 1,
      stdout: 'INSTRUMENTATION_STATUS: class=dev.mobiletest.driver.DriverServerInstrumentation',
      stderr: 'FATAL EXCEPTION: Instr: androidx.test.runner.AndroidJUnitRunner',
    })

    mockExeca.mockImplementation((command, args) => {
      if (
        command === 'adb' &&
        Array.isArray(args) &&
        args.join(' ') === '-s emulator-5554 shell dumpsys activity'
      ) {
        return Promise.resolve({ stdout: '' }) as any
      }

      if (
        command === 'adb' &&
        Array.isArray(args) &&
        args.join(' ') === '-s emulator-5554 shell dumpsys accessibility'
      ) {
        return Promise.resolve({ stdout: '' }) as any
      }

      if (
        command === 'adb' &&
        Array.isArray(args) &&
        args.join(' ') === '-s emulator-5554 logcat -d -v brief'
      ) {
        return Promise.resolve({
          stdout: [
            'I/TestRunner(13173): started: startServer(dev.mobiletest.driver.DriverServerInstrumentation)',
            'E/TestRunner(13173): failed: startServer(dev.mobiletest.driver.DriverServerInstrumentation)',
          ].join('\n'),
        }) as any
      }

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

    await expect(launchDriver({
      platform: 'android',
      udid: 'emulator-5554',
    })).rejects.toThrow(
      /Android driver process exited before it became ready\.[\s\S]*FATAL EXCEPTION[\s\S]*Recent Android logcat:/,
    )
  })
})

function createBackgroundProcess() {
  let resolveProcess: ((value: { exitCode: number; stdout: string; stderr: string }) => void) | undefined
  const proc: any = new Promise(resolve => {
    resolveProcess = resolve
  })
  proc.kill = vi.fn(() => {
    resolveProcess?.({ exitCode: 0, stdout: '', stderr: '' })
  })
  return proc
}

function createExitedProcess(result: { exitCode: number; stdout: string; stderr: string }) {
  const proc: any = Promise.resolve(result)
  proc.kill = vi.fn()
  return proc
}
