import type { Locator } from './by.js'
import type { ElementHandle } from './types.js'
import { toFrame, frameCenter, visibleFramePercentage, type Frame } from './types.js'
import { findElement, findAllElements } from './match.js'
import { getBackend } from '../backend/context.js'
import type { Backend } from '../backend/types.js'
import { getActionTimeout } from '../config-context.js'
import { compareBuffers } from '../screenshot/compare.js'
import { cropToFrame } from '../screenshot/crop.js'
import { log } from '../logger.js'

const POLL_INTERVAL = 100
const SETTLE_INTERVAL = 100
const SCROLL_STEP_SETTLE_MS = 100
const FOCUS_KEYBOARD_TIMEOUT_MS = 1_000
const STABLE_FRAMES_REQUIRED = 2
const MIN_VISIBLE_PERCENTAGE = 0.1
const VIEWPORT_GESTURE_MARGIN = 24
const END_OF_SCROLL_DIFF_THRESHOLD = 0.5
const END_OF_SCROLL_STREAK_REQUIRED = 2

export class Element {
  private index?: number

  constructor(public readonly locator: Locator) {}

  /**
   * Select the nth matching element (0-indexed).
   */
  atIndex(index: number): Element {
    const el = new Element(this.locator)
    el.index = index
    return el
  }

