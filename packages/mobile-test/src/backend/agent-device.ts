import { createAgentDeviceClient, isAgentDeviceError } from 'agent-device'
import { execa } from 'execa'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ElementHandle, Frame } from '../element/types.js'
import { toFrame, frameCenter } from '../element/types.js'
import { log } from '../logger.js'
import { snapshotToTree, type FlatSnapshotNode } from './snapshot-tree.js'
import {
  BackendUnsupportedError,
  type Backend,
  type BackendDeviceInfo,
  type BackendKey,
  type LaunchAppOptions,
  type Platform,
  type Point,
  type ScreenshotCapture,
  type ScreenshotOptions,
  type SwipeOptions,
  type TapOptions,
  type WaitStableOptions,
} from './types.js'

type Client = ReturnType<typeof createAgentDeviceClient>

const LONG_PRESS_THRESHOLD_MS = 500
const DEFAULT_IOS_PIXEL_DENSITY = 3
const DEFAULT_SWIPE_DURATION_MS = 300
const ADB_KEYEVENT_BATCH = 24
const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 750

export interface AgentDeviceBackendOptions {
  /** agent-device session name. All clients sharing it act on the same device claim. */
  session: string
  platform: Platform
  device: BackendDeviceInfo
  /**
   * iOS simulator screenshots default to 1x. Set this to the simulator's scale
   * (usually 3) to capture native pixels. Ignored on Android.
   */
  iosPixelDensity?: number
  /** Normalize the iOS status bar (time, battery) on every screenshot. Default true. */
  normalizeStatusBar?: boolean
  /** Divide snapshot rects by this factor to convert to points (Android density). */
  rectDivisor?: number
  /** Injected for tests. */
  client?: Client
}

export interface AgentDeviceListedDevice {
  platform: Platform
  kind: 'simulator' | 'emulator' | 'device'
  id: string
  name: string
  booted: boolean
}

/**
 * List iOS/Android devices agent-device can see.
 */
export async function listAgentDevices(platform: Platform): Promise<AgentDeviceListedDevice[]> {
  const client = createAgentDeviceClient()
  const devices = await client.devices.list({ platform })
  return devices
    .filter(d => d.platform === platform)
    .map(d => ({
      platform,
      kind: d.kind,
      id: d.ios?.udid ?? d.android?.serial ?? d.id,
      name: d.name,
      booted: d.booted ?? false,
    }))
}

/** Names of the agent-device sessions currently open on this host. */
export async function listAgentSessions(): Promise<string[]> {
  const client = createAgentDeviceClient()
  const sessions = await client.sessions.list()
  return sessions
    .map(s => (typeof s === 'string' ? s : (s as any)?.session ?? (s as any)?.name))
    .filter((name): name is string => typeof name === 'string')
}

export async function closeAgentSession(session: string): Promise<void> {
  const client = createAgentDeviceClient({ session })
  await client.sessions.close({ session })
}

/**
 * Backend that drives devices through agent-device's Node client.
 */
export class AgentDeviceBackend implements Backend {
  readonly platform: Platform
  readonly device: BackendDeviceInfo
  private readonly client: Client
  private readonly session: string
  private iosPixelDensity: number | undefined
  private readonly normalizeStatusBar: boolean
  private readonly rectDivisor: number | undefined
  private viewportCache: Frame | undefined
  private tmpDir: string | undefined
  private closed = false

  constructor(options: AgentDeviceBackendOptions) {
    this.platform = options.platform
    this.device = options.device
    this.session = options.session
    // iOS simulator screenshots default to 1x; baselines are native pixels.
    // When not configured, the density is detected once per session.
    this.iosPixelDensity = options.iosPixelDensity
    // Off by default: globalSetup applies our own `simctl status_bar` override
    // (time 9:41, 4 cellular bars) so baselines from the native driver still
    // match. agent-device's normalization shows no cellular bars.
    this.normalizeStatusBar = options.normalizeStatusBar ?? false
    this.rectDivisor = options.rectDivisor
    this.client = options.client ?? createAgentDeviceClient({ session: options.session })
  }

  /** iOS pixels per point, once configured or detected (undefined before the first screenshot). */
  get pixelDensity(): number | undefined {
    return this.iosPixelDensity
  }

  /** Selection options attached to every request. */
  private get sel(): { platform: Platform; udid?: string; serial?: string } {
    return this.platform === 'ios'
      ? { platform: 'ios', udid: this.device.id }
      : { platform: 'android', serial: this.device.id }
  }

  // ---- Observation -------------------------------------------------------

