import type { Locator } from './by.js'
import type { ElementHandle } from './types.js'
import { toFrame, frameCenter, visibleFramePercentage, type Frame } from './types.js'
import { findElement, findAllElements } from './match.js'
import { getDriverClient, getActiveBundleId } from '../driver/context.js'
import { getActionTimeout } from '../config-context.js'
import { compareBuffers } from '../screenshot/compare.js'
import { cropToFrame } from '../screenshot/crop.js'
import { log } from '../logger.js'

const POLL_INTERVAL = 200
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
      const client = getDriverClient()
      const bundleId = getActiveBundleId()
      const start = Date.now()
      let polls = 0

      while (true) {
        polls++
        const hierarchy = await client.viewHierarchy(bundleId ?? undefined)
        log.debug(`resolve(${this.locator}) poll #${polls}`)
        let found: ElementHandle | null
        if (this.index !== undefined) {
          const all = findAllElements(hierarchy, this.locator, this.index + 1)
          found = all.length > this.index ? all[this.index] : null
        } else {
          found = findElement(hierarchy, this.locator)
        }
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
    const client = getDriverClient()
    const bundleId = getActiveBundleId()
    const hierarchy = await client.viewHierarchy(bundleId ?? undefined)
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
      await getDriverClient().tap(center.x, center.y)
    })
  }

  async doubleTap(): Promise<void> {
    const el = await this.resolve()
    const center = frameCenter(toFrame(el.frame))
    await getDriverClient().doubleTap(center.x, center.y)
  }

  async type(text: string): Promise<void> {
    return log.time(`type(${this.locator})`, async () => {
      // Tap to focus, then type — keyboard wait is handled driver-side
      await this.tap()
      await getDriverClient().typeText(text)
    })
  }

  async replaceText(text: string): Promise<void> {
    return log.time(`replaceText(${this.locator})`, async () => {
      const el = await this.focusForTextEditing()
      await getDriverClient().clearText(this.toClearTextRequest(el))
      if (text.length > 0) {
        await getDriverClient().typeText(text)
      }
    })
  }

  async longPress(duration = 1.0): Promise<void> {
    const el = await this.resolve()
    const center = frameCenter(toFrame(el.frame))
    await getDriverClient().tap(center.x, center.y, duration)
  }

  async clear(): Promise<void> {
    return log.time(`clear(${this.locator})`, async () => {
      const el = await this.focusForTextEditing()
      await getDriverClient().clearText(this.toClearTextRequest(el))
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
        await new Promise(r => setTimeout(r, 300))
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
      const client = getDriverClient()
      let atEndStreak = 0
      const handle = await this.resolve()
      const scrollFrame = toFrame(handle.frame)
      const { scale } = await client.deviceInfo()

      // Swipe once, wait for it to settle, capture as our reference
      await this.swipe(swipeDir)
      let previous = await this.waitForSettled(client, 2_000, scrollFrame, scale)

      for (let i = 1; i < maxScrolls; i++) {
        await this.swipe(swipeDir)
        const current = await this.waitForSettled(client, 2_000, scrollFrame, scale)
        // Compare consecutive post-swipe settled states
        const diff = await compareBuffers(previous, current)
        log.debug(`scrollToEnd iteration ${i}: diff=${diff.toFixed(4)}%`)
        if (diff <= END_OF_SCROLL_DIFF_THRESHOLD) {
          atEndStreak += 1
          // Require multiple low-diff swipes to avoid stopping early near the end.
          if (atEndStreak >= END_OF_SCROLL_STREAK_REQUIRED) {
            await this.waitForSettled(client, 2_000, scrollFrame, scale)
            return
          }
        } else {
          atEndStreak = 0
        }
        previous = current
      }

      await this.waitForSettled(client, 2_000, scrollFrame, scale)
    })
  }

  /**
   * Wait for the screen to stop changing (animation settled).
   * Returns the final stable screenshot.
   */
  private async waitForSettled(
    client: ReturnType<typeof getDriverClient>,
    timeout = 2_000,
    frame?: Frame,
    scale?: number,
  ): Promise<Buffer> {
    const start = Date.now()
    let previous = await this.captureForMotionDiff(client, frame, scale)
    while (Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, 200))
      const current = await this.captureForMotionDiff(client, frame, scale)
      const diff = await compareBuffers(previous, current)
      if (diff <= 0.01) return current
      previous = current
    }
    return previous
  }

  private async captureForMotionDiff(
    client: ReturnType<typeof getDriverClient>,
    frame?: Frame,
    scale?: number,
  ): Promise<Buffer> {
    const screenshot = await client.screenshot()
    if (frame && scale) {
      return cropToFrame(screenshot, frame, scale)
    }
    return screenshot
  }

  async swipe(direction: 'up' | 'down' | 'left' | 'right', _distance = 200): Promise<void> {
    const el = await this.resolve()
    const frame = toFrame(el.frame)
    const viewport = await this.getViewport()
    const gestureFrame = this.getGestureFrame(frame, viewport)
    const centerX = gestureFrame.x + gestureFrame.width * 0.5
    const centerY = gestureFrame.y + gestureFrame.height * 0.5

    // Keep gestures inside the visible on-screen portion of the element.
    const topY = gestureFrame.y + gestureFrame.height * 0.15
    const bottomY = gestureFrame.y + gestureFrame.height * 0.85
    const leftX = gestureFrame.x + gestureFrame.width * 0.15
    const rightX = gestureFrame.x + gestureFrame.width * 0.85

    const points = {
      up: { startX: centerX, startY: bottomY, endX: centerX, endY: topY },
      down: { startX: centerX, startY: topY, endX: centerX, endY: bottomY },
      left: { startX: rightX, startY: centerY, endX: leftX, endY: centerY },
      right: { startX: leftX, startY: centerY, endX: rightX, endY: centerY },
    }

    const gesture = points[direction]
    await getDriverClient().swipe(
      gesture.startX,
      gesture.startY,
      gesture.endX,
      gesture.endY,
    )
  }

  private async focusForTextEditing(): Promise<ElementHandle> {
    const el = await this.resolve()
    if (el.hasFocus) return el

    const center = frameCenter(toFrame(el.frame))
    await getDriverClient().tap(center.x, center.y)
    await new Promise(r => setTimeout(r, 300))
    return el
  }

  private toClearTextRequest(el: ElementHandle): {
    bundleId?: string
    identifier?: string
    x: number
    y: number
    width: number
    height: number
  } {
    const frame = toFrame(el.frame)

    return {
      bundleId: getActiveBundleId() ?? undefined,
      identifier: el.identifier || undefined,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
    }
  }

  async isVisible(): Promise<boolean> {
    const handles = await this.tryResolveAll()
    if (handles.length === 0) return false

    const viewport = await this.getViewport()
    for (const handle of handles) {
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
    const client = getDriverClient()
    const bundleId = getActiveBundleId()
    const hierarchy = await client.viewHierarchy(bundleId ?? undefined)
    return findAllElements(hierarchy, this.locator)
  }

  private async getViewport(): Promise<Frame> {
    const client = getDriverClient()
    const bundleId = getActiveBundleId()

    if (bundleId) {
      const hierarchy = await client.viewHierarchy(bundleId)
      const frame = toFrame(hierarchy.frame)
      if (frame.width > 0 && frame.height > 0) {
        return frame
      }
    }

    const info = await client.deviceInfo()
    return {
      x: 0,
      y: 0,
      width: info.widthPoints,
      height: info.heightPoints,
    }
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
