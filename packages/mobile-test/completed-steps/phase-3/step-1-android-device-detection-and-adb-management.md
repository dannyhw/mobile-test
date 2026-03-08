# Phase 3 Step 1: Android Device Detection and ADB Management

## Goal

Implement the first Phase 3 milestone from `../../plan/phase-3-android.md`: add Android device discovery and a concrete `AndroidDevice` with ADB-backed lifecycle helpers, without changing the existing iOS-first Vitest runner flow yet.

## Checklist

- [x] Review the current iOS device/runtime flow to keep Phase 3 Step 1 scoped to M1 only.
  References: `src/device/detect.ts`, `src/device/ios-device.ts`, `src/vitest/setup.ts`, `src/vitest/matchers-setup.ts`
- [x] Add Android app config plumbing for runtime defaults.
  References: `src/config-context.ts`, `src/vitest/plugin.ts`, `src/__tests__/config.test.ts`
- [x] Add Android launch/open-url resolution helpers alongside the existing iOS helpers.
  References: `src/device/launch-config.ts`, `src/__tests__/launch-config.test.ts`
- [x] Implement Android device discovery via `adb devices -l`.
  References: `src/device/detect.ts`, `src/__tests__/detect.test.ts`
- [x] Add `src/device/android-device.ts` with ADB-backed install, launch, terminate, screenshot, deep-link, keyboard, home, animation wait, and location helpers.
  References: `src/device/android-device.ts`, `src/__tests__/android-device.test.ts`
- [x] Export and verify the new Android device implementation without regressing iOS.
  References: `src/index.ts`, `src/__tests__/ios-device.test.ts`
- [x] Build and test `packages/mobile-test`, then update this checklist with the verified status.
  References: `package.json`

## Verification

- [x] `bun run build`
- [x] `bun run test`