  async snapshot(): Promise<ElementHandle> {
    return log.time('backend.snapshot', async () => {
      const result = await this.call('snapshot', () =>
        this.client.capture.snapshot({ ...this.sel, raw: true, forceFull: true }),
      )
      return snapshotToTree(result.nodes as FlatSnapshotNode[], { rectDivisor: this.rectDivisor })
    })
  }

  async screenshot(options?: ScreenshotOptions): Promise<ScreenshotCapture> {
    return log.time('backend.screenshot', async () => {
      const pixelDensity = this.platform === 'ios' ? await this.resolveIosPixelDensity() : undefined
      const path = join(this.ensureTmpDir(), `shot-${Date.now()}-${Math.random().toString(36).slice(2)}.png`)
      const result = await this.call('screenshot', () =>
        this.client.capture.screenshot({
          ...this.sel,
          path,
          ...(pixelDensity ? { pixelDensity } : {}),
          ...(this.platform === 'ios' ? { normalizeStatusBar: this.normalizeStatusBar } : {}),
          // Android capture waits for demo-mode status bar + a settle delay
          // (~1.2s). Motion-diff loops only need consecutive frames.
          ...(this.platform === 'android' && options?.fast ? { stabilize: false } : {}),
        }),
      )
      const png = readFileSync(result.path ?? path)
      rmSync(result.path ?? path, { force: true })

      const { width, height } = readPngSize(png)
      const logicalWidth = result.logicalWidth ?? width / (result.pixelDensity ?? 1)
      const logicalHeight = result.logicalHeight ?? height / (result.pixelDensity ?? 1)
      const scale = result.pixelDensity ?? (logicalWidth > 0 ? width / logicalWidth : 1)

      this.viewportCache ??= { x: 0, y: 0, width: logicalWidth, height: logicalHeight }

      return {
        png,
        scale,
        widthPoints: logicalWidth,
        heightPoints: logicalHeight,
        widthPixels: width,
        heightPixels: height,
      }
    })
  }

  async viewport(): Promise<Frame> {
    if (this.viewportCache) return this.viewportCache
    await this.screenshot()
    return this.viewportCache!
  }

  /**
   * agent-device does not report the simulator's scale factor and captures
   * at 1x by default. Compare a 1x capture's logical width with the width of
   * a native `simctl io screenshot` once, then cache the ratio.
   */
  private async resolveIosPixelDensity(): Promise<number> {
    if (this.iosPixelDensity) return this.iosPixelDensity
    if (this.device.id.length === 0) return DEFAULT_IOS_PIXEL_DENSITY

    try {
      const dir = this.ensureTmpDir()
      const probePath = join(dir, 'density-probe-1x.png')
      const probe = await this.client.capture.screenshot({ ...this.sel, path: probePath })
      const logicalWidth = probe.logicalWidth ?? readPngSize(readFileSync(probe.path ?? probePath)).width
      rmSync(probe.path ?? probePath, { force: true })

      const nativePath = join(dir, 'density-probe-native.png')
      await execa('xcrun', ['simctl', 'io', this.device.id, 'screenshot', nativePath])
      const nativeWidth = readPngSize(readFileSync(nativePath)).width
      rmSync(nativePath, { force: true })

      const density = Math.max(1, Math.round(nativeWidth / logicalWidth))
      log.debug(`detected iOS pixel density ${density} (${nativeWidth}px / ${logicalWidth}pt)`)
      this.iosPixelDensity = density
    } catch (err) {
      log.debug(`iOS pixel density detection failed, using ${DEFAULT_IOS_PIXEL_DENSITY}x: ${errorMessage(err)}`)
      this.iosPixelDensity = DEFAULT_IOS_PIXEL_DENSITY
    }
    return this.iosPixelDensity
  }

  async keyboardVisible(): Promise<boolean> {
    if (this.platform === 'ios') {
      // `keyboard status` is Android-only. On iOS the raw accessibility tree
      // contains a `Keyboard` element while the keyboard is up.
      const result = await this.call('snapshot', () =>
        this.client.capture.snapshot({ ...this.sel, raw: true }),
      )
      return (result.nodes as FlatSnapshotNode[]).some(n => (n.type ?? n.role)?.toLowerCase() === 'keyboard')
    }
    const result = await this.call('keyboard status', () =>
      this.client.command.keyboard({ ...this.sel, action: 'status' }),
    )
    return readKeyboardVisible(result)
  }

