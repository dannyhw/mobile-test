import { describe, it, expect } from 'vitest'
import { defineConfig } from '../config.js'
import { createProvidedConfig, resolveProjectTarget } from '../vitest/context.js'

describe('defineConfig', () => {
  it('returns defaults when given empty config', () => {
    const config = defineConfig({})

    expect(config.timeout).toBe(30_000)
    expect(config.actionTimeout).toBe(5_000)
    expect(config.screenshots).toEqual({
      dir: './screenshots',
      threshold: 0.1,
      maxDiffPercentage: 0,
      antialiasing: true,
      updateBaselines: false,
    })
    expect(config.app).toEqual({})
    expect(config.projects).toBeUndefined()
  })

  it('preserves legacy iOS bundle ID overrides', () => {
    const config = defineConfig({
      app: { ios: 'com.example.app' },
      timeout: 60_000,
      screenshots: { threshold: 0.5, dir: './snaps' },
    })

    expect(config.app.ios).toEqual({ bundleId: 'com.example.app' })
    expect(config.timeout).toBe(60_000)
    expect(config.actionTimeout).toBe(5_000) // still default
    expect(config.screenshots.threshold).toBe(0.5)
    expect(config.screenshots.dir).toBe('./snaps')
    expect(config.screenshots.antialiasing).toBe(true) // still default
  })

  it('supports structured iOS app config', () => {
    const config = defineConfig({
      app: {
        ios: {
          bundleId: 'com.example.app',
          scheme: 'exampleapp',
        },
      },
    })

    expect(config.app.ios).toEqual({
      bundleId: 'com.example.app',
      scheme: 'exampleapp',
    })
  })

  it('preserves Android app config', () => {
    const config = defineConfig({
      app: {
        android: 'com.example.android',
      },
    })

    expect(config.app.android).toEqual({ appId: 'com.example.android' })
  })

  it('supports structured Android app config', () => {
    const config = defineConfig({
      app: {
        android: {
          appId: 'com.example.android',
          scheme: 'exampleapp',
        },
      },
    })

    expect(config.app.android).toEqual({
      appId: 'com.example.android',
      scheme: 'exampleapp',
    })
  })

  it('supports project targets', () => {
    const config = defineConfig({
      projects: [
        { name: 'iphone-16', platform: 'ios', device: 'iPhone 16' },
        { name: 'pixel-any', platform: 'android' },
      ],
    })

    expect(config.projects).toHaveLength(2)
    expect(config.projects![0]).toEqual({
      name: 'iphone-16',
      platform: 'ios',
      device: 'iPhone 16',
    })
    expect(config.projects![1]).toEqual({
      name: 'pixel-any',
      platform: 'android',
    })
  })

  it('defaults project platform to iOS to preserve the existing path', () => {
    const config = defineConfig({
      projects: [{ name: 'iphone-16', device: 'iPhone 16' }],
    })

    expect(config.projects).toEqual([
      {
        name: 'iphone-16',
        platform: 'ios',
        device: 'iPhone 16',
      },
    ])
  })
})

describe('project target resolution', () => {
  it('selects the matching configured project by Vitest project name', () => {
    const config = defineConfig({
      projects: [
        { name: 'iphone-16', platform: 'ios', device: 'iPhone 16' },
        { name: 'pixel-any', platform: 'android' },
      ],
    })

    const provided = createProvidedConfig(config)

    expect(resolveProjectTarget(provided, 'pixel-any')).toEqual({
      name: 'pixel-any',
      platform: 'android',
    })
  })

  it('selects the single configured project without an explicit project name', () => {
    const config = defineConfig({
      projects: [{ name: 'iphone-16', device: 'iPhone 16' }],
    })

    const provided = createProvidedConfig(config)

    expect(resolveProjectTarget(provided)).toEqual({
      name: 'iphone-16',
      platform: 'ios',
      device: 'iPhone 16',
    })
  })

  it('throws when multiple projects exist without a selected runtime project', () => {
    const config = defineConfig({
      projects: [
        { name: 'iphone-16', platform: 'ios', device: 'iPhone 16' },
        { name: 'pixel-any', platform: 'android' },
      ],
    })

    const provided = createProvidedConfig(config)

    expect(() => resolveProjectTarget(provided)).toThrow(
      'Multiple mobile-test projects are configured, but no project was selected.',
    )
  })
})
