import type { TestProject } from 'vitest/node'
import { getDevice } from '../device/detect.js'
import { launchDriver, type DriverProcess } from '../driver/installer.js'
import { normalizeStatusBar, resetStatusBar } from '../screenshot/normalize.js'
import { resolveProjectTarget } from './context.js'

let driverProcess: DriverProcess | undefined

export async function setup(project: TestProject) {
  const providedConfig = project.config.provide?.__mobileTestConfig
  if (!providedConfig) {
    throw new Error(
      'mobile-test: Missing config context from Vitest globalSetup.\n' +
      'Make sure the mobile-test vitest plugin is configured correctly.'
    )
  }
  const selectedProject = resolveProjectTarget(providedConfig, project.name)
  const platform = selectedProject?.platform ?? 'ios'
  const device =
    platform === 'ios'
      ? await getDevice('ios', selectedProject?.device)
      : await getDevice('android', selectedProject?.device)
  console.log(`[mobile-test] Using ${platform === 'ios' ? 'simulator' : 'device'}: ${device.name} (${device.udid})`)

  if (platform === 'ios') {
    await normalizeStatusBar(device.udid)
  }

  driverProcess = await launchDriver({
    platform,
    udid: device.udid,
  })

  project.provide('__mobileTestRuntime', {
    port: driverProcess.port,
    deviceName: device.name,
    deviceUdid: device.udid,
    platform,
  })

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
