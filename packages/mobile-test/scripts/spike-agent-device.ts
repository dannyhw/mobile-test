/**
 * M0 spike for the agent-device backend POC.
 * Run with: bun run scripts/spike-agent-device.ts [deviceName]
 *
 * Prerequisites:
 * - A simulator/emulator is booted and the example app is installed
 *
 * Answers the open questions in plan/poc-agent-device-backend.md and prints
 * timings. Throwaway; not part of the build.
 */

import { createAgentDeviceClient } from 'agent-device'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'

const BUNDLE_ID = 'com.dannyhw.exampleapp'
const SCHEME = 'exampleapp'
const PLATFORM = (process.env.SPIKE_PLATFORM ?? 'ios') as 'ios' | 'android'
const DEVICE = process.argv[2] ?? (PLATFORM === 'ios' ? 'iPhone 17' : undefined)
const SESSION = `mobile-test-spike-${process.pid}`
const OUT = process.env.SPIKE_OUT ?? tmpdir()

type Node = {
  ref: string
  index: number
  parentIndex?: number
  depth?: number
  role?: string
  type?: string
  label?: string
  value?: string
  identifier?: string
  rect?: { x: number; y: number; width: number; height: number }
  enabled?: boolean
  focused?: boolean
  visibleToUser?: boolean
  hittable?: boolean
}

const timings: Record<string, number[]> = {}
async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    return await fn()
  } finally {
    const ms = performance.now() - start
    ;(timings[name] ??= []).push(ms)
    console.log(`   ⏱ ${name}: ${ms.toFixed(0)}ms`)
  }
}

function describe(n: Node): string {
  const r = n.rect ? `(${n.rect.x},${n.rect.y} ${n.rect.width}x${n.rect.height})` : '(no rect)'
  return `${n.ref} [${n.role ?? n.type ?? '?'}] id=${n.identifier ?? ''} label=${JSON.stringify(n.label ?? '')} value=${JSON.stringify(n.value ?? '')} ${r} en=${n.enabled} foc=${n.focused} vis=${n.visibleToUser} hit=${n.hittable} depth=${n.depth} parent=${n.parentIndex}`
}

function byId(nodes: Node[], id: string): Node | undefined {
  return nodes.find(n => n.identifier === id)
}

