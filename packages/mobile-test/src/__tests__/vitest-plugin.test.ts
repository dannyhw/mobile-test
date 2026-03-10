import { describe, expect, it } from 'vitest'
import { mobileTestProjects } from '../vitest/plugin.js'

interface InlineProjectShape {
  test?: {
    name?: string
    include?: string[]
  }
  plugins?: unknown[]
}

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

    const [firstProject, secondProject] = projects as InlineProjectShape[]

    expect(projects).toHaveLength(2)
    expect(firstProject.test?.name).toBe('iphone-16')
    expect(firstProject.test?.include).toEqual(['e2e/**/*.test.ts'])
    expect(secondProject.test?.name).toBe('pixel-any')
    expect(secondProject.plugins).toHaveLength(1)
  })
})
