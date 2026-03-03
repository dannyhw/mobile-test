/**
 * Integration test for the iOS driver + element API.
 * Run with: bun run scripts/test-driver.ts
 *
 * Prerequisites:
 * - A simulator must be booted
 * - Driver must be built: cd ios-driver && ./build.sh
 * - The example app (com.dannyhw.exampleapp) should be installed on the simulator
 */

import { getDefaultDevice } from '../src/device/detect.js'
import { launchDriver } from '../src/driver/installer.js'
import { setDriverClient, setActiveBundleId } from '../src/driver/context.js'
import { element } from '../src/element/element.js'
import { by } from '../src/element/by.js'

const BUNDLE_ID = 'com.dannyhw.exampleapp'

async function main() {
  console.log('=== iOS Driver + Element API Integration Test ===\n')

  // 1. Detect simulator + launch driver
  console.log('1. Setting up...')
  const sim = await getDefaultDevice()
  console.log(`   Simulator: ${sim.name} (${sim.udid})`)
  const driver = await launchDriver(sim.udid)
  setDriverClient(driver.client)
  console.log(`   Driver ready on port ${driver.port}\n`)

  try {
    // 2. Launch app via driver
    console.log('2. Launching app...')
    await driver.client.launchApp(BUNDLE_ID)
    setActiveBundleId(BUNDLE_ID)
    await new Promise(r => setTimeout(r, 2000))
    console.log(`   Launched ${BUNDLE_ID}\n`)

    // 3. Test element visibility
    console.log('3. element(by.id("click-button")).isVisible()')
    const buttonVisible = await element(by.id('click-button')).isVisible()
    console.log(`   → ${buttonVisible}`)
    assert(buttonVisible === true, 'Button should be visible')

    console.log('   element(by.id("nonexistent")).isVisible()')
    const nonexistent = await element(by.id('nonexistent')).isVisible()
    console.log(`   → ${nonexistent}`)
    assert(nonexistent === false, 'Nonexistent should not be visible')
    console.log()

    // 4. Test getText
    console.log('4. element(by.id("counter")).getText()')
    const counterText = await element(by.id('counter')).getText()
    console.log(`   → "${counterText}"`)
    assert(counterText === '0', `Counter should be "0", got "${counterText}"`)
    console.log()

    // 5. Test tap via element API
    console.log('5. element(by.id("click-button")).tap()')
    await element(by.id('click-button')).tap()
    await new Promise(r => setTimeout(r, 300))
    const afterTap = await element(by.id('counter')).getText()
    console.log(`   Counter after tap: "${afterTap}"`)
    assert(afterTap === '1', `Counter should be "1" after tap, got "${afterTap}"`)
    console.log()

    // 6. Tap again
    console.log('6. Tapping 2 more times...')
    await element(by.id('click-button')).tap()
    await new Promise(r => setTimeout(r, 200))
    await element(by.id('click-button')).tap()
    await new Promise(r => setTimeout(r, 200))
    const afterThreeTaps = await element(by.id('counter')).getText()
    console.log(`   Counter after 3 taps: "${afterThreeTaps}"`)
    assert(afterThreeTaps === '3', `Counter should be "3", got "${afterThreeTaps}"`)
    console.log()

    // 7. Test by.text
    console.log('7. element(by.text("Click me")).isVisible()')
    const byText = await element(by.text('Click me')).isVisible()
    console.log(`   → ${byText}\n`)

    // 8. Take screenshot
    console.log('8. Taking screenshot...')
    const screenshot = await driver.client.screenshot()
    console.log(`   Screenshot: ${screenshot.length} bytes\n`)

    console.log('=== All tests passed! ===')
  } finally {
    console.log('\nCleaning up...')
    await driver.client.terminateApp(BUNDLE_ID)
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
