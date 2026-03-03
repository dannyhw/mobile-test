/**
 * End-to-end baseline diff test.
 *
 * 1. Launch the app → take a screenshot (becomes baseline)
 * 2. Change the button color in the example app source
 * 3. Wait for hot-reload
 * 4. Take another screenshot → compare against baseline (should detect diff)
 * 5. Restore the original color
 *
 * Run with: bun run scripts/test-baseline-diff.ts
 */

import { getDefaultDevice } from '../src/device/detect.js'
import { launchDriver } from '../src/driver/installer.js'
import { setDriverClient, setActiveBundleId } from '../src/driver/context.js'
import { normalizeStatusBar, resetStatusBar } from '../src/screenshot/normalize.js'
import { takeAndCompare } from '../src/screenshot/workflow.js'
import { rmSync, readFileSync, writeFileSync } from 'node:fs'

const BUNDLE_ID = 'com.dannyhw.exampleapp'
const SCREENSHOTS_DIR = './baseline-diff-test'
const APP_FILE = new URL('../../example-app/app/index.tsx', import.meta.url).pathname

const ORIGINAL_COLOR = 'tomato'
const NEW_COLOR = 'dodgerblue'

async function main() {
  console.log('=== Baseline Diff Test ===\n')

  // Clean previous run
  try { rmSync(SCREENSHOTS_DIR, { recursive: true }) } catch {}

  // Read original file so we can restore it
  const originalSource = readFileSync(APP_FILE, 'utf-8')

  // 1. Setup
  console.log('1. Setting up...')
  const sim = await getDefaultDevice()
  console.log(`   Simulator: ${sim.name} (${sim.udid})`)

  await normalizeStatusBar(sim.udid)
  const driver = await launchDriver(sim.udid)
  setDriverClient(driver.client)
  console.log(`   Driver ready on port ${driver.port}\n`)

  const deviceInfo = { name: sim.name, udid: sim.udid, platform: 'ios' as const }

  try {
    // 2. Launch app
    console.log('2. Launching app...')
    await driver.client.launchApp(BUNDLE_ID)
    setActiveBundleId(BUNDLE_ID)
    await new Promise(r => setTimeout(r, 2000))
    console.log('   App launched\n')

    // 3. Take baseline screenshot (button is "tomato")
    console.log(`3. Taking baseline screenshot (button color: ${ORIGINAL_COLOR})...`)
    const result1 = await takeAndCompare('button-test', deviceInfo, { screenshotsDir: SCREENSHOTS_DIR })
    console.log(`   pass: ${result1.pass}`)
    console.log(`   baselineCreated: ${result1.baselineCreated}`)
    console.log(`   baselinePath: ${result1.baselinePath}`)
    if (!result1.baselineCreated) {
      throw new Error('Expected baseline to be created on first run')
    }
    console.log()

    // 4. Change button color in source
    console.log(`4. Changing button color from "${ORIGINAL_COLOR}" to "${NEW_COLOR}"...`)
    const updatedSource = originalSource.replace(
      `pressed ? "orange" : "${ORIGINAL_COLOR}"`,
      `pressed ? "orange" : "${NEW_COLOR}"`,
    )
    writeFileSync(APP_FILE, updatedSource)
    console.log('   Source updated, waiting for hot reload...')
    await new Promise(r => setTimeout(r, 5000))
    console.log()

    // 5. Take second screenshot — should detect diff
    console.log('5. Taking comparison screenshot (should detect diff)...')
    const result2 = await takeAndCompare('button-test', deviceInfo, { screenshotsDir: SCREENSHOTS_DIR })
    console.log(`   pass: ${result2.pass}`)
    console.log(`   baselineCreated: ${result2.baselineCreated}`)
    console.log(`   diffPercentage: ${result2.diffPercentage}%`)
    if (result2.diffPath) console.log(`   diffPath: ${result2.diffPath}`)
    if (result2.reason) console.log(`   reason: ${result2.reason}`)
    console.log()

    if (!result2.pass && result2.diffPercentage > 0) {
      console.log(`=== SUCCESS: Diff detected! ${result2.diffPercentage.toFixed(4)}% of pixels differ ===`)
      console.log(`   Baseline:  ${result2.baselinePath}`)
      console.log(`   Latest:    ${result2.latestPath}`)
      console.log(`   Diff:      ${result2.diffPath}`)
    } else {
      console.log('=== UNEXPECTED: No diff detected — screenshots matched ===')
    }
  } finally {
    // Always restore original source
    console.log('\nRestoring original source...')
    writeFileSync(APP_FILE, originalSource)

    console.log('Cleaning up...')
    await driver.client.terminateApp(BUNDLE_ID)
    await resetStatusBar(sim.udid)
    await driver.stop()
    console.log('Done.')
  }
}

main().catch((err) => {
  // Restore source on crash too
  try {
    const originalSource = readFileSync(APP_FILE, 'utf-8')
    if (originalSource.includes(NEW_COLOR)) {
      writeFileSync(APP_FILE, originalSource.replace(
        `pressed ? "orange" : "${NEW_COLOR}"`,
        `pressed ? "orange" : "${ORIGINAL_COLOR}"`,
      ))
    }
  } catch {}

  console.error('\nTest failed:', err.message)
  process.exit(1)
})
