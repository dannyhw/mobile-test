import { describe, it, expect } from 'vitest'
import { by } from '../element/by.js'
import { findElement } from '../element/match.js'
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
  children: [
    makeElement({
      identifier: 'header',
      label: 'Welcome',
      children: [
        makeElement({ identifier: 'title', label: 'My App' }),
      ],
    }),
    makeElement({
      identifier: 'click-button',
      label: 'Click me',
      frame: { X: 50, Y: 200, Width: 100, Height: 44 },
    }),
    makeElement({
      identifier: 'counter',
      value: '3',
      label: '',
      frame: { X: 50, Y: 300, Width: 100, Height: 30 },
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
