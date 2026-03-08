import { getDefaultDevice } from '../device/detect.js'
import { launchDriver, type DriverProcess } from '../driver/installer.js'
import { normalizeStatusBar, resetStatusBar } from '../screenshot/normalize.js'

let driverProcess: DriverProcess | undefined

export async function setup() {
  const platform = resolveRuntimePlatform()
  const device = await getDefaultDevice(platform)
  console.log(`[mobile-test] Using ${platform === 'ios' ? 'simulator' : 'device'}: ${device.name} (${device.udid})`)

  if (platform === 'ios') {
    await normalizeStatusBar(device.udid)
  }

  driverProcess = await launchDriver({
    platform,
    udid: device.udid,
  })

  // Pass connection info and config to test workers via env vars
  process.env.__MOBILE_TEST_PORT = String(driverProcess.port)
  process.env.__MOBILE_TEST_DEVICE_NAME = device.name
  process.env.__MOBILE_TEST_DEVICE_UDID = device.udid
  process.env.__MOBILE_TEST_PLATFORM = platform
  // Config defaults are read by workers; users can override via defineConfig

  return async () => {
    if (driverProcess) {
      console.log('[mobile-test] Stopping driver...')
      await driverProcess.stop()
    }
    if (platform === 'ios') {
      await resetStatusBar(device.udid)
    }
  }
}

function resolveRuntimePlatform(): 'ios' | 'android' {
  const platform = process.env.__MOBILE_TEST_PLATFORM ?? process.env.MOBILE_TEST_PLATFORM ?? 'ios'

  if (platform === 'ios' || platform === 'android') {
    return platform
  }

  throw new Error(
    `mobile-test: Unsupported MOBILE_TEST_PLATFORM value "${platform}". Expected "ios" or "android".`,
  )
}
