import { expect } from 'vitest'
import type { Element } from '../element/element.js'
import type { Device } from '../device/types.js'
import { takeAndCompare, type TakeAndCompareOptions } from '../screenshot/workflow.js'
import { getActionTimeout } from '../config-context.js'
import { log } from '../logger.js'

const POLL_INTERVAL = 200

export function registerMatchers(): void {
  expect.extend({
    async toBeVisible(received: Element) {
      return log.time(`expect.toBeVisible(${received.locator})`, async () => {
        const { isNot } = this
        const timeout = getActionTimeout()
        const start = Date.now()
        let visible = false

        while (Date.now() - start < timeout) {
          visible = await received.isVisible()
          if (isNot ? !visible : visible) break
          await new Promise(r => setTimeout(r, POLL_INTERVAL))
        }

        const pass = isNot ? !visible : visible

        return {
          pass,
          message: () =>
            pass
              ? `Expected element ${received.locator} ${isNot ? '' : 'not '}to be visible`
              : isNot
                ? `Expected element ${received.locator} not to be visible, but it was visible`
                : `Expected element ${received.locator} to be visible, but it was not visible after ${timeout}ms`,
        }
      })
    },

    async toHaveText(received: Element, expected: string) {
      return log.time(`expect.toHaveText(${received.locator})`, async () => {
        const timeout = getActionTimeout()
        const start = Date.now()
        let text: string | null = null

        while (Date.now() - start < timeout) {
          const handle = await received.tryResolve()
          if (handle) {
            text = handle.value ?? handle.label ?? null
            if (text === expected) break
          }
          await new Promise(r => setTimeout(r, POLL_INTERVAL))
        }

        return {
          pass: text === expected,
          message: () =>
            text === expected
              ? `Expected element ${received.locator} not to have text "${expected}"`
              : `Expected element ${received.locator} to have text "${expected}", but got "${text}"`,
        }
      })
    },

    async toBeEnabled(received: Element) {
      return log.time(`expect.toBeEnabled(${received.locator})`, async () => {
        const { isNot } = this
        const timeout = getActionTimeout()
        const start = Date.now()
        let enabled = false

        while (Date.now() - start < timeout) {
          const handle = await received.tryResolve()
          if (handle) {
            enabled = handle.enabled
            if (isNot ? !enabled : enabled) break
          }
          await new Promise(r => setTimeout(r, POLL_INTERVAL))
        }

        return {
          pass: enabled,
          message: () =>
            enabled
              ? `Expected element ${received.locator} not to be enabled`
              : `Expected element ${received.locator} to be enabled, but it was disabled after ${timeout}ms`,
        }
      })
    },

    async toHaveValue(received: Element, expected: string) {
      return log.time(`expect.toHaveValue(${received.locator})`, async () => {
        const timeout = getActionTimeout()
        const start = Date.now()
        let value: string | undefined

        while (Date.now() - start < timeout) {
          const handle = await received.tryResolve()
          if (handle) {
            value = handle.value
            if (value === expected) break
          }
          await new Promise(r => setTimeout(r, POLL_INTERVAL))
        }

        return {
          pass: value === expected,
          message: () =>
            value === expected
              ? `Expected element ${received.locator} not to have value "${expected}"`
              : `Expected element ${received.locator} to have value "${expected}", but got "${value}"`,
        }
      })
    },

    async toMatchScreenshot(received: Device | Element, name: string, options?: TakeAndCompareOptions) {
      return log.time(`expect.toMatchScreenshot(${name})`, async () => {
        // If received is an Element (has a locator property), crop the screenshot to its bounds
        const isElement = 'locator' in received
        const { getDevice } = await import('../device/index.js')
        const dev = isElement ? getDevice() : received as Device
        const deviceInfo = { name: dev.name, udid: dev.udid, platform: dev.platform }
        const resolvedOptions: TakeAndCompareOptions = {
          ...options,
          ...(isElement ? { cropElement: received as Element } : {}),
        }
        const result = await takeAndCompare(name, deviceInfo, resolvedOptions)

        if (result.baselineCreated) {
          return {
            pass: true,
            message: () => `New baseline created for "${name}" at ${result.baselinePath}`,
          }
        }

        if (result.baselineUpdated) {
          return {
            pass: true,
            message: () => `Baseline updated for "${name}" at ${result.baselinePath}`,
          }
        }

        return {
          pass: result.pass,
          message: () =>
            result.pass
              ? `Screenshot "${name}" matches baseline`
              : `Screenshot "${name}" differs from baseline by ${result.diffPercentage.toFixed(4)}%` +
                (result.diffPath ? `\n  Diff image: ${result.diffPath}` : '') +
                (result.reason ? `\n  Reason: ${result.reason}` : '') +
                `\n  Baseline: ${result.baselinePath}` +
                `\n  Latest:   ${result.latestPath}`,
        }
      })
    },
  })
}
