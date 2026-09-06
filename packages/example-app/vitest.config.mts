/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import {
  defineConfig as defineMobileTestConfig,
  mobileTestProjects,
} from "mobile-test";

const mobileTest = defineMobileTestConfig({
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
  projects: [
    {
      name: "ios-simulator",
      platform: "ios",
      device: "iPhone 17",
    },
    {
      name: "android-emulator",
      platform: "android",
    },
  ],
  logLevel: "debug",
  screenshots: {
    dir: "./.screenshots",
    // Release and Debug builds render a handful of pixels differently
    // (font hinting); allow that so the same baselines serve both.
    maxDiffPercentage: 0.01,
  },
});

export default defineConfig({
  test: {
    projects: mobileTestProjects(mobileTest, {
      include: ["e2e/**/*.test.ts"],
      testTimeout: 60_000,
      hookTimeout: 60_000,
      fileParallelism: false,
    }),
  },
});
