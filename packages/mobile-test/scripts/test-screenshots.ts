/**
 * Integration test for the screenshot comparison workflow.
 * Run with: bun run scripts/test-screenshots.ts
 *
 * Prerequisites:
 * - A simulator must be booted
 * - Driver must be built: cd ios-driver && ./build.sh
 * - The example app (com.dannyhw.exampleapp) should be installed on the simulator
 *
 * What this does:
 * 1. Launches the driver + normalizes status bar
 * 2. Launches the app
 * 3. Taps the button (counter goes to 1)
 * 4. Takes a screenshot → creates baseline (first run)
 * 5. Takes another screenshot → compares against baseline (should match)
 * 6. Reports results
 */

import { getDefaultDevice } from '../src/device/detect.js'
import { launchDriver } from '../src/driver/installer.js'
import { setDriverClient, setActiveBundleId } from '../src/driver/context.js'
import { element } from '../src/element/element.js'
import { by } from '../src/element/by.js'
import { normalizeStatusBar, resetStatusBar } from '../src/screenshot/normalize.js'
import { takeAndCompare } from '../src/screenshot/workflow.js'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

const BUNDLE_ID = 'com.dannyhw.exampleapp'
const SCREENSHOTS_DIR = './test-screenshots-output'

async function main() {
  console.log('=== Screenshot Workflow Integration Test ===\n')

  // Clean up from previous runs
  try { rmSync(SCREENSHOTS_DIR, { recursive: true }) } catch {}

  // 1. Setup
  console.log('1. Setting up...')
  const sim = await getDefaultDevice()
  console.log(`   Simulator: ${sim.name} (${sim.udid})`)

  await normalizeStatusBar(sim.udid)
  console.log('   Status bar normalized')

  const driver = await launchDriver(sim.udid)
  setDriverClient(driver.client)
  console.log(`   Driver ready on port ${driver.port}\n`)

  const deviceInfo = { name: sim.name, udid: sim.udid, platform: 'ios' as const }

  try {
    // 2. Launch app + tap button
    console.log('2. Launching app and tapping button...')
    await driver.client.launchApp(BUNDLE_ID)
    setActiveBundleId(BUNDLE_ID)
    await new Promise(r => setTimeout(r, 2000))
    await element(by.id('click-button')).tap()
    await new Promise(r => setTimeout(r, 500))
    const counter = await element(by.id('counter')).getText()
    console.log(`   Counter: ${counter}\n`)

    // 3. First screenshot — should create baseline
    console.log('3. Taking first screenshot (should create baseline)...')
    const result1 = await takeAndCompare('after-tap', deviceInfo, { screenshotsDir: SCREENSHOTS_DIR })
    console.log(`   pass: ${result1.pass}`)
    console.log(`   baselineCreated: ${result1.baselineCreated}`)
    console.log(`   baselinePath: ${result1.baselinePath}`)
    console.log(`   latestPath: ${result1.latestPath}`)
    assert(result1.pass, 'First screenshot should pass')
    assert(result1.baselineCreated, 'First screenshot should create baseline')
    console.log()

    // 4. Second screenshot — should match baseline (no changes)
    console.log('4. Taking second screenshot (should match baseline)...')
    const result2 = await takeAndCompare('after-tap', deviceInfo, { screenshotsDir: SCREENSHOTS_DIR })
    console.log(`   pass: ${result2.pass}`)
    console.log(`   baselineCreated: ${result2.baselineCreated}`)
    console.log(`   diffPercentage: ${result2.diffPercentage}%`)
    assert(result2.pass, 'Second screenshot should match baseline')
    assert(!result2.baselineCreated, 'Second screenshot should NOT create baseline')
    console.log()

    // 5. Tap again to change UI, then compare — should detect diff
    console.log('5. Tapping button again and comparing (should detect diff)...')
    await element(by.id('click-button')).tap()
    await element(by.id('click-button')).tap()
    await new Promise(r => setTimeout(r, 500))
    const counter2 = await element(by.id('counter')).getText()
    console.log(`   Counter now: ${counter2}`)
    const result3 = await takeAndCompare('after-tap', deviceInfo, { screenshotsDir: SCREENSHOTS_DIR })
    console.log(`   pass: ${result3.pass}`)
    console.log(`   diffPercentage: ${result3.diffPercentage}%`)
    console.log(`   diffPath: ${result3.diffPath}`)
    console.log(`   reason: ${result3.reason}`)
    // The counter text changed from "1" to "3", so there should be a pixel diff
    assert(!result3.pass, 'Third screenshot should NOT match (counter changed)')
    assert(result3.diffPercentage > 0, 'Should have non-zero diff percentage')
    console.log()

    // 6. Test UPDATE_SCREENSHOTS flow
    console.log('6. Testing UPDATE_SCREENSHOTS flow...')
    process.env.UPDATE_SCREENSHOTS = 'true'
    const result4 = await takeAndCompare('after-tap', deviceInfo, { screenshotsDir: SCREENSHOTS_DIR })
    delete process.env.UPDATE_SCREENSHOTS
    console.log(`   pass: ${result4.pass}`)
    console.log(`   baselineUpdated: ${result4.baselineUpdated}`)
    assert(result4.pass, 'UPDATE_SCREENSHOTS should pass')
    assert(result4.baselineUpdated, 'UPDATE_SCREENSHOTS should update baseline')
    console.log()

    // 7. Now compare again — should match the updated baseline
    console.log('7. Comparing against updated baseline (should match)...')
    const result5 = await takeAndCompare('after-tap', deviceInfo, { screenshotsDir: SCREENSHOTS_DIR })
    console.log(`   pass: ${result5.pass}`)
    console.log(`   diffPercentage: ${result5.diffPercentage}%`)
    assert(result5.pass, 'Should match after baseline update')
    console.log()

    console.log('=== All screenshot tests passed! ===')
  } finally {
    console.log('\nCleaning up...')
    await driver.client.terminateApp(BUNDLE_ID)
    await resetStatusBar(sim.udid)
    await driver.stop()
    console.log('Done.')
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

main().catch((err) => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
