import type { DeviceInfo } from '../device/types.js'
import type { CompareOptions, ComparisonResult } from './compare.js'
import type { Element } from '../element/element.js'
import { toFrame } from '../element/types.js'
import { getDriverClient } from '../driver/context.js'
import { saveLatest, baselineExists, saveBaseline, updateBaseline, ensureDiffDir, resolveBaselinePath } from './baselines.js'
import { compareScreenshots } from './compare.js'

export interface TakeAndCompareOptions extends CompareOptions {
  screenshotsDir?: string
  mask?: Element[]
  cropElement?: Element
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

  // 1. Resolve mask elements to ignoreRegions
  let ignoreRegions = options?.ignoreRegions
  if (options?.mask && options.mask.length > 0) {
    const deviceInfoResp = await client.deviceInfo()
    const scale = deviceInfoResp.scale
    const maskRegions = await Promise.all(
      options.mask.map(async (el) => {
        const handle = await el.resolve()
        const frame = toFrame(handle.frame)
        return {
          x1: Math.round(frame.x * scale),
          y1: Math.round(frame.y * scale),
          x2: Math.round((frame.x + frame.width) * scale),
          y2: Math.round((frame.y + frame.height) * scale),
        }
      })
    )
    ignoreRegions = [...(ignoreRegions ?? []), ...maskRegions]
  }

  // 2. Take screenshot via driver
  let buffer = await client.screenshot()

  // 3. Crop to element bounds if requested
  if (options?.cropElement) {
    const { cropToFrame } = await import('./crop.js')
    const deviceInfoResp = await client.deviceInfo()
    const handle = await options.cropElement.resolve()
    const frame = toFrame(handle.frame)
    buffer = await cropToFrame(buffer, frame, deviceInfoResp.scale)
  }

  // 4. Save to latest/
  const latestPath = saveLatest(name, device, buffer, screenshotsDir)
  const baselinePath = resolveBaselinePath(name, device, screenshotsDir)

  // 5. If UPDATE_SCREENSHOTS is set, update baseline and return pass
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

  // 6. If no baseline exists, save as baseline and return pass
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

  // 7. Compare against baseline
  const diffPath = ensureDiffDir(name, device, screenshotsDir)
  const comparison = await compareScreenshots(baselinePath, latestPath, diffPath, {
    threshold: options?.threshold,
    maxDiffPercentage: options?.maxDiffPercentage,
    antialiasing: options?.antialiasing,
    ignoreRegions,
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
