import { defineConfig } from 'vitest/config'
import { defineConfig as defineMobileTestConfig, mobileTestProjects } from '../src/index.js'

const mobileTest = defineMobileTestConfig({
  app: {
    ios: {
      bundleId: 'com.dannyhw.exampleapp',
      scheme: 'exampleapp',
    },
    android: {
      appId: 'com.dannyhw.exampleapp',
      scheme: 'exampleapp',
    },
  },
  projects: [
    { name: 'ios-simulator', platform: 'ios', device: 'iPhone 16' },
    { name: 'android-emulator', platform: 'android' },
  ],
})

export default defineConfig({
  test: {
    projects: mobileTestProjects(mobileTest, {
      include: ['e2e/**/*.test.ts'],
      testTimeout: 60_000,
      hookTimeout: 60_000,
    }),
  },
})
