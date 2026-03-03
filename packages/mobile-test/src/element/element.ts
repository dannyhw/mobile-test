import type { Locator } from './by.js'
import type { ElementHandle } from './types.js'
import { toFrame, frameCenter, visibleFramePercentage, type Frame } from './types.js'
import { findElement, findAllElements } from './match.js'
import { getDriverClient, getActiveBundleId } from '../driver/context.js'
import { getActionTimeout } from '../config-context.js'
import { log } from '../logger.js'

const POLL_INTERVAL = 200
const MIN_VISIBLE_PERCENTAGE = 0.1
const VIEWPORT_GESTURE_MARGIN = 24

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
      // Tap to focus, erase existing text, then type replacement
      const el = await this.resolve()
      const center = frameCenter(toFrame(el.frame))
      await getDriverClient().tap(center.x, center.y)
      await new Promise(r => setTimeout(r, 300)) // Wait for keyboard

      // Erase existing text by sending delete keys
      const currentValue = el.value ?? ''
      if (currentValue.length > 0) {
        await getDriverClient().eraseText(currentValue.length)
        await new Promise(r => setTimeout(r, 200))
      }

      await getDriverClient().typeText(text)
    })
  }

  async longPress(duration = 1.0): Promise<void> {
    const el = await this.resolve()
    const center = frameCenter(toFrame(el.frame))
    await getDriverClient().tap(center.x, center.y, duration)
  }

  async clear(): Promise<void> {
    throw new Error(
      'element.clear() is not yet implemented.\n\n' +
      'Workaround: select the text manually and delete it, or use element.type() to overwrite.'
    )
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

  async swipe(direction: 'up' | 'down' | 'left' | 'right', _distance = 200): Promise<void> {
    const el = await this.resolve()
    const frame = toFrame(el.frame)
    const viewport = await this.getViewport()
    const gestureFrame = this.getGestureFrame(frame, viewport)
    const centerX = gestureFrame.x + gestureFrame.width * 0.5
    const centerY = gestureFrame.y + gestureFrame.height * 0.5

    // Keep gestures inside the visible on-screen portion of the element.
    const topY = gestureFrame.y + gestureFrame.height * 0.3
    const bottomY = gestureFrame.y + gestureFrame.height * 0.7
    const leftX = gestureFrame.x + gestureFrame.width * 0.3
    const rightX = gestureFrame.x + gestureFrame.width * 0.7

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

  async isVisible(): Promise<boolean> {
    const el = await this.tryResolve()
    if (!el) return false
    return this.isHandleVisible(el)
  }

  async getText(): Promise<string | null> {
    const el = await this.resolve()
    return el.value ?? el.label ?? null
  }

  async exists(): Promise<boolean> {
    return (await this.tryResolve()) !== null
  }

  private async isHandleVisible(handle: ElementHandle): Promise<boolean> {
    const viewport = await this.getViewport()
    return visibleFramePercentage(toFrame(handle.frame), viewport) >= MIN_VISIBLE_PERCENTAGE
  }

  private async getViewport(): Promise<Frame> {
    const info = await getDriverClient().deviceInfo()
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
