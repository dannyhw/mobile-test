import { defineConfig } from 'vitest/config'
import { mobileTestPlugin } from '../src/vitest/plugin.js'

export default defineConfig({
  plugins: [mobileTestPlugin({
    app: {
      ios: {
        bundleId: 'com.dannyhw.exampleapp',
        scheme: 'exampleapp',
      },
    },
  })],
  test: {
    include: ['e2e/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
