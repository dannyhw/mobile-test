export interface IOSAppConfig {
  bundleId?: string
  scheme?: string
}

export interface AndroidAppConfig {
  appId?: string
  scheme?: string
}

export interface AppConfig {
  ios?: string | IOSAppConfig
  android?: string | AndroidAppConfig
}

export interface ResolvedAppConfig {
  ios?: IOSAppConfig
  android?: AndroidAppConfig
}

export interface ProjectConfig {
  name: string
  device: string
}

export interface ScreenshotConfig {
  dir?: string
  threshold?: number
  maxDiffPercentage?: number
  antialiasing?: boolean
  updateBaselines?: boolean
}

export interface MobileTestConfig {
  app?: AppConfig
  projects?: ProjectConfig[]
  screenshots?: ScreenshotConfig
  timeout?: number
  actionTimeout?: number
  logLevel?: 'silent' | 'info' | 'debug'
}

export interface ResolvedConfig extends Required<Omit<MobileTestConfig, 'app' | 'projects' | 'screenshots' | 'logLevel'>> {
  app: ResolvedAppConfig
  projects?: ProjectConfig[]
  screenshots: Required<ScreenshotConfig>
  logLevel: 'silent' | 'info' | 'debug'
}

const defaults = {
  timeout: 30_000,
  actionTimeout: 5_000,
  screenshots: {
    dir: './screenshots',
    threshold: 0.1,
    maxDiffPercentage: 0,
    antialiasing: true,
    updateBaselines: false,
  },
} as const

export function defineConfig(config: MobileTestConfig): ResolvedConfig {
  const app: ResolvedAppConfig = {}
  const iosConfig = config.app?.ios
  if (typeof iosConfig === 'string') {
    app.ios = { bundleId: iosConfig }
  } else if (iosConfig) {
    app.ios = { ...iosConfig }
  }
  const androidConfig = config.app?.android
  if (typeof androidConfig === 'string') {
    app.android = { appId: androidConfig }
  } else if (androidConfig) {
    app.android = { ...androidConfig }
  }

  return {
    app,
    projects: config.projects,
    screenshots: { ...defaults.screenshots, ...config.screenshots },
    timeout: config.timeout ?? defaults.timeout,
    actionTimeout: config.actionTimeout ?? defaults.actionTimeout,
    logLevel: config.logLevel ?? 'info',
  }
}