  async waitStable(options?: WaitStableOptions): Promise<void> {
    try {
      await this.client.command.wait({
        ...this.sel,
        stable: true,
        quietMs: options?.quietMs ?? 500,
        timeoutMs: options?.timeoutMs ?? 10_000,
      })
    } catch (err) {
      if (errorReason(err) === 'wait_stable_timeout') {
        log.debug('waitStable: UI never settled within timeout; continuing')
        return
      }
      if (isUnsupported(err)) {
        throw new BackendUnsupportedError('waitStable', errorMessage(err))
      }
      throw wrap('wait stable', err)
    }
  }

  // ---- Input ---------------------------------------------------------------

  async tap(x: number, y: number, options?: TapOptions): Promise<void> {
    return log.time('backend.tap', () => this.tapUntimed(x, y, options))
  }

  private async tapUntimed(x: number, y: number, options?: TapOptions): Promise<void> {
    if (options?.durationMs && options.durationMs >= LONG_PRESS_THRESHOLD_MS) {
      await this.call('longpress', () =>
        this.client.interactions.longPress({ ...this.sel, x, y, durationMs: options.durationMs }),
      )
      return
    }
    await this.call('press', () =>
      this.client.interactions.press({
        ...this.sel,
        x,
        y,
        ...(options?.durationMs ? { holdMs: options.durationMs } : {}),
        ...(options?.doubleTap ? { doubleTap: true } : {}),
      }),
    )
  }

  async swipe(from: Point, to: Point, options?: SwipeOptions): Promise<void> {
    // agent-device's `swipe` is a fling (momentum scroll). The framework's
    // swipe semantics are a timed drag, like the native driver, so use `pan`.
    await log.time('backend.swipe', () =>
      this.call('pan', () =>
        this.client.interactions.pan({
          ...this.sel,
          x: from.x,
          y: from.y,
          dx: to.x - from.x,
          dy: to.y - from.y,
          durationMs: options?.durationMs ?? DEFAULT_SWIPE_DURATION_MS,
        } as any),
      ),
    )
  }

  async typeText(text: string): Promise<void> {
    await log.time('backend.typeText', () =>
      this.call('type', () => this.client.interactions.type({ ...this.sel, text })),
    )
  }

  async replaceText(target: ElementHandle, text: string): Promise<void> {
    const center = frameCenter(toFrame(target.frame))
    await this.call('fill', () =>
      this.client.interactions.fill({ ...this.sel, x: center.x, y: center.y, text }),
    )
  }

  async clearText(target: ElementHandle): Promise<void> {
    // agent-device has no clear command and rejects `fill` with an empty string.
    const current = target.value ?? ''
    if (current.length === 0) return

    if (this.platform === 'ios') {
      // XCTest forwards "\b" as the delete key, so send one per character.
      await this.typeText('\b'.repeat(current.length))
      return
    }

    // Android's test IME types "\b" literally, so send delete key events
    // through adb (the same thing agent-device's own `fill` does internally).
    // On an empty EditText `value` is the hint text, so this may send a few
    // extra deletes, which are harmless.
    await log.time('backend.clearText', async () => {
      await execa('adb', ['-s', this.device.id, 'shell', 'input', 'keyevent', 'KEYCODE_MOVE_END'])
      for (let sent = 0; sent < current.length; sent += ADB_KEYEVENT_BATCH) {
        const batch = Math.min(ADB_KEYEVENT_BATCH, current.length - sent)
        await execa('adb', ['-s', this.device.id, 'shell', 'input', 'keyevent', ...Array(batch).fill('KEYCODE_DEL')])
      }
    })
  }

  async pressKey(key: BackendKey): Promise<void> {
    switch (key) {
      case 'return':
      case 'enter':
        await this.call(`keyboard ${key}`, () => this.client.command.keyboard({ ...this.sel, action: key }))
        return
      case 'back':
        await this.call('back', () => this.client.command.back({ ...this.sel }))
        return
      case 'home':
        await this.call('home', () => this.client.command.home({ ...this.sel }))
        return
    }
  }

  async dismissKeyboard(): Promise<boolean> {
    try {
      await this.client.command.keyboard({ ...this.sel, action: 'dismiss' })
      return true
    } catch (err) {
      if (isUnsupported(err)) return false
      throw wrap('keyboard dismiss', err)
    }
  }

  // ---- Lifecycle -----------------------------------------------------------

  async launchApp(bundleId: string, options?: LaunchAppOptions): Promise<void> {
    await this.call('open', () =>
      this.client.apps.open({
        ...this.sel,
        app: bundleId,
        relaunch: options?.relaunch ?? true,
        ...(options?.url ? { url: options.url } : {}),
      }),
    )
    this.viewportCache = undefined
  }

