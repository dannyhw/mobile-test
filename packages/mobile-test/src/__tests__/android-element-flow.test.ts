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

import { by } from '../element/by.js'
import { element } from '../element/element.js'
import { normalizeAndroidViewHierarchy } from '../driver/android-view-hierarchy.js'

const sampleHierarchy = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" package="com.example.app" class="android.widget.FrameLayout" bounds="[0,0][1080,2400]" clickable="false" enabled="true" focused="false" selected="false">
    <node index="0" package="com.example.app" class="android.widget.TextView" text="1" resource-id="com.example.app:id/counter" bounds="[80,220][280,300]" clickable="false" enabled="true" focused="false" selected="false" />
    <node index="1" package="com.example.app" class="android.widget.Button" text="Increment" resource-id="com.example.app:id/click-button" bounds="[80,340][420,460]" clickable="true" enabled="true" focused="false" selected="false" />
  </node>
</hierarchy>`

describe('Android element flow', () => {
  beforeEach(() => {
    mockGetDriverClient.mockReset()
    mockGetActiveBundleId.mockReset()
    mockGetActiveBundleId.mockReturnValue('com.example.app')
  })

  it('resolves an Android hierarchy by id and taps the matching element', async () => {
    const hierarchy = normalizeAndroidViewHierarchy(sampleHierarchy, 'com.example.app')
    const client = {
      viewHierarchy: vi.fn().mockResolvedValue(hierarchy),
      tap: vi.fn().mockResolvedValue(undefined),
      deviceInfo: vi.fn().mockResolvedValue({
        widthPoints: 1080,
        heightPoints: 2400,
        widthPixels: 1080,
        heightPixels: 2400,
        scale: 1,
      }),
    }

    mockGetDriverClient.mockReturnValue(client)

    await element(by.id('click-button')).tap()

    expect(client.viewHierarchy).toHaveBeenCalledWith('com.example.app')
    expect(client.tap).toHaveBeenCalledWith(250, 400)
  })
})
