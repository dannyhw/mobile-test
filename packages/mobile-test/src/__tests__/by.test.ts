import { describe, it, expect } from 'vitest'
import { by, Locator } from '../element/by.js'

describe('by', () => {
  it('creates an id locator', () => {
    const locator = by.id('login-button')

    expect(locator).toBeInstanceOf(Locator)
    expect(locator.type).toBe('id')
    expect(locator.value).toBe('login-button')
  })

  it('creates a text locator with string', () => {
    const locator = by.text('Sign In')

    expect(locator).toBeInstanceOf(Locator)
    expect(locator.type).toBe('text')
    expect(locator.value).toBe('Sign In')
  })

  it('creates a text locator with RegExp', () => {
    const locator = by.text(/welcome/i)

    expect(locator.type).toBe('text')
    expect(locator.value).toBeInstanceOf(RegExp)
    expect((locator.value as RegExp).test('Welcome back')).toBe(true)
  })

  it('creates a type locator', () => {
    const locator = by.type(48)

    expect(locator).toBeInstanceOf(Locator)
    expect(locator.type).toBe('type')
    expect(locator.value).toBe(48)
  })

  it('creates a label locator with string', () => {
    const locator = by.label('Submit')

    expect(locator).toBeInstanceOf(Locator)
    expect(locator.type).toBe('label')
    expect(locator.value).toBe('Submit')
  })

  it('creates a label locator with RegExp', () => {
    const locator = by.label(/submit/i)

    expect(locator.type).toBe('label')
    expect(locator.value).toBeInstanceOf(RegExp)
  })

  it('withAncestor creates a new locator with ancestor', () => {
    const ancestor = by.id('container')
    const locator = by.type(48).withAncestor(ancestor)

    expect(locator).toBeInstanceOf(Locator)
    expect(locator.type).toBe('type')
    expect(locator.ancestorLocator).toBe(ancestor)
  })

  it('withAncestor does not mutate original locator', () => {
    const original = by.type(48)
    const withAnc = original.withAncestor(by.id('foo'))

    expect(original.ancestorLocator).toBeUndefined()
    expect(withAnc.ancestorLocator).toBeDefined()
  })

  it('has a readable toString', () => {
    expect(by.id('foo').toString()).toBe('by.id(foo)')
    expect(by.text('bar').toString()).toBe('by.text(bar)')
    expect(by.type(48).toString()).toBe('by.type(48)')
    expect(by.label('Submit').toString()).toBe('by.label(Submit)')
  })

  it('toString includes ancestor', () => {
    const locator = by.type(48).withAncestor(by.id('container'))
    expect(locator.toString()).toBe('by.type(48).withAncestor(by.id(container))')
  })
})
