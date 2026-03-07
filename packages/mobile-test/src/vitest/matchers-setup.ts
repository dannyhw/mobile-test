import { DriverClient, setDriverClient, setDevice, setTestConfig } from 'mobile-test'
import { IOSDevice } from '../device/ios-device.js'
import { registerMatchers } from '../expect/matchers.js'
import { setLogLevel, log } from '../logger.js'
import { afterAll } from 'vitest'

// Connect to the driver that globalSetup started
const port = process.env.__MOBILE_TEST_PORT
const deviceName = process.env.__MOBILE_TEST_DEVICE_NAME
const deviceUdid = process.env.__MOBILE_TEST_DEVICE_UDID

if (!port || !deviceName || !deviceUdid) {
  throw new Error(
    'mobile-test: Missing environment variables from globalSetup.\n' +
    'Make sure the mobile-test vitest plugin is configured correctly.'
  )
}

// Apply config overrides if passed from globalSetup
const actionTimeout = process.env.__MOBILE_TEST_ACTION_TIMEOUT
const logLevel = process.env.__MOBILE_TEST_LOG_LEVEL as 'silent' | 'info' | 'debug' | undefined
const screenshotsDir = process.env.__MOBILE_TEST_SCREENSHOTS_DIR
const iosBundleId = process.env.__MOBILE_TEST_IOS_BUNDLE_ID
const iosScheme = process.env.__MOBILE_TEST_IOS_SCHEME
if (actionTimeout || logLevel || screenshotsDir || iosBundleId || iosScheme) {
  setTestConfig({
    ...(actionTimeout ? { actionTimeout: Number(actionTimeout) } : {}),
    ...(logLevel ? { logLevel } : {}),
    ...(screenshotsDir ? { screenshotsDir } : {}),
    ...(iosBundleId ? { iosBundleId } : {}),
    ...(iosScheme ? { iosScheme } : {}),
  })
}
if (logLevel) {
  setLogLevel(logLevel)
}

afterAll(() => {
  log.printTimingSummary()
})

const client = new DriverClient(`http://localhost:${port}`)
setDriverClient(client)

const device = new IOSDevice(deviceUdid, deviceName, client)
setDevice(device)

registerMatchers()
