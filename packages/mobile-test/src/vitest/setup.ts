import type { TestProject } from 'vitest/node'
import { normalizeStatusBar, resetStatusBar } from '../screenshot/normalize.js'
import {
  AgentDeviceBackend,
  closeAgentSession,
  listAgentDevices,
  listAgentSessions,
  type AgentDeviceListedDevice,
} from '../backend/agent-device.js'
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
  const session = `${SESSION_PREFIX}${project.name || 'default'}:${process.pid}`
  console.log(`[mobile-test] Using ${device.kind}: ${device.name} (${device.id}) via agent-device session "${session}"`)

  // A previous run that crashed (or was killed) may still hold a session that
  // claims the device. Sessions we created are recognisable by their prefix.
  await closeStaleSessions()

  const backend = new AgentDeviceBackend({
    session,
    platform,
    device: { name: device.name, id: device.id, platform },
    iosPixelDensity: providedConfig.screenshotPixelDensity,
  })

  let closed = false
  const close = async () => {
    if (closed) return
    closed = true
    console.log('[mobile-test] Closing agent-device session...')
    await backend.close()
    if (platform === 'ios') {
      await resetStatusBar(device.id)
    }
  }
  const onSignal = () => {
    close().finally(() => process.exit(130))
  }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)

  if (platform === 'ios') {
    await normalizeStatusBar(device.id)
  }

  // Warm the runner (and claim the device) now so the first test does not pay for it.
  const appId = platform === 'ios' ? providedConfig.iosBundleId : providedConfig.androidAppId
  if (appId) {
    console.log(`[mobile-test] Opening ${appId} to warm the agent-device runner...`)
    await backend.launchApp(appId, { relaunch: true })
  }

  // Detect the simulator scale once here rather than in every worker.
  if (platform === 'ios' && backend.pixelDensity === undefined) {
    await backend.screenshot()
  }

  const runtime: MobileTestRuntimeContext = {
    session,
    deviceName: device.name,
    deviceUdid: device.id,
    platform,
    iosPixelDensity: backend.pixelDensity,
  }
  project.provide('__mobileTestRuntime', runtime)

  return async () => {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    await close()
  }
}

const SESSION_PREFIX = 'mobile-test:'

async function closeStaleSessions(): Promise<void> {
  try {
    const stale = (await listAgentSessions()).filter(name => name.startsWith(SESSION_PREFIX))
    for (const name of stale) {
      console.log(`[mobile-test] Closing stale agent-device session "${name}" left by a previous run`)
      await closeAgentSession(name)
    }
  } catch (err) {
    console.log(`[mobile-test] Could not check for stale sessions: ${(err as Error).message}`)
  }
}

async function pickDevice(platform: 'ios' | 'android', requested?: string): Promise<AgentDeviceListedDevice> {
  const devices = await listAgentDevices(platform)
  const label = platform === 'ios' ? 'simulator' : 'emulator'

  if (requested) {
    // A physical device can be selected explicitly by name or id.
    const match = devices.find(d => d.name === requested || d.id === requested)
    if (!match) {
      throw new Error(
        `mobile-test: No ${label} or device named "${requested}" found.\n` +
        `Available: ${devices.map(d => `${d.name} (${d.id})${d.booted ? ' [booted]' : ''}`).join(', ') || 'none'}`
      )
    }
    if (!match.booted) {
      throw new Error(
        `mobile-test: ${label} "${requested}" is not booted. Boot it first (agent-device boot --device "${requested}").`
      )
    }
    return match
  }

  const candidates = devices.filter(d => d.kind !== 'device')
  const booted = candidates.filter(d => d.booted)
  if (booted.length === 0) {
    throw new Error(
      `mobile-test: No booted ${label} found. Boot one first` +
      (candidates.length ? ` (e.g. ${candidates.map(d => d.name).slice(0, 3).join(', ')}).` : '.')
    )
  }
  return booted[0]
}
