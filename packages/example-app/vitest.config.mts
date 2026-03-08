/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import { mobileTestPlugin } from "mobile-test";

export default defineConfig({
  plugins: [
    mobileTestPlugin({
      app: {
        ios: {
          bundleId: "com.dannyhw.exampleapp",
          scheme: "exampleapp",
        },
        android: {
          appId: "com.dannyhw.exampleapp",
          scheme: "exampleapp",
        },
      },
      logLevel: "debug",
      screenshots: { dir: "./.screenshots" },
    }),
  ],
  test: {
    include: ["e2e/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
