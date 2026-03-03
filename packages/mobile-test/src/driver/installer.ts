import { execa, type ResultPromise } from 'execa'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DriverClient } from './client.js'

const DEFAULT_PORT = 22087

export interface DriverProcess {
  port: number
  client: DriverClient
  stop: () => Promise<void>
}

/**
 * Find the pre-built iOS driver artifacts.
 * Looks in dist/ios-driver/ relative to the package root.
 */
function findDriverArtifacts(): string {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const distPath = resolve(packageRoot, 'dist', 'ios-driver')

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

/**
 * Start the XCTest runner on the simulator via xcodebuild.
 * xcodebuild handles installing the apps and running the test bundle.
 */
function startDriverProcess(
  udid: string,
  artifactsPath: string,
): ResultPromise {
  const xctestrunPath = resolve(artifactsPath, 'MobileTestDriver.xctestrun')

  return execa('xcodebuild', [
    'test-without-building',
    '-xctestrun', xctestrunPath,
    '-destination', `platform=iOS Simulator,id=${udid}`,
  ], {
    reject: false,
  })
}

/**
 * Poll the driver's /status endpoint until it's ready.
 */
async function waitForDriverReady(
  client: DriverClient,
  timeoutMs = 120_000
): Promise<void> {
  const start = Date.now()
  const pollInterval = 500

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await client.status()
      if (res.status === 'ready') return
    } catch {
      // Driver not ready yet
    }
    await new Promise(r => setTimeout(r, pollInterval))
  }

  throw new Error(
    `Driver did not become ready within ${timeoutMs / 1000}s.\n` +
    `Make sure a simulator is booted and the driver artifacts are built.`
  )
}

/**
 * Install and start the iOS driver on a simulator.
 */
export async function launchDriver(
  udid: string,
  port = DEFAULT_PORT
): Promise<DriverProcess> {
  const artifactsPath = findDriverArtifacts()

  console.log('[mobile-test] Starting driver...')
  const proc = startDriverProcess(udid, artifactsPath)

  const client = new DriverClient(`http://localhost:${port}`)

  console.log('[mobile-test] Waiting for driver to be ready...')
  await waitForDriverReady(client)
  console.log('[mobile-test] Driver is ready.')

  return {
    port,
    client,
    stop: async () => {
      proc.kill()
      try {
        await proc
      } catch {
        // Expected — process was killed
      }
    },
  }
}
