import { execaCommand } from 'execa'
import type { Device, WaitForAnimationOptions } from './types.js'
import type { DriverClient } from '../driver/client.js'
import { setActiveBundleId } from '../driver/context.js'
import { compareBuffers } from '../screenshot/compare.js'

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

  async launch(bundleId: string): Promise<void> {
    if (this.client) {
      await this.client.launchApp(bundleId)
    } else {
      await execaCommand(`xcrun simctl launch ${this.udid} ${bundleId}`)
    }
    setActiveBundleId(bundleId)
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

  async openUrl(url: string): Promise<void> {
    await execaCommand(`xcrun simctl openurl ${this.udid} ${url}`)
  }

  async waitForAnimationToEnd(options?: WaitForAnimationOptions): Promise<void> {
    if (!this.client) {
      throw new Error('Driver not connected — start the test runner first')
    }

    const timeout = options?.timeout ?? 5_000
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
  }

  async hideKeyboard(): Promise<void> {
    if (!this.client) {
      throw new Error('Driver not connected — start the test runner first')
    }
    // Swipe down from center to dismiss keyboard (same approach as Maestro)
    const info = await this.client.deviceInfo()
    const centerX = info.widthPoints * 0.5
    const centerY = info.heightPoints * 0.5
    await this.client.swipe(centerX, centerY, centerX, centerY * 0.94, 0.05)
    await this.waitForAnimationToEnd()
  }

  async pressHome(): Promise<void> {
    await execaCommand(`xcrun simctl ui ${this.udid} home`)
  }

  async setLocation(latitude: number, longitude: number): Promise<void> {
    await execaCommand(`xcrun simctl location ${this.udid} set ${latitude},${longitude}`)
  }
}
