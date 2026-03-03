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

export interface Device extends DeviceInfo {
  launch(bundleId: string): Promise<void>
  terminate(bundleId: string): Promise<void>
  install(appPath: string): Promise<void>
  takeScreenshot(): Promise<Buffer>
  openUrl(url: string): Promise<void>
  waitForAnimationToEnd(options?: WaitForAnimationOptions): Promise<void>
  hideKeyboard(): Promise<void>
  pressHome(): Promise<void>
  setLocation(latitude: number, longitude: number): Promise<void>
}
