/// <reference types="../matchers.d.ts" />
import { describe, it, expect } from 'vitest'
import { device, element, by } from '../src/index.js'

describe('Example App', () => {
  it('launches and shows the button', async () => {
    await device.launch({ path: '/counter' })
    await device.waitForAnimationToEnd()

    await expect(element(by.id('click-button'))).toBeVisible()
    await expect(element(by.text('Increment'))).toBeVisible()
  })

  it('launches directly to the form screen via path override', async () => {
    await device.launch({ path: '/form' })
    await device.waitForAnimationToEnd()

    await expect(element(by.id('form-submit'))).toBeVisible()
    await expect(element(by.id('form-name'))).toBeVisible()
  })

  it('increments the counter on tap', async () => {
    await device.launch({ path: '/counter' })
    await device.waitForAnimationToEnd()
    await element(by.id('click-button')).tap()
    await new Promise(r => setTimeout(r, 500))

    await expect(element(by.id('counter'))).toHaveText('1')
  })

  it('matches the screenshot after tap', async () => {
    await device.launch({ path: '/counter' })
    await device.waitForAnimationToEnd()
    await element(by.id('click-button')).tap()
    await device.waitForAnimationToEnd()

    await expect(device).toMatchScreenshot('counter-after-tap', {
      screenshotsDir: './e2e/screenshots',
    })
  })
})
