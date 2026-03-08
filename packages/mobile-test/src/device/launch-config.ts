import { getAndroidAppConfig, getIOSAppConfig } from '../config-context.js'
import type { LaunchOptions, OpenUrlOptions } from './types.js'

function normalizePath(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`Deep link path must start with "/". Received: ${path}`)
  }

  return path
}

function resolveDeepLinkUrl(
  options: OpenUrlOptions,
  defaults: { scheme?: string },
  missingSchemeMessage: string,
  { allowEmpty }: { allowEmpty: boolean },
): string | undefined {
  if (options.url && options.path) {
    throw new Error('Pass either "url" or "path" when opening a deep link, not both.')
  }

  if (options.url) {
    return options.url
  }

  if (options.path) {
    const scheme = options.scheme ?? defaults.scheme
    if (!scheme) {
      throw new Error(missingSchemeMessage)
    }

    return `${scheme}://${normalizePath(options.path)}`
  }

  if (allowEmpty) {
    return undefined
  }

  throw new Error('No deep link target provided. Pass { url } or { path }.')
}

export function resolveLaunchConfig(
  input?: string | LaunchOptions,
): { bundleId: string, url?: string } {
  const defaults = getIOSAppConfig()
  const options = typeof input === 'string' ? { bundleId: input } : (input ?? {})
  const bundleId = options.bundleId ?? defaults.bundleId

  if (!bundleId) {
    throw new Error(
      'No iOS bundle ID configured. Configure app.ios.bundleId or pass a bundle ID override.'
    )
  }

  return {
    bundleId,
    url: resolveDeepLinkUrl(
      options,
      defaults,
      'No iOS URL scheme configured. Configure app.ios.scheme or pass { scheme }.',
      { allowEmpty: true },
    ),
  }
}

export function resolveOpenUrlConfig(input: string | OpenUrlOptions): string {
  const defaults = getIOSAppConfig()
  const options = typeof input === 'string' ? { url: input } : input
  return resolveDeepLinkUrl(
    options,
    defaults,
    'No iOS URL scheme configured. Configure app.ios.scheme or pass { scheme }.',
    { allowEmpty: false },
  )!
}

export function resolveAndroidLaunchConfig(
  input?: string | LaunchOptions,
): { bundleId: string, url?: string } {
  const defaults = getAndroidAppConfig()
  const options = typeof input === 'string' ? { bundleId: input } : (input ?? {})
  const bundleId = options.bundleId ?? defaults.appId

  if (!bundleId) {
    throw new Error(
      'No Android app ID configured. Configure app.android or pass a bundle ID override.'
    )
  }

  return {
    bundleId,
    url: resolveDeepLinkUrl(
      options,
      defaults,
      'No Android URL scheme configured. Configure app.android.scheme or pass a full URL / { scheme }.',
      { allowEmpty: true },
    ),
  }
}

export function resolveAndroidOpenUrlConfig(input: string | OpenUrlOptions): string {
  const defaults = getAndroidAppConfig()
  const options = typeof input === 'string' ? { url: input } : input
  return resolveDeepLinkUrl(
    options,
    defaults,
    'No Android URL scheme configured. Configure app.android.scheme or pass a full URL / { scheme }.',
    { allowEmpty: false },
  )!
}
