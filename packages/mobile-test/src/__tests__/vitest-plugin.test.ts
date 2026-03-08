import { describe, expect, it } from 'vitest'
import { mobileTestProjects } from '../vitest/plugin.js'

describe('mobileTestProjects', () => {
  it('creates one Vitest project per configured runtime target', () => {
    const projects = mobileTestProjects(
      {
        app: {
          ios: { bundleId: 'com.example.ios' },
          android: { appId: 'com.example.android' },
        },
        projects: [
          { name: 'iphone-16', platform: 'ios', device: 'iPhone 16' },
          { name: 'pixel-any', platform: 'android' },
        ],
      },
      {
        include: ['e2e/**/*.test.ts'],
        testTimeout: 60_000,
      },
    )

    expect(projects).toHaveLength(2)
    expect(projects?.[0]?.test?.name).toBe('iphone-16')
    expect(projects?.[0]?.test?.include).toEqual(['e2e/**/*.test.ts'])
    expect(projects?.[1]?.test?.name).toBe('pixel-any')
    expect(projects?.[1]?.plugins).toHaveLength(1)
  })
})
