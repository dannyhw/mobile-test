import type { ElementHandle, Frame } from '../element/types.js'

/**
 * The seam between the framework (device/element/expect/screenshot) and
 * whatever drives the real device. Everything here is expressed in the
 * framework's own terms: coordinates are in logical points and match
 * `ElementHandle.frame`; trees are our `ElementHandle` shape.
 *
 * Implementations must not leak their own types through this interface.
 */

export type Platform = 'ios' | 'android'

export interface Point {
  x: number
  y: number
}

export interface BackendDeviceInfo {
  /** Human readable device name, e.g. "iPhone 17". */
  name: string
  /** Stable identifier: simulator UDID or adb serial. */
  id: string
  platform: Platform
}

export interface ScreenshotCapture {
  /** PNG bytes at device pixel resolution. */
  png: Buffer
  /** Pixels per logical point. */
  scale: number
  widthPoints: number
  heightPoints: number
  widthPixels: number
  heightPixels: number
}

export interface ScreenshotOptions {
  /**
   * Prefer latency over determinism (skip status bar normalization / settle
   * delays). For motion detection loops, not for baseline comparisons.
   */
  fast?: boolean
}

export interface TapOptions {
  /** Hold duration in milliseconds. Values above ~500ms become a long press. */
  durationMs?: number
  doubleTap?: boolean
}

export interface SwipeOptions {
  durationMs?: number
}

export interface WaitStableOptions {
  quietMs?: number
  timeoutMs?: number
}

export interface LaunchAppOptions {
  /** Deep link to open as part of the launch. */
  url?: string
  /** Terminate a running instance first. Defaults to true. */
  relaunch?: boolean
}

export type BackendKey = 'return' | 'enter' | 'back' | 'home'

export interface Backend {
  readonly platform: Platform
  readonly device: BackendDeviceInfo

  // Observation
  /** Full accessibility tree of the foreground app, including off-screen nodes when available. */
  snapshot(): Promise<ElementHandle>
  screenshot(options?: ScreenshotOptions): Promise<ScreenshotCapture>
  /** Visible window frame in points. */
  viewport(): Promise<Frame>
  keyboardVisible(): Promise<boolean>
  /**
   * Wait until the UI stops changing. Implementations may reject with
   * `BackendUnsupportedError`; callers fall back to screenshot diffing.
   */
  waitStable(options?: WaitStableOptions): Promise<void>

  // Input
  tap(x: number, y: number, options?: TapOptions): Promise<void>
  swipe(from: Point, to: Point, options?: SwipeOptions): Promise<void>
  /** Append text to the focused input. */
  typeText(text: string): Promise<void>
  /** Replace the target's text. */
  replaceText(target: ElementHandle, text: string): Promise<void>
  /** Clear the target's text. */
  clearText(target: ElementHandle): Promise<void>
  pressKey(key: BackendKey): Promise<void>
  /** Returns false when the platform offers no dismiss affordance. */
  dismissKeyboard(): Promise<boolean>

  // Lifecycle
  launchApp(bundleId: string, options?: LaunchAppOptions): Promise<void>
  terminateApp(bundleId: string): Promise<void>
  installApp(bundleId: string, appPath: string): Promise<void>
  openUrl(url: string, options?: { bundleId?: string }): Promise<void>
  setLocation(latitude: number, longitude: number): Promise<void>
  /** Release the device / session. Safe to call twice. */
  close(): Promise<void>
}

export class BackendUnsupportedError extends Error {
  constructor(operation: string, detail?: string) {
    super(`${operation} is not supported by this backend${detail ? `: ${detail}` : ''}`)
    this.name = 'BackendUnsupportedError'
  }
}
