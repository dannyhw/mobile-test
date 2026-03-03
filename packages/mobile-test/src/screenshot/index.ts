export { compareScreenshots, type ComparisonResult, type CompareOptions } from './compare.js'
export { takeAndCompare, type TakeAndCompareOptions, type ScreenshotResult } from './workflow.js'
export {
  resolveBaselinePath,
  resolveLatestPath,
  resolveDiffPath,
  saveLatest,
  saveBaseline,
  updateBaseline,
  baselineExists,
  ensureDiffDir,
} from './baselines.js'
export { normalizeStatusBar, resetStatusBar } from './normalize.js'
