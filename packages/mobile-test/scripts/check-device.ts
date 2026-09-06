/**
 * Quick health check for a device + app through the framework's backend.
 *
 *   bun run check-device -- --platform ios --app com.example.app [--device "iPhone 17"]
 *   bun run check-device -- --platform android --app com.example.app
 *
 * Lists devices, opens an agent-device session, launches the app, takes a
 * snapshot and a screenshot, and prints how long each step took. Use it to
 * confirm the toolchain works before writing tests, or to gather timings when
 * something feels slow.
 */

import { parseArgs } from 'node:util'
import { AgentDeviceBackend, listAgentDevices } from '../src/backend/agent-device.js'
import { setLogLevel } from '../src/logger.js'

const { values } = parseArgs({
  options: {
    platform: { type: 'string', default: 'ios' },
    app: { type: 'string' },
    device: { type: 'string' },
    debug: { type: 'boolean', default: false },
  },
})

const platform = values.platform === 'android' ? 'android' : 'ios'
const appId = values.app
if (!appId) {
  console.error('Usage: bun run check-device -- --platform ios|android --app <bundle id or package> [--device <name or id>]')
  process.exit(2)
}
if (values.debug) setLogLevel('debug')

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  const result = await fn()
  console.log(`  ${name.padEnd(28)} ${(performance.now() - start).toFixed(0).padStart(6)}ms`)
  return result
}

async function main() {
  console.log(`mobile-test device check (${platform})\n`)

  const devices = await step('list devices', () => listAgentDevices(platform))
  for (const d of devices) {
    console.log(`    ${d.booted ? '●' : '○'} ${d.name} (${d.kind}, ${d.id})`)
  }
  const target = values.device
    ? devices.find(d => d.name === values.device || d.id === values.device)
    : devices.find(d => d.booted && d.kind !== 'device')
  if (!target) {
    console.error(values.device ? `\nNo device named "${values.device}".` : '\nNo booted simulator/emulator found.')
    process.exit(1)
  }
  if (!target.booted) {
    console.error(`\n${target.name} is not booted.`)
    process.exit(1)
  }
  console.log(`\nUsing ${target.name} (${target.id})\n`)

  const backend = new AgentDeviceBackend({
    session: `mobile-test:check:${process.pid}`,
    platform,
    device: { name: target.name, id: target.id, platform },
  })

  try {
    await step('open app (relaunch)', () => backend.launchApp(appId, { relaunch: true }))
    const tree = await step('snapshot', () => backend.snapshot())
    let count = 0
    let withId = 0
    const walk = (n: typeof tree) => {
      count++
      if (n.identifier) withId++
      n.children?.forEach(walk)
    }
    walk(tree)
    console.log(`    ${count} nodes, ${withId} with a testID`)

    const shot = await step('screenshot', () => backend.screenshot())
    console.log(`    ${shot.widthPixels}x${shot.heightPixels}px, ${shot.widthPoints}x${shot.heightPoints}pt, scale ${shot.scale}`)

    await step('snapshot (warm)', () => backend.snapshot())
    await step('screenshot (warm)', () => backend.screenshot())
    await step('keyboard visible?', () => backend.keyboardVisible())
    console.log('\nOK')
  } finally {
    await step('close session', () => backend.close())
  }
}

main().catch(err => {
  console.error('\nFAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
