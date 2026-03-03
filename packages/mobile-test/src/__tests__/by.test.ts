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

  it('has a readable toString', () => {
    expect(by.id('foo').toString()).toBe('by.id(foo)')
    expect(by.text('bar').toString()).toBe('by.text(bar)')
  })
})
