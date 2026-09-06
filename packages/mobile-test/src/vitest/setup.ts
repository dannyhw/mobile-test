import type { TestProject } from 'vitest/node'
import { normalizeStatusBar, resetStatusBar } from '../screenshot/normalize.js'
import { AgentDeviceBackend, listAgentDevices, type AgentDeviceListedDevice } from '../backend/agent-device.js'
import { resolveProjectTarget, type MobileTestRuntimeContext } from './context.js'

/**
 * Vitest globalSetup: pick a device, open an agent-device session for this
 * project and share the session name with the workers.
 */
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

  const device = await pickDevice(platform, selectedProject?.device)
  const session = `mobile-test:${project.name || 'default'}:${process.pid}`
  console.log(`[mobile-test] Using ${device.kind}: ${device.name} (${device.id}) via agent-device session "${session}"`)

  const backend = new AgentDeviceBackend({
    session,
    platform,
    device: { name: device.name, id: device.id, platform },
  })

  if (platform === 'ios') {
    await normalizeStatusBar(device.id)
  }

  // Warm the runner (and claim the device) now so the first test does not pay for it.
  const appId = platform === 'ios' ? providedConfig.iosBundleId : providedConfig.androidAppId
  if (appId) {
    console.log(`[mobile-test] Opening ${appId} to warm the agent-device runner...`)
    await backend.launchApp(appId, { relaunch: true })
  }

  const runtime: MobileTestRuntimeContext = {
    session,
    deviceName: device.name,
    deviceUdid: device.id,
    platform,
  }
  project.provide('__mobileTestRuntime', runtime)

  return async () => {
    console.log('[mobile-test] Closing agent-device session...')
    await backend.close()
    if (platform === 'ios') {
      await resetStatusBar(device.id)
    }
  }
}

async function pickDevice(platform: 'ios' | 'android', requested?: string): Promise<AgentDeviceListedDevice> {
  const devices = await listAgentDevices(platform)
  const candidates = devices.filter(d => d.kind !== 'device')
  const label = platform === 'ios' ? 'simulator' : 'emulator'

  if (requested) {
    const match = candidates.find(d => d.name === requested || d.id === requested)
    if (!match) {
      throw new Error(
        `mobile-test: No ${label} named "${requested}" found.\n` +
        `Available: ${candidates.map(d => `${d.name} (${d.id})${d.booted ? ' [booted]' : ''}`).join(', ') || 'none'}`
      )
    }
    if (!match.booted) {
      throw new Error(
        `mobile-test: ${label} "${requested}" is not booted. Boot it first (agent-device boot --device "${requested}").`
      )
    }
    return match
  }

  const booted = candidates.filter(d => d.booted)
  if (booted.length === 0) {
    throw new Error(
      `mobile-test: No booted ${label} found. Boot one first` +
      (candidates.length ? ` (e.g. ${candidates.map(d => d.name).slice(0, 3).join(', ')}).` : '.')
    )
  }
  return booted[0]
}
