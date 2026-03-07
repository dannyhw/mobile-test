import { execaCommand } from 'execa'
import type { Device, LaunchOptions, OpenUrlOptions, WaitForAnimationOptions } from './types.js'
import type { DriverClient } from '../driver/client.js'
import { getActiveBundleId, setActiveBundleId } from '../driver/context.js'
import { compareBuffers } from '../screenshot/compare.js'
import { log } from '../logger.js'
import { resolveLaunchConfig, resolveOpenUrlConfig } from './launch-config.js'
import { normalizeStatusBar } from '../screenshot/normalize.js'

const KEYBOARD_POLL_INTERVAL = 100
const KEYBOARD_HIDE_TIMEOUT = 2_000

export class IOSDevice implements Device {
  readonly platform = 'ios' as const

  constructor(
    public readonly udid: string,
    public readonly name: string,
    private client?: DriverClient,
  ) {}

  setClient(client: DriverClient): void {
    this.client = client
  }

  async launch(bundleIdOrOptions?: string | LaunchOptions): Promise<void> {
    return log.time('device.launch', async () => {
      const { bundleId, url } = resolveLaunchConfig(bundleIdOrOptions)

      if (this.client) {
        try {
          await this.client.terminateApp(bundleId)
        } catch {
          // Ignore termination failures when the app is not already running.
        }
        await this.client.launchApp(bundleId)
      } else {
        await execaCommand(`xcrun simctl launch ${this.udid} ${bundleId}`)
      }
      setActiveBundleId(bundleId)

      if (url) {
        await this.openUrl(url)
        return
      }

      await normalizeStatusBar(this.udid)
    })
  }

  async terminate(bundleId: string): Promise<void> {
    if (this.client) {
      await this.client.terminateApp(bundleId)
    } else {
      await execaCommand(`xcrun simctl terminate ${this.udid} ${bundleId}`)
    }
  }

  async install(appPath: string): Promise<void> {
    await execaCommand(`xcrun simctl install ${this.udid} ${appPath}`)
  }

  async takeScreenshot(): Promise<Buffer> {
    if (!this.client) {
      throw new Error('Driver not connected — start the test runner first')
    }
    return this.client.screenshot()
  }

  async openUrl(target: string | OpenUrlOptions): Promise<void> {
    const url = resolveOpenUrlConfig(target)

    try {
      await execaCommand(`xcrun simctl openurl ${this.udid} ${url}`)
      await normalizeStatusBar(this.udid)
    } catch (error) {
      throw new Error(`Failed to open URL ${url} on simulator ${this.udid}.`, { cause: error })
    }
  }

  async waitForAnimationToEnd(options?: WaitForAnimationOptions): Promise<void> {
    return log.time('device.waitForAnimationToEnd', async () => {
      if (!this.client) {
        throw new Error('Driver not connected — start the test runner first')
      }

      const timeout = options?.timeout ?? 2_000
      const threshold = options?.threshold ?? 0.01
      const interval = options?.interval ?? 200
      const start = Date.now()

      let previous = await this.client.screenshot()

      while (Date.now() - start < timeout) {
        await new Promise(r => setTimeout(r, interval))
        const current = await this.client.screenshot()
        const diff = await compareBuffers(previous, current)
        if (diff <= threshold) return
        previous = current
      }
      // Timeout silently returns (matches Maestro behavior)
    })
  }

  async hideKeyboard(): Promise<void> {
    return log.time('device.hideKeyboard', async () => {
      if (!this.client) {
        throw new Error('Driver not connected — start the test runner first')
      }
      const bundleId = getActiveBundleId() ?? undefined
      if (!(await this.client.keyboardVisible(bundleId))) {
        return
      }

      const client = this.client
      const info = await this.client.deviceInfo()
      const centerX = info.widthPoints * 0.5
      const centerY = info.heightPoints * 0.5

      const dismissAttempts = [
        () => client.pressKey('return'),
        () => client.swipe(centerX, centerY, centerX, info.heightPoints * 0.47, 0.05),
        () => client.swipe(centerX, centerY, info.widthPoints * 0.47, centerY, 0.05),
        () => client.tap(centerX, info.heightPoints * 0.15),
      ]

      for (const dismiss of dismissAttempts) {
        await dismiss()
        if (await this.waitForKeyboardToHide(bundleId)) {
          await this.waitForAnimationToEnd({ timeout: 1_000, interval: 100 })
          return
        }
      }

      throw new Error(
        'Could not hide keyboard. Try tapping a non-interactive part of the screen instead.'
      )
    })
  }

  private async waitForKeyboardToHide(bundleId?: string, timeout = KEYBOARD_HIDE_TIMEOUT): Promise<boolean> {
    if (!this.client) {
      throw new Error('Driver not connected — start the test runner first')
    }

    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (!(await this.client.keyboardVisible(bundleId))) {
        return true
      }
      await new Promise(r => setTimeout(r, KEYBOARD_POLL_INTERVAL))
    }

    return false
  }

  async pressHome(): Promise<void> {
    await execaCommand(`xcrun simctl ui ${this.udid} home`)
  }

  async setLocation(latitude: number, longitude: number): Promise<void> {
    await execaCommand(`xcrun simctl location ${this.udid} set ${latitude},${longitude}`)
  }
}
