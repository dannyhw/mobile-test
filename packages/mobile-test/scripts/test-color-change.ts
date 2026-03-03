/**
 * Test that screenshot comparison detects a button color change.
 *
 * Run this TWICE:
 *   1. First run: creates the baseline with current button color
 *   2. Change the button color in example-app/app/index.tsx
 *   3. Second run: compares against baseline, should detect diff
 *
 * Pass --update to update the baseline instead of comparing.
 */

import { getDefaultDevice } from '../src/device/detect.js'
import { launchDriver } from '../src/driver/installer.js'
import { setDriverClient, setActiveBundleId } from '../src/driver/context.js'
import { element } from '../src/element/element.js'
import { by } from '../src/element/by.js'
import { normalizeStatusBar, resetStatusBar } from '../src/screenshot/normalize.js'
import { takeAndCompare } from '../src/screenshot/workflow.js'
import { existsSync } from 'node:fs'

const BUNDLE_ID = 'com.dannyhw.exampleapp'
const SCREENSHOTS_DIR = './color-change-test'

async function main() {
  const isUpdate = process.argv.includes('--update')

  if (isUpdate) {
    process.env.UPDATE_SCREENSHOTS = 'true'
    console.log('=== Mode: UPDATE BASELINE ===\n')
  } else {
    console.log('=== Mode: COMPARE ===\n')
  }

  console.log('1. Setting up...')
  const sim = await getDefaultDevice()
  console.log(`   Simulator: ${sim.name}`)
  await normalizeStatusBar(sim.udid)

  const driver = await launchDriver(sim.udid)
  setDriverClient(driver.client)
  console.log(`   Driver ready\n`)

  const deviceInfo = { name: sim.name, udid: sim.udid, platform: 'ios' as const }

  try {
    console.log('2. Launching app...')
    await driver.client.launchApp(BUNDLE_ID)
    setActiveBundleId(BUNDLE_ID)
    await new Promise(r => setTimeout(r, 2000))

    // Tap button once so we have counter at 1
    await element(by.id('click-button')).tap()
    await new Promise(r => setTimeout(r, 500))
    console.log(`   Counter: ${await element(by.id('counter')).getText()}\n`)

    const hasBaseline = existsSync(`${SCREENSHOTS_DIR}/baseline/${deviceInfo.name.replace(/[^a-zA-Z0-9-_]/g, '-')}/button-color.png`)
    console.log(`3. Baseline exists: ${hasBaseline}`)

    const result = await takeAndCompare('button-color', deviceInfo, { screenshotsDir: SCREENSHOTS_DIR })

    console.log('\n=== Result ===')
    console.log(`   pass: ${result.pass}`)
    console.log(`   baselineCreated: ${result.baselineCreated}`)
    console.log(`   baselineUpdated: ${result.baselineUpdated}`)
    console.log(`   diffPercentage: ${result.diffPercentage}%`)
    if (result.diffPath) console.log(`   diffPath: ${result.diffPath}`)
    if (result.reason) console.log(`   reason: ${result.reason}`)
    console.log()

    if (result.baselineCreated) {
      console.log('Baseline created. Now change the button color and run again!')
    } else if (result.baselineUpdated) {
      console.log('Baseline updated with new color.')
    } else if (result.pass) {
      console.log('Screenshots match — no visual change detected.')
    } else {
      console.log(`Visual diff detected! ${result.diffPercentage.toFixed(4)}% of pixels differ.`)
      console.log(`Check the diff image at: ${result.diffPath}`)
    }
  } finally {
    await driver.client.terminateApp(BUNDLE_ID)
    await resetStatusBar(sim.udid)
    await driver.stop()
  }
}

main().catch((err) => {
  console.error('Failed:', err.message)
  process.exit(1)
})
