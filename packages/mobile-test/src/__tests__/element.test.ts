import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetDriverClient, mockGetActiveBundleId } = vi.hoisted(() => ({
  mockGetDriverClient: vi.fn(),
  mockGetActiveBundleId: vi.fn(),
}))

vi.mock('../driver/context.js', () => ({
  getDriverClient: mockGetDriverClient,
  getActiveBundleId: mockGetActiveBundleId,
}))

vi.mock('../config-context.js', () => ({
  getActionTimeout: vi.fn(() => 2_000),
}))

vi.mock('../logger.js', () => ({
  log: {
    time: vi.fn(async (_label: string, fn: () => unknown) => await fn()),
    debug: vi.fn(),
  },
}))

import { Locator } from '../element/by.js'
import { Element } from '../element/element.js'

describe('Element text editing', () => {
  beforeEach(() => {
    mockGetDriverClient.mockReset()
    mockGetActiveBundleId.mockReset()
    mockGetActiveBundleId.mockReturnValue('com.example.app')
  })

  it('focuses the element before clearing when it is not already focused', async () => {
    const client = {
      tap: vi.fn().mockResolvedValue(undefined),
      clearText: vi.fn().mockResolvedValue(undefined),
    }

    mockGetDriverClient.mockReturnValue(client)

    const element = new Element(new Locator('id', 'form-name'))
    vi.spyOn(element, 'resolve').mockResolvedValue({
      identifier: 'form-name',
      frame: { X: 10, Y: 20, Width: 100, Height: 40 },
      hasFocus: false,
    } as any)

    await element.clear()

    expect(client.tap).toHaveBeenCalledWith(60, 40)
    expect(client.clearText).toHaveBeenCalledWith({
      bundleId: 'com.example.app',
      identifier: 'form-name',
      x: 10,
      y: 20,
      width: 100,
      height: 40,
    })
  })

  it('skips the focus tap when the input already has focus', async () => {
    const client = {
      tap: vi.fn().mockResolvedValue(undefined),
      clearText: vi.fn().mockResolvedValue(undefined),
    }

    mockGetDriverClient.mockReturnValue(client)

    const element = new Element(new Locator('id', 'form-name'))
    vi.spyOn(element, 'resolve').mockResolvedValue({
      identifier: 'form-name',
      frame: { X: 10, Y: 20, Width: 100, Height: 40 },
      hasFocus: true,
    } as any)

    await element.clear()

    expect(client.tap).not.toHaveBeenCalled()
    expect(client.clearText).toHaveBeenCalledWith({
      bundleId: 'com.example.app',
      identifier: 'form-name',
      x: 10,
      y: 20,
      width: 100,
      height: 40,
    })
  })

  it('uses the native clear path before typing replacement text', async () => {
    const client = {
      tap: vi.fn().mockResolvedValue(undefined),
      clearText: vi.fn().mockResolvedValue(undefined),
      typeText: vi.fn().mockResolvedValue(undefined),
    }

    mockGetDriverClient.mockReturnValue(client)

    const element = new Element(new Locator('id', 'form-name'))
    vi.spyOn(element, 'resolve').mockResolvedValue({
      identifier: 'form-name',
      frame: { X: 0, Y: 0, Width: 120, Height: 44 },
      hasFocus: false,
    } as any)

    await element.replaceText('Alice')

    expect(client.clearText).toHaveBeenCalledWith({
      bundleId: 'com.example.app',
      identifier: 'form-name',
      x: 0,
      y: 0,
      width: 120,
      height: 44,
    })
    expect(client.typeText).toHaveBeenCalledWith('Alice')
  })

  it('allows clearing an already-empty field', async () => {
    const client = {
      tap: vi.fn().mockResolvedValue(undefined),
      clearText: vi.fn().mockResolvedValue(undefined),
    }

    mockGetDriverClient.mockReturnValue(client)

    const element = new Element(new Locator('id', 'form-name'))
    vi.spyOn(element, 'resolve').mockResolvedValue({
      identifier: 'form-name',
      frame: { X: 0, Y: 0, Width: 120, Height: 44 },
      hasFocus: true,
      value: undefined,
    } as any)

    await element.clear()

    expect(client.tap).not.toHaveBeenCalled()
    expect(client.clearText).toHaveBeenCalledWith({
      bundleId: 'com.example.app',
      identifier: 'form-name',
      x: 0,
      y: 0,
      width: 120,
      height: 44,
    })
  })

  it('surfaces driver clear failures', async () => {
    const client = {
      tap: vi.fn().mockResolvedValue(undefined),
      clearText: vi.fn().mockRejectedValue(new Error('focused element is not editable')),
    }

    mockGetDriverClient.mockReturnValue(client)

    const element = new Element(new Locator('id', 'form-name'))
    vi.spyOn(element, 'resolve').mockResolvedValue({
      identifier: 'form-name',
      frame: { X: 0, Y: 0, Width: 120, Height: 44 },
      hasFocus: true,
    } as any)

    await expect(element.clear()).rejects.toThrow('focused element is not editable')
  })
})
