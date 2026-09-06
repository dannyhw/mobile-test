import { afterAll, inject } from 'vitest'
import { setBackend } from '../backend/context.js'
import { AgentDeviceBackend } from '../backend/agent-device.js'
import { BackendDevice } from '../device/backend-device.js'
import { setDevice } from '../device/index.js'
import { setTestConfig } from '../config-context.js'
import { registerMatchers } from '../expect/matchers.js'
import { setLogLevel, log } from '../logger.js'

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

const { session, deviceName, deviceUdid, platform } = runtime

const backend = new AgentDeviceBackend({
  session,
  platform,
  device: { name: deviceName, id: deviceUdid, platform },
})

setBackend(backend)
setDevice(new BackendDevice(backend))

registerMatchers()
