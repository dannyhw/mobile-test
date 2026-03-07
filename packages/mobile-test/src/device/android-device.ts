import { execa, type Options } from 'execa'
import { getAndroidAppConfig } from '../config-context.js'
import { getActiveBundleId, setActiveBundleId } from '../driver/context.js'
import type { DriverClient } from '../driver/client.js'
import { log } from '../logger.js'
import { compareBuffers } from '../screenshot/compare.js'
import {
  resolveAndroidLaunchConfig,
  resolveAndroidOpenUrlConfig,
} from './launch-config.js'
import type { Device, LaunchOptions, OpenUrlOptions, WaitForAnimationOptions } from './types.js'

export class AndroidDevice implements Device {
  readonly platform = 'android' as const

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
      const { bundleId, url } = resolveAndroidLaunchConfig(bundleIdOrOptions)

      if (this.client) {
        try {
          await this.client.terminateApp(bundleId)
        } catch {
          // Ignore termination failures when the app is not already running.
        }
        await this.client.launchApp(bundleId)
      } else {
        await this.terminate(bundleId)
        await this.startApp(bundleId)
      }

      setActiveBundleId(bundleId)

      if (url) {
        await this.openResolvedUrl(url, bundleId)
      }
    })
  }

  async terminate(bundleId: string): Promise<void> {
    if (this.client) {
      await this.client.terminateApp(bundleId)
      return
    }

    await this.adbShell(['am', 'force-stop', bundleId])
  }

  async install(appPath: string): Promise<void> {
    await this.adb(['install', '-r', appPath])
  }

  async takeScreenshot(): Promise<Buffer> {
    if (this.client) {
      return this.client.screenshot()
    }

    const { stdout } = await this.adb(['exec-out', 'screencap', '-p'], {
      encoding: 'buffer',
    })

    if (Buffer.isBuffer(stdout)) {
      return stdout
    }

    if (stdout instanceof Uint8Array) {
      return Buffer.from(stdout)
    }

    if (typeof stdout === 'string') {
      return Buffer.from(stdout)
    }

    throw new Error('adb screencap did not return binary output.')
  }

  async openUrl(target: string | OpenUrlOptions): Promise<void> {
    const bundleId = getActiveBundleId() ?? getAndroidAppConfig().appId
    const url = resolveAndroidOpenUrlConfig(target)
    await this.openResolvedUrl(url, bundleId)
  }

  async waitForAnimationToEnd(options?: WaitForAnimationOptions): Promise<void> {
    return log.time('device.waitForAnimationToEnd', async () => {
      const timeout = options?.timeout ?? 2_000
      const threshold = options?.threshold ?? 0.01
      const interval = options?.interval ?? 200
      const start = Date.now()

      let previous = await this.takeScreenshot()

      while (Date.now() - start < timeout) {
        await new Promise(r => setTimeout(r, interval))
        const current = await this.takeScreenshot()
        const diff = await compareBuffers(previous, current)
        if (diff <= threshold) {
          return
        }
        previous = current
      }
    })
  }

  async hideKeyboard(): Promise<void> {
    await this.adbShell(['input', 'keyevent', 'KEYCODE_BACK'])
  }

  async pressHome(): Promise<void> {
    await this.adbShell(['input', 'keyevent', 'KEYCODE_HOME'])
  }

  async setLocation(latitude: number, longitude: number): Promise<void> {
    if (!this.udid.startsWith('emulator-')) {
      throw new Error(
        'Android location overrides currently require an emulator serial (for adb emu geo fix).'
      )
    }

    await this.adb(['emu', 'geo', 'fix', String(longitude), String(latitude)])
  }

  private async startApp(bundleId: string): Promise<void> {
    const activity = await this.resolveLaunchActivity(bundleId)
    await this.adbShell(['am', 'start', '-W', '-n', activity])
  }

  private async resolveLaunchActivity(bundleId: string): Promise<string> {
    const { stdout } = await this.adbShell([
      'cmd',
      'package',
      'resolve-activity',
      '--brief',
      bundleId,
    ])

    const output = normalizeAdbTextOutput(stdout)
    const lines = output
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean)

    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (lines[i].includes('/')) {
        return lines[i]
      }
    }

    throw new Error(`Could not resolve a launchable activity for Android app ${bundleId}.`)
  }

  private async openResolvedUrl(url: string, bundleId?: string): Promise<void> {
    const args = ['am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', url]
    if (bundleId) {
      args.push(bundleId)
    }

    await this.adbShell(args)
  }

  private async adb(
    args: string[],
    options?: Options,
  ) {
    return execa('adb', ['-s', this.udid, ...args], options)
  }

  private async adbShell(
    args: string[],
    options?: Options,
  ) {
    return this.adb(['shell', ...args], options)
  }
}

function normalizeAdbTextOutput(stdout: unknown): string {
  if (typeof stdout === 'string') {
    return stdout
  }

  if (stdout instanceof Uint8Array) {
    return Buffer.from(stdout).toString('utf8')
  }

  if (Array.isArray(stdout)) {
    return stdout.join('\n')
  }

  return ''
}
