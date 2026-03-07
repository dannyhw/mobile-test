# Phase 3 Step 2: Android Driver Scaffold and Core Runtime

## Goal

Start Phase 3 milestone 2 from `../../plan/phase-3-android.md`: add an Android instrumentation driver project and host-side installer/runtime plumbing so we can boot an Android driver process and talk to the first core HTTP endpoints. Keep Android view-hierarchy normalization as a later step so this milestone stays focused on driver startup and the main command surface.

## Checklist

- [x] Review the Phase 3 plan and the existing iOS driver structure to mirror the right pieces instead of inventing a parallel architecture.
  References: `../../plan/phase-3-android.md`, `ios-driver/project.yml`, `ios-driver/build.sh`, `src/driver/installer.ts`, `src/driver/client.ts`, `src/driver/protocol.ts`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-client/src/main/java/maestro/drivers/AndroidDriver.kt`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-android/src/androidTest/java/dev/mobile/maestro/MaestroDriverService.kt`
- [ ] Scaffold `android-driver/` as a Kotlin/Gradle instrumentation project with debug-signable artifacts that can be built and shipped with the package.
  References: `android-driver/`, `ios-driver/`, `package.json`, `tsup.config.ts`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-android/build.gradle.kts`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/build.gradle.kts`
- [ ] Implement Android driver bootstrap code that starts an HTTP server inside instrumentation and exposes a basic readiness endpoint.
  References: `android-driver/...`, `ios-driver/DriverUITests/DriverServer.swift`, `ios-driver/DriverUITests/Handlers/StatusHandler.swift`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-android/src/androidTest/java/dev/mobile/maestro/MaestroDriverService.kt`
- [ ] Implement the first Android driver response models and core read endpoints: `/status`, `/deviceInfo`, and `/screenshot`.
  References: `src/driver/protocol.ts`, `ios-driver/DriverUITests/Models/StatusResponse.swift`, `ios-driver/DriverUITests/Models/DeviceInfoResponse.swift`, `ios-driver/DriverUITests/Handlers/DeviceInfoHandler.swift`, `ios-driver/DriverUITests/Handlers/ScreenshotHandler.swift`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-android/src/androidTest/java/dev/mobile/maestro/MaestroDriverService.kt`
- [ ] Implement the first Android driver action endpoints: `/tap`, `/swipe`, `/typeText`, `/launchApp`, and `/terminateApp`.
  References: `src/driver/protocol.ts`, `ios-driver/DriverUITests/Handlers/TapHandler.swift`, `ios-driver/DriverUITests/Handlers/SwipeHandler.swift`, `ios-driver/DriverUITests/Handlers/TypeTextHandler.swift`, `ios-driver/DriverUITests/Handlers/LaunchAppHandler.swift`, `ios-driver/DriverUITests/Handlers/TerminateAppHandler.swift`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-android/src/androidTest/java/dev/mobile/maestro/MaestroDriverService.kt`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-client/src/main/java/maestro/drivers/AndroidDriver.kt`
- [ ] Add Android driver install/start/stop support in the host runtime without changing the existing iOS path.
  References: `src/driver/installer.ts`, `src/vitest/setup.ts`, `src/device/android-device.ts`, `src/device/detect.ts`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-client/src/main/java/maestro/drivers/AndroidDriver.kt`
- [ ] Decide and document what is intentionally deferred from this step, especially Android `/viewHierarchy` normalization and broader cross-platform Vitest selection.
  References: `../../plan/phase-3-android.md`, `src/vitest/setup.ts`, `src/vitest/matchers-setup.ts`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-android/src/androidTest/java/dev/mobile/maestro/ViewHierarchy.kt`
- [ ] Add focused verification for the new host-side Android installer/runtime plumbing and run the relevant build/tests.
  References: `src/__tests__/`, `package.json`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-client/src/main/java/maestro/drivers/AndroidDriver.kt`
