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
const ANDROID_DRIVER_LOGCAT_PATTERN = /MobileTestDriver|AndroidJUnitRunner|dev\.mobiletest\.driver|NanoHTTPD|FATAL EXCEPTION|Crash of app/
const MAX_DIAGNOSTIC_LINES = 40

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

interface ProcessOutputSummary {
  exitCode: number | undefined
  recentOutput: string
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

async function adbStdout(udid: string, args: string[]): Promise<string> {
  const { stdout } = await execa('adb', ['-s', udid, ...args])
  return String(stdout)
}

function summarizeLines(text: string, maxLines = MAX_DIAGNOSTIC_LINES): string {
  return text
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean)
    .slice(-maxLines)
    .join('\n')
}

function createProcessOutputMonitor(proc: ReturnType<typeof execa>) {
  const recentLines: string[] = []

  const pushChunk = (source: 'stdout' | 'stderr', chunk: unknown) => {
    const text = String(chunk)
    for (const line of text.split(/\r?\n/)) {
      const trimmedLine = line.trimEnd()
      if (!trimmedLine) continue
      recentLines.push(`[${source}] ${trimmedLine}`)
      if (recentLines.length > MAX_DIAGNOSTIC_LINES) {
        recentLines.shift()
      }
      console.log(`[mobile-test] [android-driver:${source}] ${trimmedLine}`)
    }
  }

  proc.stdout?.on('data', chunk => pushChunk('stdout', chunk))
  proc.stderr?.on('data', chunk => pushChunk('stderr', chunk))

  return {
    async getSummary(): Promise<ProcessOutputSummary> {
      const result = await proc
      const fallbackOutput = [
        result.stdout ? summarizeLines(String(result.stdout)) : '',
        result.stderr ? summarizeLines(String(result.stderr)) : '',
      ].filter(Boolean).join('\n')

      return {
        exitCode: result.exitCode,
        recentOutput: recentLines.join('\n') || fallbackOutput,
      }
    },
  }
}

async function installAndroidDriver(
  udid: string,
  artifacts = findAndroidDriverArtifacts(),
): Promise<void> {
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

function extractActiveInstrumentationPackages(dumpsysActivity: string): string[] {
  const packages = new Set<string>()
  const instrumentationPattern = /ActiveInstrumentation\{[^{}]*\{([^/\s}]+)\//g

  for (const match of dumpsysActivity.matchAll(instrumentationPattern)) {
    packages.add(match[1])
  }

  return [...packages]
}

function hasActiveUiAutomationSession(dumpsysAccessibility: string): boolean {
  return dumpsysAccessibility.includes('Ui Automation[')
}

async function stopInstrumentationPackages(udid: string, packageNames: string[]): Promise<void> {
  const packagesToStop = new Set<string>()

  for (const packageName of packageNames) {
    packagesToStop.add(packageName)
    if (packageName.endsWith('.test')) {
      packagesToStop.add(packageName.slice(0, -'.test'.length))
    }
  }

  for (const packageName of packagesToStop) {
    try {
      await adb(udid, ['shell', 'am', 'force-stop', packageName])
    } catch {
      // Ignore packages that are already stopped or no longer installed.
    }
  }
}

async function waitForUiAutomationToClear(udid: string, timeoutMs = 10_000): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const accessibilityDump = await adbStdout(udid, ['shell', 'dumpsys', 'accessibility'])
    if (!hasActiveUiAutomationSession(accessibilityDump)) {
      return
    }

    await new Promise(r => setTimeout(r, 250))
  }

  throw new Error(
    'Android UiAutomation remained busy after stopping conflicting instrumentation.\n' +
    'Close other Android automation sessions on this device and try again.',
  )
}

