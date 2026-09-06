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

import { by } from '../element/by.js'
import { element } from '../element/element.js'
import { snapshotToTree } from '../backend/snapshot-tree.js'

describe('Android element flow', () => {
  beforeEach(() => {
    mockGetBackend.mockReset()
  })

  it('resolves an agent-device Android snapshot by id and role and taps in device pixels', async () => {
    // Android rects and taps are both in device pixels (scale 1).
    const tree = snapshotToTree([
      { index: 0, type: 'android.widget.FrameLayout', rect: { x: 0, y: 0, width: 1080, height: 2400 } },
      { index: 1, parentIndex: 0, type: 'android.widget.TextView', identifier: 'counter', label: '1', rect: { x: 80, y: 220, width: 200, height: 80 } },
      { index: 2, parentIndex: 0, type: 'android.widget.Button', identifier: 'click-button', label: 'Increment', rect: { x: 80, y: 340, width: 340, height: 120 } },
    ])
    const backend = {
      snapshot: vi.fn().mockResolvedValue(tree),
      tap: vi.fn().mockResolvedValue(undefined),
    }
    mockGetBackend.mockReturnValue(backend)

    await element(by.id('click-button')).tap()
    await element(by.role('android.widget.button')).tap()
    await element(by.text('Increment')).tap()

    expect(backend.snapshot).toHaveBeenCalledTimes(3)
    expect(backend.tap).toHaveBeenNthCalledWith(1, 250, 400)
    expect(backend.tap).toHaveBeenNthCalledWith(2, 250, 400)
    expect(backend.tap).toHaveBeenNthCalledWith(3, 250, 400)
  })
})
