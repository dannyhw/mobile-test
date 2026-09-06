export { device } from './device/index.js'
export { setDevice } from './device/index.js'
export { BackendDevice } from './device/backend-device.js'
export { element } from './element/element.js'
export { by } from './element/by.js'
export { defineConfig } from './config.js'
export { mobileTestPlugin, mobileTestProjects } from './vitest/plugin.js'

export type { Device, DeviceInfo, LaunchOptions, OpenUrlOptions, WaitForAnimationOptions } from './device/types.js'
export type {
  IOSAppConfig,
  MobileTestConfig,
  ProjectConfig,
  ResolvedConfig,
  ResolvedProjectConfig,
  ResolvedScreenshotConfig,
  ScreenshotConfig,
} from './config.js'
export type { Locator } from './element/by.js'
export type { Element } from './element/element.js'
export type { ElementHandle, Frame } from './element/types.js'
export type { CompareOptions, ComparisonResult } from './screenshot/compare.js'
export { takeAndCompare, type TakeAndCompareOptions, type ScreenshotResult } from './screenshot/workflow.js'
export { normalizeStatusBar, resetStatusBar } from './screenshot/normalize.js'
export { AgentDeviceBackend, listAgentDevices } from './backend/agent-device.js'
export type { AgentDeviceBackendOptions, AgentDeviceListedDevice } from './backend/agent-device.js'
export { setBackend, getBackend, setActiveBundleId, getActiveBundleId } from './backend/context.js'
export { BackendUnsupportedError } from './backend/types.js'
export type { Backend, BackendDeviceInfo, ScreenshotCapture, ScreenshotOptions, Platform } from './backend/types.js'
export { snapshotToTree } from './backend/snapshot-tree.js'
export type { FlatSnapshotNode } from './backend/snapshot-tree.js'
export { setTestConfig } from './config-context.js'
export { log, setLogLevel } from './logger.js'
export type { LogLevel } from './logger.js'