async function prepareAndroidAutomation(udid: string): Promise<void> {
  const activityDump = await adbStdout(udid, ['shell', 'dumpsys', 'activity'])
  const activeInstrumentationPackages = extractActiveInstrumentationPackages(activityDump)
  const conflictingInstrumentationPackages = activeInstrumentationPackages.filter(
    packageName => packageName !== ANDROID_DRIVER_APP_ID && packageName !== ANDROID_DRIVER_TEST_APP_ID,
  )

  if (conflictingInstrumentationPackages.length > 0) {
    console.log(
      `[mobile-test] Stopping conflicting Android instrumentation: ${conflictingInstrumentationPackages.join(', ')}`,
    )
    await stopInstrumentationPackages(udid, conflictingInstrumentationPackages)
  }

  const accessibilityDump = await adbStdout(udid, ['shell', 'dumpsys', 'accessibility'])
  if (conflictingInstrumentationPackages.length > 0 || hasActiveUiAutomationSession(accessibilityDump)) {
    console.log('[mobile-test] Waiting for Android UiAutomation to become available...')
    await waitForUiAutomationToClear(udid)
  }
}

async function readAndroidDriverLogcat(udid: string): Promise<string> {
  try {
    const { stdout } = await execa('adb', ['-s', udid, 'logcat', '-d', '-v', 'brief'])
    return stdout
      .split(/\r?\n/)
      .filter(line => ANDROID_DRIVER_LOGCAT_PATTERN.test(line))
      .slice(-MAX_DIAGNOSTIC_LINES)
      .join('\n')
  } catch (error) {
    return `Failed to read Android logcat: ${error instanceof Error ? error.message : String(error)}`
  }
}

async function formatAndroidDriverStartupError(
  udid: string,
  reason: string,
  processSummary?: ProcessOutputSummary,
): Promise<Error> {
  const parts = [reason]

  if (processSummary) {
    parts.push(`Instrumentation exit code: ${processSummary.exitCode ?? 'unknown'}`)
    if (processSummary.recentOutput) {
      parts.push(`Recent instrumentation output:\n${processSummary.recentOutput}`)
    }
  }

  const logcat = await readAndroidDriverLogcat(udid)
  if (logcat) {
    parts.push(`Recent Android logcat:\n${logcat}`)
  }

  return new Error(parts.join('\n\n'))
}

async function waitForDriverReady(
  client: DriverClient,
  platform: 'ios' | 'android',
  timeoutMs = 120_000,
  signal?: AbortSignal,
): Promise<void> {
  const start = Date.now()
  const pollInterval = 500
  let lastProgressLogAt = start

  while (!signal?.aborted && Date.now() - start < timeoutMs) {
    try {
      const res = await client.status()
      if (res.status === 'ready') return
    } catch {
      // Driver not ready yet.
    }

    if (signal?.aborted) {
      return
    }

    if (Date.now() - lastProgressLogAt >= 5_000) {
      console.log(
        `[mobile-test] Still waiting for ${platform} driver... (${Math.floor((Date.now() - start) / 1000)}s)`,
      )
      lastProgressLogAt = Date.now()
    }
    await new Promise(r => setTimeout(r, pollInterval))
  }

  if (signal?.aborted) {
    return
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

  const androidArtifacts = findAndroidDriverArtifacts()

  console.log('[mobile-test] Installing Android driver...')
  await prepareAndroidAutomation(options.udid)
  await installAndroidDriver(options.udid, androidArtifacts)
  await startAndroidPortForward(options.udid, options.port)

  console.log('[mobile-test] Starting Android driver...')
  const proc = startAndroidDriverProcess(options.udid, options.port)
  const processMonitor = createProcessOutputMonitor(proc)
  const readinessAbortController = new AbortController()

  try {
    console.log('[mobile-test] Waiting for Android driver to be ready...')
    const winner = await Promise.race([
      waitForDriverReady(
        client,
        'android',
        120_000,
        readinessAbortController.signal,
      ).then(() => ({ type: 'ready' as const })),
      processMonitor.getSummary().then(summary => ({ type: 'exited' as const, summary })),
    ])
    readinessAbortController.abort()

    if (winner.type !== 'ready') {
      throw await formatAndroidDriverStartupError(
        options.udid,
        'Android driver process exited before it became ready.',
        winner.summary,
      )
    }
    console.log('[mobile-test] Android driver is ready.')
  } catch (error) {
    proc.kill()
    await stopAndroidDriverApps(options.udid)
    await stopAndroidPortForward(options.udid, options.port)
    if (error instanceof Error && error.message.includes('Driver did not become ready within')) {
      throw await formatAndroidDriverStartupError(
        options.udid,
        error.message,
      )
    }
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
