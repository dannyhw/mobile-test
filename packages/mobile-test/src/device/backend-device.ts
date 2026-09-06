import type { Device, LaunchOptions, OpenUrlOptions, WaitForAnimationOptions } from './types.js'
import type { Backend, ScreenshotCapture } from '../backend/types.js'
import type { ElementHandle } from '../element/types.js'
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
const STABLE_FRAMES_REQUIRED = 2
const LAUNCH_CONTENT_TIMEOUT_MS = 5_000
const LAUNCH_CONTENT_POLL_MS = 50
/** Bottom strip holding the iOS home indicator, which fades by itself after launch. */
const IOS_HOME_INDICATOR_BAND_POINTS = 20

/** Cheap fingerprint of an accessibility tree: node count plus identifiers/labels in order. */
function treeSignature(root: ElementHandle): string {
  const parts: string[] = []
  const walk = (n: ElementHandle) => {
    parts.push(`${n.role ?? ''}|${n.identifier}|${n.label}|${n.value ?? ''}`)
    n.children?.forEach(walk)
  }
  walk(root)
  return `${parts.length}:${parts.join('\n')}`
}

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

      const relaunch = typeof bundleIdOrOptions === 'object' ? bundleIdOrOptions.relaunch ?? true : true
      setActiveBundleId(bundleId)
      await this.backend.launchApp(bundleId, { url, relaunch })
      await this.waitForFirstContent()
    })
  }

  /**
   * After a launch the app shows its splash while the bundle loads; pixels
   * cannot tell a static splash from settled content, but the accessibility
   * tree can: it grows when the first screen renders and then stops changing.
   * Wait for two consecutive identical tree signatures.
   */
  private async waitForFirstContent(timeout = LAUNCH_CONTENT_TIMEOUT_MS): Promise<void> {
    const start = Date.now()
    let previous = ''
    let stable = 0
    while (Date.now() - start < timeout) {
      const signature = await this.backend.snapshot().then(treeSignature).catch(() => '')
      stable = signature !== '' && signature === previous ? stable + 1 : 0
      if (stable >= 1) return
      previous = signature
      await new Promise(r => setTimeout(r, LAUNCH_CONTENT_POLL_MS))
    }
    log.debug('launch: accessibility tree kept changing; continuing anyway')
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
      // Captures already take ~150ms each; no extra pause between them by default.
      const interval = options?.interval ?? 0

      // Screenshot diffing, not the backend's `waitStable`: agent-device's
      // accessibility-based "stable" rarely settles on React Native screens
      // (it timed out on 6 of 8 calls in the example suite), while a few
      // identical screenshots take well under a second.
      //
      // Two consecutive unchanged frames are required so a brief pause in an
      // animation is not mistaken for its end. The iOS home indicator fades
      // on its own after launch and is excluded from the comparison.
      const start = Date.now()
      let shot = await this.backend.screenshot({ fast: true })
      const ignoreRegions = this.motionIgnoreRegions(shot)
      let previous = shot.png
      let stableFrames = 0

      while (Date.now() - start < timeout) {
        if (interval > 0) await new Promise(r => setTimeout(r, interval))
        shot = await this.backend.screenshot({ fast: true })
        const diff = await compareBuffers(previous, shot.png, { ignoreRegions })
        stableFrames = diff <= threshold ? stableFrames + 1 : 0
        if (stableFrames >= STABLE_FRAMES_REQUIRED) return
        previous = shot.png
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

  /** System chrome that animates independently of the app. */
  private motionIgnoreRegions(shot: ScreenshotCapture): Array<{ x1: number; y1: number; x2: number; y2: number }> {
    if (this.platform !== 'ios') return []
    const bandPx = Math.round(IOS_HOME_INDICATOR_BAND_POINTS * shot.scale)
    return [{ x1: 0, y1: Math.max(0, shot.heightPixels - bandPx), x2: shot.widthPixels, y2: shot.heightPixels }]
  }

  private defaultBundleId(): string | null {
    if (this.platform === 'android') {
      return getAndroidAppConfig().appId ?? null
    }
    return getIOSAppConfig().bundleId ?? null
  }
}