  /**
   * Resolve the element from the view hierarchy with auto-wait.
   * Retries until the element is found or timeout is reached.
   */
  async resolve(timeout = getActionTimeout()): Promise<ElementHandle> {
    return log.time(`resolve(${this.locator})`, async () => {
      const backend = getBackend()
      const start = Date.now()
      let polls = 0

      while (true) {
        polls++
        const hierarchy = await backend.snapshot()
        log.debug(`resolve(${this.locator}) poll #${polls}`)
        const found = this.match(hierarchy)
        if (found) return found

        if (Date.now() - start >= timeout) {
          throw new Error(
            `Element not found: ${this.locator} after ${timeout}ms\n\n` +
            `The element could not be found in the view hierarchy. ` +
            `Make sure the element exists and has the correct testID or text.`
          )
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL))
      }
    })
  }

  /**
   * Try to resolve the element once without retrying.
   * Returns null if not found.
   */
  async tryResolve(): Promise<ElementHandle | null> {
    const hierarchy = await getBackend().snapshot()
    return this.match(hierarchy)
  }

  private match(hierarchy: ElementHandle): ElementHandle | null {
    if (this.index !== undefined) {
      const all = findAllElements(hierarchy, this.locator, this.index + 1)
      return all.length > this.index ? all[this.index] : null
    }
    return findElement(hierarchy, this.locator)
  }

  async tap(): Promise<void> {
    return log.time(`tap(${this.locator})`, async () => {
      const el = await this.resolve()
      const center = frameCenter(toFrame(el.frame))
      await getBackend().tap(center.x, center.y)
    })
  }

  async doubleTap(): Promise<void> {
    const el = await this.resolve()
    const center = frameCenter(toFrame(el.frame))
    await getBackend().tap(center.x, center.y, { doubleTap: true })
  }

  async type(text: string): Promise<void> {
    return log.time(`type(${this.locator})`, async () => {
      // Tap to focus, then append text.
      await this.tap()
      await getBackend().typeText(text)
    })
  }

  async replaceText(text: string): Promise<void> {
    return log.time(`replaceText(${this.locator})`, async () => {
      const el = await this.focusForTextEditing()
      await getBackend().replaceText(el, text)
    })
  }

  async longPress(duration = 1.0): Promise<void> {
    const el = await this.resolve()
    const center = frameCenter(toFrame(el.frame))
    await getBackend().tap(center.x, center.y, { durationMs: Math.round(duration * 1000) })
  }

  async clear(): Promise<void> {
    return log.time(`clear(${this.locator})`, async () => {
      const el = await this.focusForTextEditing()
      await getBackend().clearText(el)
    })
  }

  /**
   * Scroll the current element until the target element becomes visible.
   */
  async scrollTo(target: Element, direction: 'up' | 'down' | 'left' | 'right' = 'down', maxScrolls = 10): Promise<void> {
    return log.time(`scrollTo(${target.locator})`, async () => {
      for (let i = 0; i < maxScrolls; i++) {
        if (await target.isVisible()) return
        await this.swipe(direction === 'down' ? 'up' : direction === 'up' ? 'down' : direction === 'right' ? 'left' : 'right')
        await new Promise(r => setTimeout(r, SCROLL_STEP_SETTLE_MS))
      }
      throw new Error(`Could not find ${target.locator} after scrolling ${maxScrolls} times`)
    })
  }

  /**
   * Scroll to the very end of the scrollable element.
   * Keeps swiping until the content stops moving (detected via screenshot comparison).
   */
  async scrollToEnd(direction: 'up' | 'down' | 'left' | 'right' = 'down', maxScrolls = 50): Promise<void> {
    return log.time(`scrollToEnd(${direction})`, async () => {
      const swipeDir = direction === 'down' ? 'up' : direction === 'up' ? 'down' : direction === 'right' ? 'left' : 'right'
      const backend = getBackend()
      let atEndStreak = 0
      const handle = await this.resolve()
      const scrollFrame = toFrame(handle.frame)

      // Swipe once, wait for it to settle, capture as our reference
      await this.swipe(swipeDir)
      let previous = await this.waitForSettled(backend, 2_000, scrollFrame)

      for (let i = 1; i < maxScrolls; i++) {
        await this.swipe(swipeDir)
        const current = await this.waitForSettled(backend, 2_000, scrollFrame)
        // Compare consecutive post-swipe settled states
        const diff = await compareBuffers(previous, current)
        log.debug(`scrollToEnd iteration ${i}: diff=${diff.toFixed(4)}%`)
        if (diff <= END_OF_SCROLL_DIFF_THRESHOLD) {
          atEndStreak += 1
          // Require multiple low-diff swipes to avoid stopping early near the end.
          if (atEndStreak >= END_OF_SCROLL_STREAK_REQUIRED) {
            await this.waitForSettled(backend, 2_000, scrollFrame)
            return
          }
        } else {
          atEndStreak = 0
        }
        previous = current
      }

      await this.waitForSettled(backend, 2_000, scrollFrame)
    })
  }

  /**
   * Wait for the screen to stop changing (animation settled).
   * Returns the final stable screenshot.
   */
  private async waitForSettled(
    backend: Backend,
    timeout = 2_000,
    frame?: Frame,
  ): Promise<Buffer> {
    const start = Date.now()
    let previous = await this.captureForMotionDiff(backend, frame)
    let stableFrames = 0
    while (Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, SETTLE_INTERVAL))
      const current = await this.captureForMotionDiff(backend, frame)
      const diff = await compareBuffers(previous, current)
      stableFrames = diff <= 0.01 ? stableFrames + 1 : 0
      if (stableFrames >= STABLE_FRAMES_REQUIRED) return current
      previous = current
    }
    return previous
  }

  private async captureForMotionDiff(backend: Backend, frame?: Frame): Promise<Buffer> {
    const shot = await backend.screenshot({ fast: true })
    if (frame) {
      return cropToFrame(shot.png, frame, shot.scale)
    }
    return shot.png
  }

  async swipe(direction: 'up' | 'down' | 'left' | 'right', _distance = 200): Promise<void> {
    const el = await this.resolve()
    const frame = toFrame(el.frame)
    const viewport = await getBackend().viewport()
    const gestureFrame = this.getGestureFrame(frame, viewport)
    const centerX = gestureFrame.x + gestureFrame.width * 0.5
    const centerY = gestureFrame.y + gestureFrame.height * 0.5

    // Keep gestures inside the visible on-screen portion of the element.
    const topY = gestureFrame.y + gestureFrame.height * 0.15
    const bottomY = gestureFrame.y + gestureFrame.height * 0.85
    const leftX = gestureFrame.x + gestureFrame.width * 0.15
    const rightX = gestureFrame.x + gestureFrame.width * 0.85

    const points = {
      up: { from: { x: centerX, y: bottomY }, to: { x: centerX, y: topY } },
      down: { from: { x: centerX, y: topY }, to: { x: centerX, y: bottomY } },
      left: { from: { x: rightX, y: centerY }, to: { x: leftX, y: centerY } },
      right: { from: { x: leftX, y: centerY }, to: { x: rightX, y: centerY } },
    }

    const gesture = points[direction]
    await getBackend().swipe(gesture.from, gesture.to)
  }

  private async focusForTextEditing(): Promise<ElementHandle> {
    const el = await this.resolve()
    if (el.hasFocus) return el

    const backend = getBackend()
    const center = frameCenter(toFrame(el.frame))
    await backend.tap(center.x, center.y)

    // Wait for focus rather than sleeping a fixed amount: Android reports
    // `focused` on the node (its test IME never shows a keyboard), iOS shows
    // the keyboard but never reports focus. Give up after a short timeout.
    const start = Date.now()
    while (Date.now() - start < FOCUS_KEYBOARD_TIMEOUT_MS) {
      const fresh = await this.tryResolve()
      if (fresh?.hasFocus) return fresh
      if (await backend.keyboardVisible().catch(() => true)) break
      await new Promise(r => setTimeout(r, POLL_INTERVAL))
    }
    return el
  }

  async isVisible(): Promise<boolean> {
    const handles = await this.tryResolveAll()
    if (handles.length === 0) return false

    const viewport = await getBackend().viewport()
    for (const handle of handles) {
      if (handle.visibleToUser === false) continue
      const percentage = visibleFramePercentage(toFrame(handle.frame), viewport)
      if (percentage >= MIN_VISIBLE_PERCENTAGE) {
        return true
      }
    }
    return false
  }

  async getText(): Promise<string | null> {
    const el = await this.resolve()
    return el.value ?? el.label ?? null
  }

  async exists(): Promise<boolean> {
    return (await this.tryResolve()) !== null
  }

  private async tryResolveAll(): Promise<ElementHandle[]> {
    const hierarchy = await getBackend().snapshot()
    return findAllElements(hierarchy, this.locator)
  }

  private getGestureFrame(frame: Frame, viewport: Frame): Frame {
    const insetViewport: Frame = {
      x: viewport.x + VIEWPORT_GESTURE_MARGIN,
      y: viewport.y + VIEWPORT_GESTURE_MARGIN,
      width: Math.max(1, viewport.width - VIEWPORT_GESTURE_MARGIN * 2),
      height: Math.max(1, viewport.height - VIEWPORT_GESTURE_MARGIN * 2),
    }

    const intersected = this.intersectFrames(frame, insetViewport)
    if (intersected) {
      return intersected
    }

    return insetViewport
  }

  private intersectFrames(a: Frame, b: Frame): Frame | null {
    const x = Math.max(a.x, b.x)
    const y = Math.max(a.y, b.y)
    const right = Math.min(a.x + a.width, b.x + b.width)
    const bottom = Math.min(a.y + a.height, b.y + b.height)
    const width = right - x
    const height = bottom - y

    if (width <= 0 || height <= 0) {
      return null
    }

    return { x, y, width, height }
  }
}

export function element(locator: Locator): Element {
  return new Element(locator)
}
