import { compare } from 'odiff-bin'

export interface ComparisonResult {
  match: boolean
  diffPercentage: number
  diffCount?: number
  diffPath?: string
  reason?: string
}

export interface CompareOptions {
  threshold?: number
  maxDiffPercentage?: number
  antialiasing?: boolean
  ignoreRegions?: Array<{ x1: number; y1: number; x2: number; y2: number }>
}

export async function compareScreenshots(
  baselinePath: string,
  currentPath: string,
  diffPath: string,
  options?: CompareOptions,
): Promise<ComparisonResult> {
  const odiffOptions: Record<string, unknown> = {
    threshold: options?.threshold ?? 0.1,
    antialiasing: options?.antialiasing ?? true,
    outputDiffMask: true,
    noFailOnFsErrors: true,
  }
  if (options?.ignoreRegions) {
    odiffOptions.ignoreRegions = options.ignoreRegions
  }
  const result = await compare(baselinePath, currentPath, diffPath, odiffOptions)

  if (result.match) {
    return { match: true, diffPercentage: 0 }
  }

  if (result.reason === 'pixel-diff') {
    const withinTolerance = (options?.maxDiffPercentage ?? 0) >= result.diffPercentage
    return {
      match: withinTolerance,
      diffPercentage: result.diffPercentage,
      diffCount: result.diffCount,
      diffPath,
      reason: withinTolerance ? undefined : `${result.diffPercentage.toFixed(2)}% pixels differ`,
    }
  }

  if (result.reason === 'layout-diff') {
    return {
      match: false,
      diffPercentage: 100,
      diffPath,
      reason: 'Images have different dimensions',
    }
  }

  if (result.reason === 'file-not-exists') {
    return {
      match: false,
      diffPercentage: 100,
      reason: `File not found: ${(result as any).file}`,
    }
  }

  return { match: false, diffPercentage: 100, reason: 'Unknown comparison error' }
}
