import { DriverClient, setDriverClient, setDevice, setTestConfig } from 'mobile-test'
import { IOSDevice } from '../device/ios-device.js'
import { registerMatchers } from '../expect/matchers.js'

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
if (actionTimeout) {
  setTestConfig({ actionTimeout: Number(actionTimeout) })
}

const client = new DriverClient(`http://localhost:${port}`)
setDriverClient(client)

const device = new IOSDevice(deviceUdid, deviceName, client)
setDevice(device)

registerMatchers()
