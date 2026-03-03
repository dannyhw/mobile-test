/// <reference types="../matchers.d.ts" />
import { describe, it, expect } from 'vitest'
import { device, element, by } from '../src/index.js'

const BUNDLE_ID = 'com.dannyhw.exampleapp'

describe('Example App', () => {
  it('launches and shows the button', async () => {
    await device.launch(BUNDLE_ID)

    await expect(element(by.id('click-button'))).toBeVisible()
    await expect(element(by.text('Click me!'))).toBeVisible()
  })

  it('increments the counter on tap', async () => {
    await element(by.id('click-button')).tap()
    await new Promise(r => setTimeout(r, 500))

    await expect(element(by.id('counter'))).toHaveText('1')
  })

  it('matches the screenshot after tap', async () => {
    await expect(device).toMatchScreenshot('after-tap', {
      screenshotsDir: './e2e/screenshots',
    })
  })
})
