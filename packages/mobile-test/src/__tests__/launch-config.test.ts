import { beforeEach, describe, expect, it } from 'vitest'
import { setTestConfig } from '../config-context.js'
import { resolveLaunchConfig, resolveOpenUrlConfig } from '../device/launch-config.js'

describe('launch config resolution', () => {
  beforeEach(() => {
    setTestConfig({
      iosBundleId: undefined,
      iosScheme: undefined,
    })
  })

  it('uses configured bundle ID by default', () => {
    setTestConfig({ iosBundleId: 'com.example.app' })

    expect(resolveLaunchConfig()).toEqual({
      bundleId: 'com.example.app',
      url: undefined,
    })
  })

  it('lets a string bundle ID override config', () => {
    setTestConfig({ iosBundleId: 'com.example.app' })

    expect(resolveLaunchConfig('com.example.other')).toEqual({
      bundleId: 'com.example.other',
      url: undefined,
    })
  })

  it('composes a URL from configured scheme and structured path', () => {
    setTestConfig({
      iosBundleId: 'com.example.app',
      iosScheme: 'exampleapp',
    })

    expect(resolveLaunchConfig({ path: '/form' })).toEqual({
      bundleId: 'com.example.app',
      url: 'exampleapp:///form',
    })
  })

  it('lets an explicit scheme override config when composing a path URL', () => {
    setTestConfig({
      iosBundleId: 'com.example.app',
      iosScheme: 'exampleapp',
    })

    expect(resolveLaunchConfig({ scheme: 'otherapp', path: '/form' })).toEqual({
      bundleId: 'com.example.app',
      url: 'otherapp:///form',
    })
  })

  it('uses an explicit full URL as-is', () => {
    setTestConfig({ iosBundleId: 'com.example.app' })

    expect(resolveLaunchConfig({ url: 'otherapp://form' })).toEqual({
      bundleId: 'com.example.app',
      url: 'otherapp://form',
    })
  })

  it('throws when no bundle ID is configured or provided', () => {
    expect(() => resolveLaunchConfig()).toThrow(
      'No iOS bundle ID configured. Configure app.ios.bundleId or pass a bundle ID override.'
    )
  })

  it('throws when path is provided without a scheme', () => {
    setTestConfig({ iosBundleId: 'com.example.app' })

    expect(() => resolveLaunchConfig({ path: '/form' })).toThrow(
      'No iOS URL scheme configured. Configure app.ios.scheme or pass { scheme }.'
    )
  })

  it('throws when both url and path are provided', () => {
    setTestConfig({
      iosBundleId: 'com.example.app',
      iosScheme: 'exampleapp',
    })

    expect(() => resolveLaunchConfig({ url: 'exampleapp://form', path: '/form' })).toThrow(
      'Pass either "url" or "path" when opening a deep link, not both.'
    )
  })
})

describe('openUrl config resolution', () => {
  beforeEach(() => {
    setTestConfig({
      iosBundleId: undefined,
      iosScheme: undefined,
    })
  })

  it('accepts a full URL string without using config', () => {
    expect(resolveOpenUrlConfig('exampleapp://form')).toBe('exampleapp://form')
  })

  it('composes a full URL from path and configured scheme', () => {
    setTestConfig({ iosScheme: 'exampleapp' })

    expect(resolveOpenUrlConfig({ path: '/form' })).toBe('exampleapp:///form')
  })

  it('throws when a path is missing the leading slash', () => {
    setTestConfig({ iosScheme: 'exampleapp' })

    expect(() => resolveOpenUrlConfig({ path: 'form' })).toThrow(
      'Deep link path must start with "/". Received: form'
    )
  })
})
