import type { DeviceInfo } from '../device/types.js'
import type { CompareOptions } from './compare.js'
import type { Element } from '../element/element.js'
import { toFrame } from '../element/types.js'
import { getBackend } from '../backend/context.js'
import { saveLatest, baselineExists, saveBaseline, ensureDiffDir, resolveBaselinePath } from './baselines.js'
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
  const backend = getBackend()
  const screenshotsDir = options?.screenshotsDir

  // 1. Resolve mask elements (in points) before capturing so the frames match the shot
  const maskFrames = options?.mask && options.mask.length > 0
    ? await Promise.all(options.mask.map(async el => toFrame((await el.resolve()).frame)))
    : []
  const cropFrame = options?.cropElement
    ? toFrame((await options.cropElement.resolve()).frame)
    : undefined

  // 2. Take screenshot via backend (device pixels + scale)
  const shot = await backend.screenshot()
  let buffer = shot.png
  const scale = shot.scale

  let ignoreRegions = options?.ignoreRegions
  if (maskFrames.length > 0) {
    const maskRegions = maskFrames.map(frame => ({
      x1: Math.round(frame.x * scale),
      y1: Math.round(frame.y * scale),
      x2: Math.round((frame.x + frame.width) * scale),
      y2: Math.round((frame.y + frame.height) * scale),
    }))
    ignoreRegions = [...(ignoreRegions ?? []), ...maskRegions]
  }

  // 3. Crop to element bounds if requested
  if (cropFrame) {
    const { cropToFrame } = await import('./crop.js')
    buffer = await cropToFrame(buffer, cropFrame, scale)
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
