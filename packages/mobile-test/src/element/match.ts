import type { Locator } from './by.js'
import type { ElementHandle } from './types.js'

/**
 * Walk the element tree and find the first element matching the locator.
 */
export function findElement(root: ElementHandle, locator: Locator): ElementHandle | null {
  if (matches(root, locator)) return root

  if (root.children) {
    for (const child of root.children) {
      const found = findElement(child, locator)
      if (found) return found
    }
  }

  return null
}

function matches(el: ElementHandle, locator: Locator): boolean {
  switch (locator.type) {
    case 'id':
      return el.identifier === locator.value

    case 'text': {
      const text = el.label || el.value || el.title || ''
      if (locator.value instanceof RegExp) {
        return locator.value.test(text)
      }
      return text === locator.value
    }

    default:
      return false
  }
}