function center(n: Node): { x: number; y: number } {
  const r = n.rect!
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

async function main() {
  console.log(`=== agent-device spike (${PLATFORM}, device=${DEVICE ?? 'auto'}, session=${SESSION}) ===\n`)
  const client = createAgentDeviceClient({ session: SESSION, platform: PLATFORM, device: DEVICE } as any)
  const sel = { platform: PLATFORM, device: DEVICE } as const

  try {
    console.log('1. devices.list')
    const devices = await timed('devices.list', () => client.devices.list({ platform: PLATFORM }))
    for (const d of devices) console.log(`   ${d.name} ${d.platform}/${d.kind} booted=${d.booted} id=${d.id}`)

    console.log('\n2. apps.open (relaunch)')
    const opened = await timed('apps.open', () => client.apps.open({ ...sel, app: BUNDLE_ID, relaunch: true }))
    console.log(`   session=${opened.session} app=${opened.appBundleId ?? opened.appId} device=${JSON.stringify(opened.device)}`)
    if (opened.warnings?.length) console.log('   warnings:', opened.warnings)

    console.log('\n3. wait stable')
    await timed('wait.stable', () => client.command.wait({ ...sel, stable: true, quietMs: 500, timeoutMs: 10_000 } as any))

    console.log('\n4. screenshot (default) and screenshot (pixelDensity 3, normalizeStatusBar)')
    const shot1 = await timed('screenshot.default', () => client.capture.screenshot({ path: join(OUT, 'spike-1x.png') }))
    console.log(`   result: ${JSON.stringify({ ...shot1, overlayRefs: undefined })}`)
    const meta1 = await sharp(shot1.path).metadata()
    console.log(`   file: ${meta1.width}x${meta1.height} ${statSync(shot1.path).size} bytes`)
    let meta3 = meta1
    if (PLATFORM === 'ios') {
      const shot3 = await timed('screenshot.3x', () =>
        client.capture.screenshot({ path: join(OUT, 'spike-3x.png'), pixelDensity: 3, normalizeStatusBar: true } as any),
      )
      meta3 = await sharp(shot3.path).metadata()
      console.log(`   result: ${JSON.stringify({ ...shot3, overlayRefs: undefined })}`)
      console.log(`   file: ${meta3.width}x${meta3.height} ${statSync(shot3.path).size} bytes`)
      // second call to measure warm latency
      await timed('screenshot.3x', () => client.capture.screenshot({ path: join(OUT, 'spike-3x-b.png'), pixelDensity: 3 } as any))
    } else {
      await timed('screenshot.default', () => client.capture.screenshot({ path: join(OUT, 'spike-1x-b.png') }))
      console.log(`   android density: ${JSON.stringify(await client.command.viewport({ ...sel } as any).catch((e: Error) => e.message.slice(0, 120)))}`)
    }

    console.log('\n5. snapshot variants on the counter screen')
    const snapDefault = await timed('snapshot.default', () => client.capture.snapshot({ ...sel }))
    const snapInteractive = await timed('snapshot.interactive', () => client.capture.snapshot({ ...sel, interactiveOnly: true }))
    const snapRaw = await timed('snapshot.raw', () => client.capture.snapshot({ ...sel, raw: true }))
    const snapFull = await timed('snapshot.raw+forceFull', () => client.capture.snapshot({ ...sel, raw: true, forceFull: true }))
    await timed('snapshot.raw+forceFull', () => client.capture.snapshot({ ...sel, raw: true, forceFull: true }))
    for (const [name, s] of [['default', snapDefault], ['interactive', snapInteractive], ['raw', snapRaw], ['raw+forceFull', snapFull]] as const) {
      const nodes = s.nodes as Node[]
      const withId = nodes.filter(n => n.identifier).length
      console.log(`   ${name}: ${nodes.length} nodes, ${withId} with identifier, truncated=${s.truncated}, visibility=${JSON.stringify(s.visibility)}`)
    }
    const nodes = snapFull.nodes as Node[]
    console.log('   sample nodes (raw+forceFull):')
    for (const n of nodes.slice(0, 6)) console.log('     ' + describe(n))
    for (const id of ['counter', 'click-button', 'counter-scroll']) {
      const n = byId(nodes, id)
      console.log(`   ${id}: ${n ? describe(n) : 'NOT FOUND'}`)
    }
    const counterBtnDefault = byId(snapDefault.nodes as Node[], 'click-button')
    console.log(`   click-button present in default snapshot: ${!!counterBtnDefault}`)
    console.log(`   units check: screenshot logical ${shot1.logicalWidth}x${shot1.logicalHeight}, pixels ${meta3.width}x${meta3.height}; root-ish rect widths: ${nodes.slice(0, 3).map(n => n.rect?.width).join(',')}`)

    console.log('\n6. press by coordinates on click-button, then verify counter text')
    let btn = byId(nodes, 'click-button')
    if (!btn) {
      console.log('   click-button not in snapshot; scrolling down via swipe and re-snapshotting')
      const scroll = byId(nodes, 'counter-scroll')
      const c = scroll ? center(scroll) : { x: (shot1.logicalWidth ?? 390) / 2, y: (shot1.logicalHeight ?? 844) / 2 }
      await timed('swipe', () => client.interactions.swipe({ ...sel, from: { x: c.x, y: c.y + 150 }, to: { x: c.x, y: c.y - 150 } }))
      await timed('wait.stable', () => client.command.wait({ ...sel, stable: true, quietMs: 300, timeoutMs: 5_000 } as any))
      const again = await timed('snapshot.raw+forceFull', () => client.capture.snapshot({ ...sel, raw: true, forceFull: true }))
      btn = byId(again.nodes as Node[], 'click-button')
      console.log(`   after scroll: ${btn ? describe(btn) : 'STILL NOT FOUND'}`)
    }
    if (btn) {
      const c = center(btn)
      await timed('press.xy', () => client.interactions.press({ ...sel, x: c.x, y: c.y }))
      await timed('press.xy', () => client.interactions.press({ ...sel, x: c.x, y: c.y }))
      const after = await timed('snapshot.raw+forceFull', () => client.capture.snapshot({ ...sel, raw: true, forceFull: true }))
      console.log(`   counter after 2 presses: ${describe(byId(after.nodes as Node[], 'counter')!)}`)

      console.log('\n7. double tap via press({ doubleTap: true })')
      await timed('press.doubleTap', () => client.interactions.press({ ...sel, x: c.x, y: c.y, doubleTap: true } as any))
      const after2 = await timed('snapshot.raw+forceFull', () => client.capture.snapshot({ ...sel, raw: true, forceFull: true }))
      console.log(`   counter after doubleTap: ${describe(byId(after2.nodes as Node[], 'counter')!)}`)

      console.log('\n7b. press by selector id="click-button"')
      await timed('press.selector', () => client.interactions.press({ ...sel, selector: 'id="click-button"' }))
      const after3 = await timed('snapshot.raw+forceFull', () => client.capture.snapshot({ ...sel, raw: true, forceFull: true }))
      console.log(`   counter after selector press: ${describe(byId(after3.nodes as Node[], 'counter')!)}`)
    }

    console.log('\n8. deep link to /form via apps.open variants')
    const deepLink = `${SCHEME}:///form`
    const variants: Array<[string, () => Promise<unknown>]> = [
      ['open({ app, url })', () => client.apps.open({ ...sel, app: BUNDLE_ID, url: deepLink })],
      ['open({ app, url, relaunch })', () => client.apps.open({ ...sel, app: BUNDLE_ID, url: deepLink, relaunch: true })],
      ['open({ url })', () => client.apps.open({ ...sel, url: deepLink })],
    ]
    for (const [name, run] of variants) {
      try {
        await timed(`deeplink ${name}`, run)
        await client.command.wait({ ...sel, stable: true, quietMs: 500, timeoutMs: 10_000 } as any)
        const check = (await client.capture.snapshot({ ...sel, raw: true })).nodes as Node[]
        console.log(`   ${name}: OK, form-name present=${!!byId(check, 'form-name')}`)
      } catch (err) {
        console.log(`   ${name}: FAILED ${(err as any).code ?? ''} ${(err as Error).message.slice(0, 120)}`)
      }
    }
    let form = await timed('snapshot.raw+forceFull', () => client.capture.snapshot({ ...sel, raw: true, forceFull: true }))
    let fnodes = form.nodes as Node[]
    for (const id of ['form-name', 'form-email', 'form-terms', 'form-submit']) {
      const n = byId(fnodes, id)
      console.log(`   ${id}: ${n ? describe(n) : 'NOT FOUND'}`)
    }

    const nameField = byId(fnodes, 'form-name')
    if (nameField) {
      console.log('\n9. text entry: press to focus + type')
      const c = center(nameField)
      await timed('press.xy', () => client.interactions.press({ ...sel, x: c.x, y: c.y }))
      await timed('keyboard.status', async () => console.log('   keyboard:', JSON.stringify(await client.command.keyboard({ ...sel, action: 'status' }))))
      await timed('type', () => client.interactions.type({ ...sel, text: 'Alice' }))
      fnodes = (await timed('snapshot.raw+forceFull', () => client.capture.snapshot({ ...sel, raw: true, forceFull: true }))).nodes as Node[]
      console.log(`   form-name after type: ${describe(byId(fnodes, 'form-name')!)}`)

      console.log('\n10. fill replaces')
      await timed('fill.selector', () => client.interactions.fill({ ...sel, selector: 'id="form-name"', text: 'Bob' }))
      fnodes = (await timed('snapshot.raw+forceFull', () => client.capture.snapshot({ ...sel, raw: true, forceFull: true }))).nodes as Node[]
      console.log(`   form-name after fill: ${describe(byId(fnodes, 'form-name')!)}`)

      console.log('\n11. clear attempts')
      try {
        await timed('fill.empty', () => client.interactions.fill({ ...sel, selector: 'id="form-name"', text: '' }))
        fnodes = (await client.capture.snapshot({ ...sel, raw: true, forceFull: true })).nodes as Node[]
        console.log(`   after fill(''): ${describe(byId(fnodes, 'form-name')!)}`)
      } catch (err) {
        console.log(`   fill('') rejected: ${(err as Error).message}`)
      }
      try {
        await client.interactions.fill({ ...sel, selector: 'id="form-name"', text: 'Carol' })
        await timed('type.backspaces', () => client.interactions.type({ ...sel, text: '\b\b\b\b\b' }))
        fnodes = (await client.capture.snapshot({ ...sel, raw: true, forceFull: true })).nodes as Node[]
        console.log(`   after type(\\b x5): ${describe(byId(fnodes, 'form-name')!)}`)
      } catch (err) {
        console.log(`   type(\\b) rejected: ${(err as Error).message}`)
      }

      console.log('\n12. keyboard dismiss')
      try {
        const r = await timed('keyboard.dismiss', () => client.command.keyboard({ ...sel, action: 'dismiss' }))
        console.log('   dismiss result:', JSON.stringify(r).slice(0, 200))
      } catch (err) {
        console.log(`   dismiss failed: ${(err as Error).message.slice(0, 200)}`)
      }
    }

    console.log('\n13. second client on the same session')
    const client2 = createAgentDeviceClient({ session: SESSION, platform: PLATFORM, device: DEVICE } as any)
    const s2 = await timed('client2.snapshot', () => client2.capture.snapshot({ ...sel, interactiveOnly: true }))
    console.log(`   client2 snapshot ok: ${s2.nodes.length} nodes, app=${s2.appBundleId}`)

    console.log('\n14. apps.close({ app }) then is the session still usable?')
    await timed('apps.close', () => client.apps.close({ app: BUNDLE_ID } as any))
    try {
      const sessions = await client.sessions.list()
      console.log('   sessions after close:', JSON.stringify(sessions).slice(0, 300))
      const reopened = await timed('apps.open.again', () => client.apps.open({ ...sel, app: BUNDLE_ID, relaunch: true }))
      console.log(`   reopened session=${reopened.session}`)
    } catch (err) {
      console.log(`   after close: ${(err as Error).message.slice(0, 200)}`)
    }

    console.log('\n15. settings: location')
    try {
      await timed('settings.location', () => client.settings.update({ ...sel, setting: 'location', state: 'set', latitude: 37.7749, longitude: -122.4194 }))
      console.log('   ok')
    } catch (err) {
      console.log(`   failed: ${(err as Error).message.slice(0, 200)}`)
    }

    console.log('\n16. home')
    try {
      await timed('home', () => (client.command as any).home({ ...sel }))
      console.log('   ok')
    } catch (err) {
      console.log(`   failed: ${(err as Error).message.slice(0, 200)}`)
    }
  } finally {
    console.log('\n=== timings (ms) ===')
    for (const [name, list] of Object.entries(timings)) {
      const avg = list.reduce((a, b) => a + b, 0) / list.length
      console.log(`${name.padEnd(28)} n=${list.length} avg=${avg.toFixed(0)} min=${Math.min(...list).toFixed(0)} max=${Math.max(...list).toFixed(0)}`)
    }
    await client.sessions.close().catch(err => console.log('close failed:', (err as Error).message))
  }
}

main().catch(err => {
  console.error('\nSPIKE FAILED:', err)
  process.exit(1)
})
