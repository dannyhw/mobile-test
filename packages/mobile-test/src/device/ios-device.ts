import { execaCommand } from 'execa'
import type { Device } from './types.js'
import type { DriverClient } from '../driver/client.js'
import { setActiveBundleId } from '../driver/context.js'

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
}
