import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetBackend } = vi.hoisted(() => ({
  mockGetBackend: vi.fn(),
}))

vi.mock('../backend/context.js', () => ({
  getBackend: mockGetBackend,
  getActiveBundleId: vi.fn(() => 'com.example.app'),
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

function fakeBackend(overrides: Record<string, unknown> = {}): Record<string, ReturnType<typeof vi.fn>> {
  return {
    tap: vi.fn().mockResolvedValue(undefined),
    clearText: vi.fn().mockResolvedValue(undefined),
    replaceText: vi.fn().mockResolvedValue(undefined),
    typeText: vi.fn().mockResolvedValue(undefined),
    keyboardVisible: vi.fn().mockResolvedValue(true),
    // Focus polling re-snapshots; an empty tree means "not focused yet" and
    // the keyboard check above ends the wait.
    snapshot: vi.fn().mockResolvedValue({ identifier: '', label: '', frame: {}, elementType: 0, enabled: true, selected: false, hasFocus: false, children: [] }),
    ...overrides,
  }
}

const handle = (extra: Record<string, unknown> = {}) => ({
  identifier: 'form-name',
  label: '',
  frame: { X: 10, Y: 20, Width: 100, Height: 40 },
  elementType: 0,
  enabled: true,
  selected: false,
  hasFocus: false,
  ...extra,
})

describe('Element text editing', () => {
  beforeEach(() => {
    mockGetBackend.mockReset()
  })

  it('focuses the element before clearing when it is not already focused', async () => {
    const backend = fakeBackend()
    mockGetBackend.mockReturnValue(backend)

    const element = new Element(new Locator('id', 'form-name'))
    const el = handle({ hasFocus: false, value: 'Alice' })
    vi.spyOn(element, 'resolve').mockResolvedValue(el as any)

    await element.clear()

    expect(backend.tap).toHaveBeenCalledWith(60, 40)
    expect(backend.clearText).toHaveBeenCalledWith(el)
  })

  it('skips the focus tap when the input already has focus', async () => {
    const backend = fakeBackend()
    mockGetBackend.mockReturnValue(backend)

    const element = new Element(new Locator('id', 'form-name'))
    const el = handle({ hasFocus: true, value: 'Alice' })
    vi.spyOn(element, 'resolve').mockResolvedValue(el as any)

    await element.clear()

    expect(backend.tap).not.toHaveBeenCalled()
    expect(backend.clearText).toHaveBeenCalledWith(el)
  })

  it('delegates replaceText to the backend after focusing', async () => {
    const backend = fakeBackend()
    mockGetBackend.mockReturnValue(backend)

    const element = new Element(new Locator('id', 'form-name'))
    const el = handle({ hasFocus: false })
    vi.spyOn(element, 'resolve').mockResolvedValue(el as any)

    await element.replaceText('Alice')

    expect(backend.tap).toHaveBeenCalledTimes(1)
    expect(backend.replaceText).toHaveBeenCalledWith(el, 'Alice')
  })

  it('types after tapping to focus', async () => {
    const backend = fakeBackend()
    mockGetBackend.mockReturnValue(backend)

    const element = new Element(new Locator('id', 'form-name'))
    vi.spyOn(element, 'resolve').mockResolvedValue(handle() as any)

    await element.type('Bob')

    expect(backend.tap).toHaveBeenCalledWith(60, 40)
    expect(backend.typeText).toHaveBeenCalledWith('Bob')
  })

  it('surfaces backend clear failures', async () => {
    const backend = fakeBackend({
      clearText: vi.fn().mockRejectedValue(new Error('focused element is not editable')),
    })
    mockGetBackend.mockReturnValue(backend)

    const element = new Element(new Locator('id', 'form-name'))
    vi.spyOn(element, 'resolve').mockResolvedValue(handle({ hasFocus: true }) as any)

    await expect(element.clear()).rejects.toThrow('focused element is not editable')
  })
})

describe('Element gestures', () => {
  beforeEach(() => {
    mockGetBackend.mockReset()
  })

  it('long press uses a hold duration in milliseconds', async () => {
    const backend = fakeBackend()
    mockGetBackend.mockReturnValue(backend)

    const element = new Element(new Locator('id', 'form-name'))
    vi.spyOn(element, 'resolve').mockResolvedValue(handle() as any)

    await element.longPress(1.5)

    expect(backend.tap).toHaveBeenCalledWith(60, 40, { durationMs: 1500 })
  })

  it('double tap passes the doubleTap flag', async () => {
    const backend = fakeBackend()
    mockGetBackend.mockReturnValue(backend)

    const element = new Element(new Locator('id', 'form-name'))
    vi.spyOn(element, 'resolve').mockResolvedValue(handle() as any)

    await element.doubleTap()

    expect(backend.tap).toHaveBeenCalledWith(60, 40, { doubleTap: true })
  })

  it('swipes inside the visible part of the element', async () => {
    const backend = fakeBackend({
      swipe: vi.fn().mockResolvedValue(undefined),
      viewport: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 400, height: 800 }),
    })
    mockGetBackend.mockReturnValue(backend)

    const element = new Element(new Locator('id', 'list'))
    vi.spyOn(element, 'resolve').mockResolvedValue(
      handle({ frame: { X: 0, Y: 100, Width: 400, Height: 1000 } }) as any,
    )

    await element.swipe('up')

    // Gesture frame is the element clipped to the inset viewport (24px margin):
    // x 24..376, y 100..776 → centerX 200, top 201.4, bottom 674.6
    expect(backend.swipe).toHaveBeenCalledTimes(1)
    const [from, to] = backend.swipe.mock.calls[0]
    expect(from.x).toBeCloseTo(200)
    expect(to.x).toBeCloseTo(200)
    expect(from.y).toBeGreaterThan(to.y)
    expect(from.y).toBeLessThanOrEqual(776)
    expect(to.y).toBeGreaterThanOrEqual(100)
  })
})

describe('Element resolution', () => {
  beforeEach(() => {
    mockGetBackend.mockReset()
  })

  const tree = {
    identifier: '',
    label: '',
    frame: { X: 0, Y: 0, Width: 400, Height: 800 },
    elementType: 0,
    enabled: true,
    selected: false,
    hasFocus: false,
    children: [
      { ...handle({ identifier: 'a', frame: { X: 0, Y: 0, Width: 100, Height: 100 } }) },
      { ...handle({ identifier: 'a', frame: { X: 0, Y: 900, Width: 100, Height: 100 } }) },
      { ...handle({ identifier: 'hidden', visibleToUser: false, frame: { X: 0, Y: 0, Width: 100, Height: 100 } }) },
    ],
  }

  it('atIndex resolves the nth match from the snapshot', async () => {
    const backend = fakeBackend({ snapshot: vi.fn().mockResolvedValue(tree) })
    mockGetBackend.mockReturnValue(backend)

    const second = await new Element(new Locator('id', 'a')).atIndex(1).resolve()
    expect(second.frame.Y).toBe(900)
  })

  it('isVisible ignores off-screen matches but accepts on-screen ones', async () => {
    const backend = fakeBackend({
      snapshot: vi.fn().mockResolvedValue(tree),
      viewport: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 400, height: 800 }),
    })
    mockGetBackend.mockReturnValue(backend)

    expect(await new Element(new Locator('id', 'a')).isVisible()).toBe(true)
    expect(await new Element(new Locator('id', 'a')).atIndex(1).exists()).toBe(true)
    expect(await new Element(new Locator('id', 'hidden')).isVisible()).toBe(false)
    expect(await new Element(new Locator('id', 'missing')).isVisible()).toBe(false)
  })

  it('resolve throws a helpful error after the timeout', async () => {
    const backend = fakeBackend({ snapshot: vi.fn().mockResolvedValue(tree) })
    mockGetBackend.mockReturnValue(backend)

    await expect(new Element(new Locator('id', 'missing')).resolve(50)).rejects.toThrow(
      /Element not found: by.id\(missing\) after 50ms/,
    )
  })
})
