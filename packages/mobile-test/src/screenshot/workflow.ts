import type { DeviceInfo } from '../device/types.js'
import type { CompareOptions, ComparisonResult } from './compare.js'
import { getDriverClient } from '../driver/context.js'
import { saveLatest, baselineExists, saveBaseline, updateBaseline, ensureDiffDir, resolveBaselinePath } from './baselines.js'
import { compareScreenshots } from './compare.js'

export interface TakeAndCompareOptions extends CompareOptions {
  screenshotsDir?: string
}

export interface ScreenshotResult {
  pass: boolean
  baselineCreated: boolean
  baselineUpdated: boolean
  diffPercentage: number
  diffPath?: string
  reason?: string
  latestPath: string
  baselinePath: string
}

export async function takeAndCompare(
  name: string,
  device: DeviceInfo,
  options?: TakeAndCompareOptions,
): Promise<ScreenshotResult> {
  const client = getDriverClient()
  const screenshotsDir = options?.screenshotsDir

  // 1. Take screenshot via driver
  const buffer = await client.screenshot()

  // 2. Save to latest/
  const latestPath = saveLatest(name, device, buffer, screenshotsDir)
  const baselinePath = resolveBaselinePath(name, device, screenshotsDir)

  // 3. If UPDATE_SCREENSHOTS is set, update baseline and return pass
  if (process.env.UPDATE_SCREENSHOTS === 'true') {
    saveBaseline(name, device, buffer, screenshotsDir)
    return {
      pass: true,
      baselineCreated: false,
      baselineUpdated: true,
      diffPercentage: 0,
      latestPath,
      baselinePath,
    }
  }

  // 4. If no baseline exists, save as baseline and return pass
  if (!baselineExists(name, device, screenshotsDir)) {
    saveBaseline(name, device, buffer, screenshotsDir)
    return {
      pass: true,
      baselineCreated: true,
      baselineUpdated: false,
      diffPercentage: 0,
      latestPath,
      baselinePath,
    }
  }

  // 5. Compare against baseline
  const diffPath = ensureDiffDir(name, device, screenshotsDir)
  const comparison = await compareScreenshots(baselinePath, latestPath, diffPath, {
    threshold: options?.threshold,
    maxDiffPercentage: options?.maxDiffPercentage,
    antialiasing: options?.antialiasing,
    ignoreRegions: options?.ignoreRegions,
  })

  return {
    pass: comparison.match,
    baselineCreated: false,
    baselineUpdated: false,
    diffPercentage: comparison.diffPercentage,
    diffPath: comparison.match ? undefined : comparison.diffPath,
    reason: comparison.reason,
    latestPath,
    baselinePath,
  }
}
