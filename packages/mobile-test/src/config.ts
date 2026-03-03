export interface AppConfig {
  ios?: string
  android?: string
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
  app: AppConfig
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
  return {
    app: config.app ?? {},
    projects: config.projects,
    screenshots: { ...defaults.screenshots, ...config.screenshots },
    timeout: config.timeout ?? defaults.timeout,
    actionTimeout: config.actionTimeout ?? defaults.actionTimeout,
    logLevel: config.logLevel ?? 'info',
  }
}
