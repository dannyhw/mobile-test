import type { MobileTestProvidedConfig, MobileTestRuntimeContext } from './context.js'

declare module 'vitest' {
  export interface ProvidedContext {
    __mobileTestConfig: MobileTestProvidedConfig
    __mobileTestRuntime: MobileTestRuntimeContext
  }
}
