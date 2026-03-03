/// <reference types="vitest" />

import type { Element } from './dist/element/element.js'

export interface ScreenshotOptions {
  threshold?: number
  maxDiffPercentage?: number
  antialiasing?: boolean
  screenshotsDir?: string
  ignoreRegions?: Array<{ x1: number; y1: number; x2: number; y2: number }>
  mask?: Element[]
}

export interface MobileTestMatchers {
  toBeVisible(): Promise<void>
  toHaveText(expected: string): Promise<void>
  toMatchScreenshot(name: string, options?: ScreenshotOptions): Promise<void>
  toBeEnabled(): Promise<void>
  toHaveValue(expected: string): Promise<void>
}

declare module 'vitest' {
  interface Assertion<T = any> extends MobileTestMatchers {}
  interface AsymmetricMatchersContaining extends MobileTestMatchers {}
}
