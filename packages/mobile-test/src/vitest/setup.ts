import { getDefaultDevice } from '../device/detect.js'
import { launchDriver, type DriverProcess } from '../driver/installer.js'
import { normalizeStatusBar, resetStatusBar } from '../screenshot/normalize.js'

let driverProcess: DriverProcess | undefined

export async function setup() {
  const sim = await getDefaultDevice()
  console.log(`[mobile-test] Using simulator: ${sim.name} (${sim.udid})`)

  // Normalize status bar for consistent screenshots
  await normalizeStatusBar(sim.udid)

  driverProcess = await launchDriver(sim.udid)

  // Pass connection info and config to test workers via env vars
  process.env.__MOBILE_TEST_PORT = String(driverProcess.port)
  process.env.__MOBILE_TEST_DEVICE_NAME = sim.name
  process.env.__MOBILE_TEST_DEVICE_UDID = sim.udid
  // Config defaults are read by workers; users can override via defineConfig

  return async () => {
    if (driverProcess) {
      console.log('[mobile-test] Stopping driver...')
      await driverProcess.stop()
    }
    await resetStatusBar(sim.udid)
  }
}
