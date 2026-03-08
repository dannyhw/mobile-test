import type { ResolvedConfig, ResolvedProjectConfig } from '../config.js'

export interface MobileTestProvidedConfig {
  actionTimeout: number
  logLevel: 'silent' | 'info' | 'debug'
  screenshotsDir: string
  iosBundleId?: string
  iosScheme?: string
  androidAppId?: string
  androidScheme?: string
  projects: ResolvedProjectConfig[]
  projectName?: string
}

export interface MobileTestRuntimeContext {
  port: number
  deviceName: string
  deviceUdid: string
  platform: 'ios' | 'android'
}

export function createProvidedConfig(
  config: ResolvedConfig,
  projectName?: string,
): MobileTestProvidedConfig {
  return {
    actionTimeout: config.actionTimeout,
    logLevel: config.logLevel,
    screenshotsDir: config.screenshots.dir,
    iosBundleId: config.app.ios?.bundleId,
    iosScheme: config.app.ios?.scheme,
    androidAppId: config.app.android?.appId,
    androidScheme: config.app.android?.scheme,
    projects: config.projects ?? [],
    projectName,
  }
}

export function resolveProjectTarget(
  config: MobileTestProvidedConfig,
  vitestProjectName?: string,
): ResolvedProjectConfig | undefined {
  if (config.projects.length === 0) {
    return undefined
  }

  const requestedName = config.projectName ?? vitestProjectName
  if (requestedName) {
    const project = config.projects.find(candidate => candidate.name === requestedName)
    if (!project) {
      throw new Error(
        `mobile-test: Unknown project "${requestedName}". ` +
        `Available projects: ${config.projects.map(project => project.name).join(', ')}.`
      )
    }
    return project
  }

  if (config.projects.length === 1) {
    return config.projects[0]
  }

  throw new Error(
    'mobile-test: Multiple mobile-test projects are configured, but no project was selected.\n\n' +
    'Use a matching Vitest project name or pass mobileTestPlugin(config, { projectName }).'
  )
}
