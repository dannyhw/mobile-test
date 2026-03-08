import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DriverClient } from './client.js'

const DEFAULT_PORT = 22087
const ANDROID_DRIVER_APP_ID = 'dev.mobiletest.driver'
const ANDROID_DRIVER_TEST_APP_ID = 'dev.mobiletest.driver.test'
const ANDROID_DRIVER_RUNNER = `${ANDROID_DRIVER_TEST_APP_ID}/androidx.test.runner.AndroidJUnitRunner`
const ANDROID_DRIVER_ENTRYPOINT = 'dev.mobiletest.driver.DriverServerInstrumentation#startServer'

export interface DriverProcess {
  port: number
  client: DriverClient
  stop: () => Promise<void>
}

export interface LaunchDriverOptions {
  udid: string
  port?: number
  platform?: 'ios' | 'android'
}

function getPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

function findIOSDriverArtifacts(): string {
  const distPath = resolve(getPackageRoot(), 'dist', 'ios-driver')

  if (!existsSync(distPath)) {
    throw new Error(
      `iOS driver artifacts not found at ${distPath}.\n` +
      `Run 'cd ios-driver && ./build.sh' to build the driver.`
    )
  }

  const xctestrun = resolve(distPath, 'MobileTestDriver.xctestrun')
  if (!existsSync(xctestrun)) {
    throw new Error(`Missing xctestrun file at ${xctestrun}`)
  }

  return distPath
}

function findAndroidDriverArtifacts(): { appApk: string; testApk: string } {
  const distPath = resolve(getPackageRoot(), 'dist', 'android-driver')
  const appApk = resolve(distPath, 'MobileTestDriver.apk')
  const testApk = resolve(distPath, 'MobileTestDriverTest.apk')

  if (!existsSync(distPath)) {
    throw new Error(
      `Android driver artifacts not found at ${distPath}.\n` +
      `Run 'cd android-driver && ./build.sh' to build the driver.`
    )
  }

  if (!existsSync(appApk)) {
    throw new Error(`Missing Android driver app APK at ${appApk}`)
  }

  if (!existsSync(testApk)) {
    throw new Error(`Missing Android driver test APK at ${testApk}`)
  }

  return { appApk, testApk }
}

function startIOSDriverProcess(
  udid: string,
  artifactsPath: string,
): ReturnType<typeof execa> {
  const xctestrunPath = resolve(artifactsPath, 'MobileTestDriver.xctestrun')

  return execa('xcodebuild', [
    'test-without-building',
    '-xctestrun', xctestrunPath,
    '-destination', `platform=iOS Simulator,id=${udid}`,
  ], {
    reject: false,
  })
}

function startAndroidDriverProcess(
  udid: string,
  port: number,
): ReturnType<typeof execa> {
  return execa('adb', [
    '-s', udid,
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
    ANDROID_DRIVER_ENTRYPOINT,
    '-e',
    'port',
    String(port),
    ANDROID_DRIVER_RUNNER,
  ], {
    reject: false,
  })
}

async function adb(udid: string, args: string[]): Promise<void> {
  await execa('adb', ['-s', udid, ...args])
}

async function installAndroidDriver(udid: string): Promise<void> {
  const artifacts = findAndroidDriverArtifacts()
  await adb(udid, ['install', '-r', artifacts.appApk])
  await adb(udid, ['install', '-r', '-t', artifacts.testApk])
}

async function startAndroidPortForward(udid: string, port: number): Promise<void> {
  await adb(udid, ['forward', `tcp:${port}`, `tcp:${port}`])
}

async function stopAndroidPortForward(udid: string, port: number): Promise<void> {
  try {
    await adb(udid, ['forward', '--remove', `tcp:${port}`])
  } catch {
    // Ignore missing forwarders during cleanup.
  }
}

async function stopAndroidDriverApps(udid: string): Promise<void> {
  for (const appId of [ANDROID_DRIVER_TEST_APP_ID, ANDROID_DRIVER_APP_ID]) {
    try {
      await adb(udid, ['shell', 'am', 'force-stop', appId])
    } catch {
      // Ignore cleanup failures when the process is already gone.
    }
  }
}

async function waitForDriverReady(
  client: DriverClient,
  platform: 'ios' | 'android',
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now()
  const pollInterval = 500

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await client.status()
      if (res.status === 'ready') return
    } catch {
      // Driver not ready yet.
    }
    await new Promise(r => setTimeout(r, pollInterval))
  }

  throw new Error(
    `Driver did not become ready within ${timeoutMs / 1000}s.\n` +
    (
      platform === 'ios'
        ? 'Make sure a simulator is booted and the iOS driver artifacts are built.'
        : 'Make sure the Android device is connected, adb port forwarding succeeded, and the Android driver artifacts are built.'
    ),
  )
}

export async function launchDriver(udid: string, port?: number): Promise<DriverProcess>
export async function launchDriver(options: LaunchDriverOptions): Promise<DriverProcess>
export async function launchDriver(
  udidOrOptions: string | LaunchDriverOptions,
  port = DEFAULT_PORT,
): Promise<DriverProcess> {
  const options = typeof udidOrOptions === 'string'
    ? { udid: udidOrOptions, port, platform: 'ios' as const }
    : {
        udid: udidOrOptions.udid,
        port: udidOrOptions.port ?? DEFAULT_PORT,
        platform: udidOrOptions.platform ?? 'ios',
      }

  const client = new DriverClient(`http://localhost:${options.port}`)

  if (options.platform === 'ios') {
    const artifactsPath = findIOSDriverArtifacts()

    console.log('[mobile-test] Starting iOS driver...')
    const proc = startIOSDriverProcess(options.udid, artifactsPath)

    console.log('[mobile-test] Waiting for iOS driver to be ready...')
    await waitForDriverReady(client, 'ios')
    console.log('[mobile-test] iOS driver is ready.')

    return {
      port: options.port,
      client,
      stop: async () => {
        proc.kill()
        try {
          await proc
        } catch {
          // Expected — process was killed.
        }
      },
    }
  }

  console.log('[mobile-test] Installing Android driver...')
  await installAndroidDriver(options.udid)
  await startAndroidPortForward(options.udid, options.port)

  console.log('[mobile-test] Starting Android driver...')
  const proc = startAndroidDriverProcess(options.udid, options.port)

  try {
    console.log('[mobile-test] Waiting for Android driver to be ready...')
    await waitForDriverReady(client, 'android')
    console.log('[mobile-test] Android driver is ready.')
  } catch (error) {
    proc.kill()
    await stopAndroidDriverApps(options.udid)
    await stopAndroidPortForward(options.udid, options.port)
    throw error
  }

  return {
    port: options.port,
    client,
    stop: async () => {
      proc.kill()
      try {
        await proc
      } catch {
        // Expected — process was killed.
      }
      await stopAndroidDriverApps(options.udid)
      await stopAndroidPortForward(options.udid, options.port)
    },
  }
}
