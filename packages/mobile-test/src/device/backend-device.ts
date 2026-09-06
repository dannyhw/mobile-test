import type { Device, LaunchOptions, OpenUrlOptions, WaitForAnimationOptions } from './types.js'
import type { Backend } from '../backend/types.js'
import { getActiveBundleId, setActiveBundleId } from '../backend/context.js'
import { getAndroidAppConfig, getIOSAppConfig } from '../config-context.js'
import { compareBuffers } from '../screenshot/compare.js'
import { log } from '../logger.js'
import {
  resolveAndroidLaunchConfig,
  resolveAndroidOpenUrlConfig,
  resolveLaunchConfig,
  resolveOpenUrlConfig,
} from './launch-config.js'

const KEYBOARD_POLL_INTERVAL = 100
const KEYBOARD_HIDE_TIMEOUT = 2_000

/**
 * The single `Device` implementation. Platform differences live in the
 * backend; this class only resolves config and orchestrates calls.
 */
export class BackendDevice implements Device {
  readonly platform: 'ios' | 'android'
  readonly udid: string
  readonly name: string

  constructor(private readonly backend: Backend) {
    this.platform = backend.platform
    this.udid = backend.device.id
    this.name = backend.device.name
  }

  async launch(bundleIdOrOptions?: string | LaunchOptions): Promise<void> {
    return log.time('device.launch', async () => {
      const { bundleId, url } = this.platform === 'ios'
        ? resolveLaunchConfig(bundleIdOrOptions)
        : resolveAndroidLaunchConfig(bundleIdOrOptions)

      setActiveBundleId(bundleId)
      await this.backend.launchApp(bundleId, { url, relaunch: true })
    })
  }

  async terminate(bundleId: string): Promise<void> {
    await this.backend.terminateApp(bundleId)
  }

  async install(appPath: string): Promise<void> {
    const bundleId = getActiveBundleId() ?? this.defaultBundleId()
    if (!bundleId) {
      throw new Error('No app ID configured. Configure app.ios / app.android before calling device.install().')
    }
    await this.backend.installApp(bundleId, appPath)
  }

  async takeScreenshot(): Promise<Buffer> {
    return (await this.backend.screenshot()).png
  }

  async openUrl(target: string | OpenUrlOptions): Promise<void> {
    const url = this.platform === 'ios'
      ? resolveOpenUrlConfig(target)
      : resolveAndroidOpenUrlConfig(target)
    const bundleId = getActiveBundleId() ?? this.defaultBundleId()
    await this.backend.openUrl(url, { bundleId: bundleId ?? undefined })
  }

  async waitForAnimationToEnd(options?: WaitForAnimationOptions): Promise<void> {
    return log.time('device.waitForAnimationToEnd', async () => {
      const timeout = options?.timeout ?? 2_000
      const threshold = options?.threshold ?? 0.01
      const interval = options?.interval ?? 200

      // Screenshot diffing, not the backend's `waitStable`: agent-device's
      // accessibility-based "stable" rarely settles on React Native screens
      // (it timed out on 6 of 8 calls in the example suite), while two
      // identical screenshots take well under a second.
      const start = Date.now()
      let previous = (await this.backend.screenshot({ fast: true })).png

      while (Date.now() - start < timeout) {
        await new Promise(r => setTimeout(r, interval))
        const current = (await this.backend.screenshot({ fast: true })).png
        const diff = await compareBuffers(previous, current)
        if (diff <= threshold) return
        previous = current
      }
      // Timeout silently returns (matches Maestro behavior)
    })
  }

  async hideKeyboard(): Promise<void> {
    return log.time('device.hideKeyboard', async () => {
      if (!(await this.backend.keyboardVisible())) {
        return
      }

      if (await this.backend.dismissKeyboard()) {
        if (await this.waitForKeyboardToHide()) return
      }

      const viewport = await this.backend.viewport()
      const centerX = viewport.x + viewport.width * 0.5
      const centerY = viewport.y + viewport.height * 0.5

      const dismissAttempts = this.platform === 'android'
        ? [() => this.backend.pressKey('back')]
        : [
            () => this.backend.pressKey('return'),
            () => this.backend.swipe({ x: centerX, y: centerY }, { x: centerX, y: viewport.y + viewport.height * 0.47 }, { durationMs: 50 }),
            () => this.backend.swipe({ x: centerX, y: centerY }, { x: viewport.x + viewport.width * 0.47, y: centerY }, { durationMs: 50 }),
            () => this.backend.tap(centerX, viewport.y + viewport.height * 0.15),
          ]

      for (const dismiss of dismissAttempts) {
        await dismiss()
        if (await this.waitForKeyboardToHide()) {
          await this.waitForAnimationToEnd({ timeout: 1_000, interval: 100 })
          return
        }
      }

      throw new Error(
        'Could not hide keyboard. Try tapping a non-interactive part of the screen instead.'
      )
    })
  }

  private async waitForKeyboardToHide(timeout = KEYBOARD_HIDE_TIMEOUT): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (!(await this.backend.keyboardVisible())) {
        return true
      }
      await new Promise(r => setTimeout(r, KEYBOARD_POLL_INTERVAL))
    }
    return false
  }

  async pressHome(): Promise<void> {
    await this.backend.pressKey('home')
  }

  async setLocation(latitude: number, longitude: number): Promise<void> {
    await this.backend.setLocation(latitude, longitude)
  }

  private defaultBundleId(): string | null {
    if (this.platform === 'android') {
      return getAndroidAppConfig().appId ?? null
    }
    return getIOSAppConfig().bundleId ?? null
  }
}
