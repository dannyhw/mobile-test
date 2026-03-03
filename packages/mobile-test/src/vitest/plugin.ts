import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { MobileTestConfig } from '../config.js'

/**
 * Find the mobile-test package root by walking up from this file
 * until we find package.json with name "mobile-test".
 */
function findPackageRoot(): string {
  let dir = dirname(new URL(import.meta.url).pathname)
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.name === 'mobile-test') return dir
      } catch {}
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('mobile-test: Could not find package root')
}

function resolveSetupFiles(packageRoot: string) {
  const srcVitest = join(packageRoot, 'src', 'vitest')
  const distVitest = join(packageRoot, 'dist', 'vitest')

  function resolveFile(name: string): string {
    const tsPath = join(srcVitest, `${name}.ts`)
    if (existsSync(tsPath)) return tsPath
    return join(distVitest, `${name}.js`)
  }

  return {
    setup: resolveFile('setup'),
    matchersSetup: resolveFile('matchers-setup'),
  }
}

export function mobileTestPlugin(config?: MobileTestConfig) {
  return {
    name: 'mobile-test',
    config() {
      if (config?.actionTimeout) {
        process.env.__MOBILE_TEST_ACTION_TIMEOUT = String(config.actionTimeout)
      }
      if (config?.screenshots?.updateBaselines || process.env.UPDATE_SCREENSHOTS === 'true') {
        process.env.UPDATE_SCREENSHOTS = 'true'
      }

      const packageRoot = findPackageRoot()
      const files = resolveSetupFiles(packageRoot)

      return {
        test: {
          globalSetup: [files.setup],
          setupFiles: [files.matchersSetup],
        },
      }
    },
  }
}
