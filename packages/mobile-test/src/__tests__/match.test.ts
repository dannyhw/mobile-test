import { describe, it, expect } from 'vitest'
import { by } from '../element/by.js'
import { findElement, findAllElements } from '../element/match.js'
import type { ElementHandle } from '../element/types.js'

function makeElement(overrides: Partial<ElementHandle> = {}): ElementHandle {
  return {
    identifier: '',
    label: '',
    frame: { X: 0, Y: 0, Width: 100, Height: 50 },
    elementType: 0,
    enabled: true,
    selected: false,
    hasFocus: false,
    ...overrides,
  }
}

const tree: ElementHandle = makeElement({
  identifier: 'root',
  elementType: 47, // group
  children: [
    makeElement({
      identifier: 'header',
      label: 'Welcome',
      elementType: 9, // staticText
      children: [
        makeElement({ identifier: 'title', label: 'My App', elementType: 9 }),
      ],
    }),
    makeElement({
      identifier: 'click-button',
      label: 'Click me',
      elementType: 48, // button
      frame: { X: 50, Y: 200, Width: 100, Height: 44 },
    }),
    makeElement({
      identifier: 'counter',
      value: '3',
      label: '',
      elementType: 9, // staticText
      frame: { X: 50, Y: 300, Width: 100, Height: 30 },
    }),
    makeElement({
      identifier: 'submit-button',
      label: 'Submit',
      elementType: 48, // button
      frame: { X: 50, Y: 400, Width: 100, Height: 44 },
    }),
    makeElement({
      identifier: 'nav-group',
      elementType: 47,
      children: [
        makeElement({
          identifier: 'nav-button',
          label: 'Go back',
          elementType: 48,
        }),
      ],
    }),
  ],
})

describe('findElement', () => {
  it('finds element by.id', () => {
    const result = findElement(tree, by.id('click-button'))
    expect(result).not.toBeNull()
    expect(result!.identifier).toBe('click-button')
  })

  it('finds nested element by.id', () => {
    const result = findElement(tree, by.id('title'))
    expect(result).not.toBeNull()
    expect(result!.label).toBe('My App')
  })

  it('finds element by.text matching label', () => {
    const result = findElement(tree, by.text('Click me'))
    expect(result).not.toBeNull()
    expect(result!.identifier).toBe('click-button')
  })

  it('finds element by.text matching value', () => {
    const result = findElement(tree, by.text('3'))
    expect(result).not.toBeNull()
    expect(result!.identifier).toBe('counter')
  })

  it('finds element by.text with regex', () => {
    const result = findElement(tree, by.text(/click/i))
    expect(result).not.toBeNull()
    expect(result!.identifier).toBe('click-button')
  })

  it('returns null when not found', () => {
    const result = findElement(tree, by.id('nonexistent'))
    expect(result).toBeNull()
  })

  it('finds root element', () => {
    const result = findElement(tree, by.id('root'))
    expect(result).not.toBeNull()
    expect(result!.identifier).toBe('root')
  })
})

describe('by.type', () => {
  it('finds element by elementType', () => {
    const result = findElement(tree, by.type(48))
    expect(result).not.toBeNull()
    expect(result!.identifier).toBe('click-button')
  })

  it('returns null for non-matching type', () => {
    const result = findElement(tree, by.type(999))
    expect(result).toBeNull()
  })
})

describe('by.label', () => {
  it('finds element by exact label', () => {
    const result = findElement(tree, by.label('Welcome'))
    expect(result).not.toBeNull()
    expect(result!.identifier).toBe('header')
  })

  it('finds element by label regex', () => {
    const result = findElement(tree, by.label(/submit/i))
    expect(result).not.toBeNull()
    expect(result!.identifier).toBe('submit-button')
  })
})

describe('findAllElements', () => {
  it('finds all buttons', () => {
    const results = findAllElements(tree, by.type(48))
    expect(results).toHaveLength(3) // click-button, submit-button, nav-button
  })

  it('finds all with limit', () => {
    const results = findAllElements(tree, by.type(48), 2)
    expect(results).toHaveLength(2)
    expect(results[0].identifier).toBe('click-button')
    expect(results[1].identifier).toBe('submit-button')
  })
})

describe('withAncestor', () => {
  it('finds button inside nav-group', () => {
    const locator = by.type(48).withAncestor(by.id('nav-group'))
    const result = findElement(tree, locator)
    expect(result).not.toBeNull()
    expect(result!.identifier).toBe('nav-button')
  })

  it('finds only buttons under specific ancestor', () => {
    const locator = by.type(48).withAncestor(by.id('nav-group'))
    const results = findAllElements(tree, locator)
    expect(results).toHaveLength(1)
    expect(results[0].identifier).toBe('nav-button')
  })
})