  async terminateApp(bundleId: string): Promise<void> {
    try {
      await this.client.apps.close({ ...this.sel, app: bundleId })
    } catch (err) {
      // Closing an app that is not running is not an error for callers.
      log.debug(`terminateApp(${bundleId}) ignored: ${errorMessage(err)}`)
    }
  }

  async installApp(bundleId: string, appPath: string): Promise<void> {
    await this.call('install', () => this.client.apps.install({ ...this.sel, app: bundleId, appPath }))
  }

  async openUrl(url: string, options?: { bundleId?: string }): Promise<void> {
    await this.call('open url', () =>
      this.client.apps.open({
        ...this.sel,
        url,
        ...(options?.bundleId ? { app: options.bundleId } : {}),
      }),
    )
    if (this.platform === 'ios') {
      await this.acceptOpenInAppAlerts()
    }
  }

  /**
   * Opening a custom-scheme URL onto a running iOS app shows a system
   * "Open in <app>?" alert (one per open; they stack). XCTest used to
   * auto-dismiss these; here we accept them explicitly.
   */
  private async acceptOpenInAppAlerts(maxAlerts = 5): Promise<void> {
    for (let i = 0; i < maxAlerts; i++) {
      let message: string | undefined
      try {
        const result = await this.client.command.alert({ ...this.sel, action: 'get' })
        message = String((result as any)?.data?.message ?? (result as any)?.message ?? '')
      } catch {
        return // no alert
      }
      if (!/open in/i.test(message)) return
      try {
        await this.client.interactions.press({ ...this.sel, selector: 'text="Open"' })
      } catch (err) {
        log.debug(`accept "Open in" alert failed: ${errorMessage(err)}`)
        return
      }
      await new Promise(r => setTimeout(r, 500))
    }
  }

  async setLocation(latitude: number, longitude: number): Promise<void> {
    await this.call('settings location', () =>
      this.client.settings.update({ ...this.sel, setting: 'location', state: 'set', latitude, longitude }),
    )
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    try {
      await this.client.sessions.close({ session: this.session })
    } catch (err) {
      log.debug(`session close ignored: ${errorMessage(err)}`)
    }
    if (this.tmpDir) {
      rmSync(this.tmpDir, { recursive: true, force: true })
      this.tmpDir = undefined
    }
  }

  // ---- helpers -------------------------------------------------------------

  private ensureTmpDir(): string {
    this.tmpDir ??= mkdtempSync(join(tmpdir(), 'mobile-test-'))
    return this.tmpDir
  }

  /**
   * Run one agent-device call, retrying the transient "runner busy" state
   * (the iOS runner is still finishing a watchdog-exceeded capture) a few
   * times before surfacing the error.
   */
  private async call<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    let attempt = 0
    while (true) {
      try {
        return await fn()
      } catch (err) {
        if (isRetriable(err) && attempt < RETRY_ATTEMPTS) {
          attempt++
          log.debug(`${operation}: ${errorCode(err)}, retrying (${attempt}/${RETRY_ATTEMPTS}) in ${RETRY_DELAY_MS}ms`)
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
          continue
        }
        throw wrap(operation, err)
      }
    }
  }
}

// ---- error helpers ---------------------------------------------------------

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function errorCode(err: unknown): string | undefined {
  if (isAgentDeviceError(err)) return (err as any).code
  return (err as any)?.code
}

function errorReason(err: unknown): string | undefined {
  return (err as any)?.details?.reason
}

function isUnsupported(err: unknown): boolean {
  return errorCode(err) === 'UNSUPPORTED_OPERATION'
}

function isRetriable(err: unknown): boolean {
  if (errorCode(err) === 'RUNNER_BUSY') return true
  return (err as any)?.details?.retriable === true || (err as any)?.retriable === true
}

function wrap(operation: string, err: unknown): Error {
  const code = errorCode(err)
  const hint = (err as any)?.hint
  const message =
    `agent-device ${operation} failed${code ? ` (${code})` : ''}: ${errorMessage(err)}` +
    (hint ? `\n  Hint: ${hint}` : '')
  return new Error(message, { cause: err })
}

function readKeyboardVisible(result: unknown): boolean {
  const data = (result as any)?.data ?? result
  if (typeof data?.visible === 'boolean') return data.visible
  if (typeof data?.keyboard?.visible === 'boolean') return data.keyboard.visible
  if (typeof data?.shown === 'boolean') return data.shown
  return false
}

/** Read width/height from a PNG header without decoding the image. */
function readPngSize(png: Buffer): { width: number; height: number } {
  if (png.length < 24 || png.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('Screenshot is not a PNG')
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}
