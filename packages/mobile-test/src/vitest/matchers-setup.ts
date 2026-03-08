import { DriverClient, setDriverClient, setDevice, setTestConfig } from 'mobile-test'
import { AndroidDevice } from '../device/android-device.js'
import { IOSDevice } from '../device/ios-device.js'
import { registerMatchers } from '../expect/matchers.js'
import { setLogLevel, log } from '../logger.js'
import { afterAll, inject } from 'vitest'

const runtime = inject('__mobileTestRuntime')
const config = inject('__mobileTestConfig')

if (!runtime) {
  throw new Error(
    'mobile-test: Missing runtime context from globalSetup.\n' +
    'Make sure the mobile-test vitest plugin is configured correctly.'
  )
}

if (!config) {
  throw new Error(
    'mobile-test: Missing config context from Vitest provide.\n' +
    'Make sure the mobile-test vitest plugin is configured correctly.'
  )
}

const { actionTimeout, logLevel, screenshotsDir, iosBundleId, iosScheme, androidAppId, androidScheme } = config

if (actionTimeout || logLevel || screenshotsDir || iosBundleId || iosScheme || androidAppId || androidScheme) {
  setTestConfig({
    ...(actionTimeout ? { actionTimeout } : {}),
    ...(logLevel ? { logLevel } : {}),
    ...(screenshotsDir ? { screenshotsDir } : {}),
    ...(iosBundleId ? { iosBundleId } : {}),
    ...(iosScheme ? { iosScheme } : {}),
    ...(androidAppId ? { androidAppId } : {}),
    ...(androidScheme ? { androidScheme } : {}),
  })
}
if (logLevel) {
  setLogLevel(logLevel)
}

afterAll(() => {
  log.printTimingSummary()
})

const { port, deviceName, deviceUdid, platform } = runtime
const client = new DriverClient(`http://localhost:${port}`)
setDriverClient(client)

const device = platform === 'android'
  ? new AndroidDevice(deviceUdid, deviceName, client)
  : new IOSDevice(deviceUdid, deviceName, client)
setDevice(device)

registerMatchers()
