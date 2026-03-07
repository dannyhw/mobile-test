import { getIOSAppConfig } from '../config-context.js'
import type { LaunchOptions, OpenUrlOptions } from './types.js'

function normalizePath(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`Deep link path must start with "/". Received: ${path}`)
  }

  return path
}

function resolveDeepLinkUrl(
  options: OpenUrlOptions,
  defaults: ReturnType<typeof getIOSAppConfig>,
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
      throw new Error(
        'No iOS URL scheme configured. Configure app.ios.scheme or pass { scheme }.'
      )
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
    url: resolveDeepLinkUrl(options, defaults, { allowEmpty: true }),
  }
}

export function resolveOpenUrlConfig(input: string | OpenUrlOptions): string {
  const defaults = getIOSAppConfig()
  const options = typeof input === 'string' ? { url: input } : input
  return resolveDeepLinkUrl(options, defaults, { allowEmpty: false })!
}
