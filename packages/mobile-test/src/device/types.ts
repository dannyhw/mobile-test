export interface DeviceInfo {
  name: string
  udid: string
  platform: 'ios' | 'android'
}

export interface WaitForAnimationOptions {
  timeout?: number
  threshold?: number
  interval?: number
}

export interface OpenUrlOptions {
  path?: string
  scheme?: string
  url?: string
}

export interface LaunchOptions extends OpenUrlOptions {
  bundleId?: string
}

export interface Device extends DeviceInfo {
  launch(bundleIdOrOptions?: string | LaunchOptions): Promise<void>
  terminate(bundleId: string): Promise<void>
  install(appPath: string): Promise<void>
  takeScreenshot(): Promise<Buffer>
  openUrl(target: string | OpenUrlOptions): Promise<void>
  waitForAnimationToEnd(options?: WaitForAnimationOptions): Promise<void>
  hideKeyboard(): Promise<void>
  pressHome(): Promise<void>
  setLocation(latitude: number, longitude: number): Promise<void>
}
