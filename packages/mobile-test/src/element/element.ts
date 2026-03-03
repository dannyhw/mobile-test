import type { Locator } from './by.js'
import type { ElementHandle } from './types.js'
import { toFrame, frameCenter } from './types.js'
import { findElement } from './match.js'
import { getDriverClient, getActiveBundleId } from '../driver/context.js'
import { getActionTimeout } from '../config-context.js'

const POLL_INTERVAL = 200

export class Element {
  constructor(public readonly locator: Locator) {}

  /**
   * Resolve the element from the view hierarchy with auto-wait.
   * Retries until the element is found or timeout is reached.
   */
  async resolve(timeout = getActionTimeout()): Promise<ElementHandle> {
    const client = getDriverClient()
    const bundleId = getActiveBundleId()
    const start = Date.now()

    while (true) {
      const hierarchy = await client.viewHierarchy(bundleId ?? undefined)
      const found = findElement(hierarchy, this.locator)
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
  }

  /**
   * Try to resolve the element once without retrying.
   * Returns null if not found.
   */
  async tryResolve(): Promise<ElementHandle | null> {
    const client = getDriverClient()
    const bundleId = getActiveBundleId()
    const hierarchy = await client.viewHierarchy(bundleId ?? undefined)
    return findElement(hierarchy, this.locator)
  }

  async tap(): Promise<void> {
    const el = await this.resolve()
    const center = frameCenter(toFrame(el.frame))
    await getDriverClient().tap(center.x, center.y)
  }

  async type(text: string): Promise<void> {
    // Tap to focus, then type
    await this.tap()
    await new Promise(r => setTimeout(r, 300)) // Wait for keyboard
    await getDriverClient().typeText(text)
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
