import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { DeviceInfo } from '../device/types.js'

const DEFAULT_DIR = './screenshots'

function sanitizeDeviceName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '-')
}

export function resolveBaselinePath(name: string, device: DeviceInfo, screenshotsDir = DEFAULT_DIR): string {
  return join(screenshotsDir, 'baseline', sanitizeDeviceName(device.name), `${name}.png`)
}

export function resolveLatestPath(name: string, device: DeviceInfo, screenshotsDir = DEFAULT_DIR): string {
  return join(screenshotsDir, 'latest', sanitizeDeviceName(device.name), `${name}.png`)
}

export function resolveDiffPath(name: string, device: DeviceInfo, screenshotsDir = DEFAULT_DIR): string {
  return join(screenshotsDir, 'diff', sanitizeDeviceName(device.name), `${name}.png`)
}

export function saveLatest(name: string, device: DeviceInfo, buffer: Buffer, screenshotsDir = DEFAULT_DIR): string {
  const path = resolveLatestPath(name, device, screenshotsDir)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, buffer)
  return path
}

export function baselineExists(name: string, device: DeviceInfo, screenshotsDir = DEFAULT_DIR): boolean {
  return existsSync(resolveBaselinePath(name, device, screenshotsDir))
}

export function saveBaseline(name: string, device: DeviceInfo, buffer: Buffer, screenshotsDir = DEFAULT_DIR): string {
  const path = resolveBaselinePath(name, device, screenshotsDir)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, buffer)
  return path
}

export function updateBaseline(name: string, device: DeviceInfo, screenshotsDir = DEFAULT_DIR): void {
  const latestPath = resolveLatestPath(name, device, screenshotsDir)
  const baselinePath = resolveBaselinePath(name, device, screenshotsDir)
  mkdirSync(dirname(baselinePath), { recursive: true })
  copyFileSync(latestPath, baselinePath)
}

export function ensureDiffDir(name: string, device: DeviceInfo, screenshotsDir = DEFAULT_DIR): string {
  const path = resolveDiffPath(name, device, screenshotsDir)
  mkdirSync(dirname(path), { recursive: true })
  return path
}
