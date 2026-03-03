import type { Locator } from './by.js'
import type { ElementHandle } from './types.js'
import { toFrame, frameCenter } from './types.js'
import { findElement, findAllElements } from './match.js'
import { getDriverClient, getActiveBundleId } from '../driver/context.js'
import { getActionTimeout } from '../config-context.js'
import { log } from '../logger.js'

const POLL_INTERVAL = 200

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
        const found = await target.tryResolve()
        if (found) return
        await this.swipe(direction === 'down' ? 'up' : direction === 'up' ? 'down' : direction === 'right' ? 'left' : 'right')
        await new Promise(r => setTimeout(r, 300))
      }
      throw new Error(`Could not find ${target.locator} after scrolling ${maxScrolls} times`)
    })
  }

  async swipe(direction: 'up' | 'down' | 'left' | 'right', distance = 200): Promise<void> {
    const el = await this.resolve()
    const center = frameCenter(toFrame(el.frame))
    const offsets = {
      up: { dx: 0, dy: -distance },
      down: { dx: 0, dy: distance },
      left: { dx: -distance, dy: 0 },
      right: { dx: distance, dy: 0 },
    }
    const { dx, dy } = offsets[direction]
    await getDriverClient().swipe(center.x, center.y, center.x + dx, center.y + dy)
  }

  async isVisible(): Promise<boolean> {
    const el = await this.tryResolve()
    return el !== null
  }

  async getText(): Promise<string | null> {
    const el = await this.resolve()
    return el.value ?? el.label ?? null
  }

  async exists(): Promise<boolean> {
    return this.isVisible()
  }
}

export function element(locator: Locator): Element {
  return new Element(locator)
}
