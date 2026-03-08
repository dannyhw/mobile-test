import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../logger.js', () => ({
  log: {
    time: vi.fn(async (_label: string, fn: () => unknown) => await fn()),
  },
}))

import { DriverClient } from '../driver/client.js'
import { normalizeAndroidViewHierarchy } from '../driver/android-view-hierarchy.js'

const sampleHierarchy = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" package="com.android.systemui" class="android.widget.FrameLayout" bounds="[0,0][1080,80]" clickable="false" enabled="true" focused="false" selected="false">
    <node index="0" package="com.android.systemui" class="android.widget.TextView" text="12:30" bounds="[40,20][160,60]" clickable="false" enabled="true" focused="false" selected="false" />
  </node>
  <node index="1" package="com.example.app" class="android.widget.FrameLayout" bounds="[0,80][1080,2400]" clickable="false" enabled="true" focused="false" selected="false">
    <node index="0" package="com.example.app" class="android.widget.TextView" text="1" resource-id="com.example.app:id/counter" bounds="[80,220][280,300]" clickable="false" enabled="true" focused="false" selected="false" />
    <node index="1" package="com.example.app" class="android.widget.Button" text="Increment" resource-id="com.example.app:id/click-button" bounds="[80,340][420,460]" clickable="true" enabled="true" focused="false" selected="false" />
  </node>
</hierarchy>`

describe('normalizeAndroidViewHierarchy', () => {
  it('maps Android XML attributes into the shared element shape', () => {
    const hierarchy = normalizeAndroidViewHierarchy(sampleHierarchy, 'com.example.app')

    expect(hierarchy.elementType).toBe(47)
    expect(hierarchy.frame).toEqual({ X: 0, Y: 80, Width: 1080, Height: 2320 })
    expect(hierarchy.children).toHaveLength(2)
    expect(hierarchy.children?.[0]).toMatchObject({
      identifier: 'counter',
      label: '1',
      value: '1',
      elementType: 9,
    })
    expect(hierarchy.children?.[1]).toMatchObject({
      identifier: 'click-button',
      label: 'Increment',
      value: 'Increment',
      elementType: 48,
      enabled: true,
    })
  })
})

describe('DriverClient.viewHierarchy', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('normalizes Android XML responses before returning them to callers', async () => {
    fetchMock.mockResolvedValue(
      new Response(sampleHierarchy, {
        status: 200,
        headers: { 'content-type': 'application/xml; charset=utf-8' },
      }),
    )

    const client = new DriverClient('http://localhost:22087')
    const hierarchy = await client.viewHierarchy('com.example.app')

    expect(hierarchy.children?.[1]?.identifier).toBe('click-button')
    expect(hierarchy.children?.[1]?.frame).toEqual({ X: 80, Y: 340, Width: 340, Height: 120 })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:22087/viewHierarchy?bundleId=com.example.app',
    )
  })
})
