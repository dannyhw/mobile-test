import { Locator } from './by.js'
import type { ElementHandle } from './types.js'

/**
 * Walk the element tree and find the first element matching the locator.
 */
export function findElement(root: ElementHandle, locator: Locator): ElementHandle | null {
  const results = findAllElements(root, locator, 1)
  return results.length > 0 ? results[0] : null
}

/**
 * Walk the element tree and find all elements matching the locator.
 * Optionally limit the number of results.
 */
export function findAllElements(root: ElementHandle, locator: Locator, limit?: number): ElementHandle[] {
  const results: ElementHandle[] = []

  if (locator.ancestorLocator) {
    // Find all ancestors first, then search within each
    const ancestors = findAllElements(root, locator.ancestorLocator)
    const locatorWithoutAncestor = stripAncestor(locator)
    for (const ancestor of ancestors) {
      collectMatches(ancestor, locatorWithoutAncestor, results, limit)
      if (limit && results.length >= limit) break
    }
  } else {
    collectMatches(root, locator, results, limit)
  }

  return limit ? results.slice(0, limit) : results
}

function stripAncestor(locator: Locator): Locator {
  return new Locator(locator.type, locator.value)
}

function collectMatches(
  node: ElementHandle,
  locator: Locator,
  results: ElementHandle[],
  limit?: number,
): void {
  if (limit && results.length >= limit) return

  if (matches(node, locator)) {
    results.push(node)
    if (limit && results.length >= limit) return
  }

  if (node.children) {
    for (const child of node.children) {
      collectMatches(child, locator, results, limit)
      if (limit && results.length >= limit) return
    }
  }
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

    case 'type':
      return el.elementType === locator.value

    case 'label': {
      const label = el.label || ''
      if (locator.value instanceof RegExp) {
        return locator.value.test(label)
      }
      return label === locator.value
    }

    default:
      return false
  }
}
