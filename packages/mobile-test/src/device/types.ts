export interface DeviceInfo {
  name: string
  udid: string
  platform: 'ios' | 'android'
}

export interface Device extends DeviceInfo {
  launch(bundleId: string): Promise<void>
  terminate(bundleId: string): Promise<void>
  install(appPath: string): Promise<void>
  takeScreenshot(): Promise<Buffer>
  openUrl(url: string): Promise<void>
}
