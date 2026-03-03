# Step 2: iOS Driver — HTTP Server + Screenshot (M2)

> Goal: A Swift XCTest UI test bundle that starts an HTTP server on the simulator, responds to health checks, returns device info, and takes screenshots.

## References

- `../Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/maestro_driver_iosUITests.swift` — XCTest entry point
- `../Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/XCTestHTTPServer.swift` — HTTP server + routing
- `../Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/Handlers/ScreenshotHandler.swift` — screenshot capture
- `../Maestro/maestro-ios-xctest-runner/MaestroDriverLib/Package.swift` — FlyingFox dependency
- `../Maestro/maestro-ios-xctest-runner/build-maestro-ios-runner.sh` — build script
- `../Maestro/maestro-ios-xctest-runner/run-maestro-ios-runner.sh` — run script
- `../Maestro/maestro-ios-driver/src/main/kotlin/xcuitest/installer/LocalXCTestInstaller.kt` — install + start flow

## Checklist

### 2.1 Study Maestro's iOS driver structure
- [x] Read Maestro's XCTest entry point, HTTP server, and build scripts
- [x] Read Maestro's Package.swift / xcodeproj to understand how FlyingFox is integrated
- [x] Read Maestro's installer to understand how the driver is installed and started on the simulator
- [x] Document key findings/decisions in `../research/ios-driver-notes.md`

### 2.2 Create Xcode project structure
- [x] Create `ios-driver/` directory in mobile-test
- [x] Set up Xcode project with a minimal shell app target (DriverApp)
- [x] Set up UI test bundle target (Driver) that depends on the shell app
- [x] Add FlyingFox as a Swift Package dependency
- [x] Verify project builds with `xcodebuild build-for-testing`

### 2.3 XCTest entry point
- [x] Create `DriverTests.swift` — XCTestCase subclass that starts the HTTP server
- [x] Server runs on port 22087 (default)
- [x] Test method blocks (keeps server alive) via `server.run()` which never returns
- [x] Verify: `xcodebuild test-without-building` starts the server

### 2.4 HTTP server + routing
- [x] Create `DriverServer.swift` using FlyingFox's `HTTPServer`
- [x] Register route handlers for: `/status`, `/deviceInfo`, `/screenshot`
- [x] Return JSON responses with proper content types
- [x] Handle errors gracefully (return error JSON via AppError, don't crash)

### 2.5 Implement GET /status
- [x] Return `{ "status": "ready" }` as health check
- [x] Verified: TS side polls this to know the driver is up

### 2.6 Implement GET /deviceInfo
- [x] Return `{ "widthPoints", "heightPoints", "widthPixels", "heightPixels", "scale" }` from `UIScreen.main`

### 2.7 Implement GET /screenshot
- [x] Capture screenshot via `XCUIScreen.main.screenshot().pngRepresentation`
- [x] Return raw PNG bytes with `Content-Type: image/png`
- [x] Verified: screenshot is a valid PNG (1206x2622 pixels)

### 2.8 Build script
- [x] Create `ios-driver/build.sh` that runs `xcodebuild build-for-testing`
- [x] Output artifacts to `dist/ios-driver/` preserving Debug-iphonesimulator/ structure
- [x] Script works from a clean checkout
- [x] Artifacts: DriverApp.app, DriverUITests-Runner.app, MobileTestDriver.xctestrun, PackageFrameworks/

### 2.9 TypeScript driver lifecycle (install + start)
- [x] Start the XCTest runner via `xcodebuild test-without-building` (xcodebuild handles install)
- [x] Implement `waitForDriverReady()` — poll `GET /status` every 500ms, 120s timeout
- [x] Handle teardown — kill the xcodebuild process on test suite end
- [x] Artifacts path resolved from package root dist/ios-driver/
- [x] Updated `src/vitest/setup.ts` to use the driver lifecycle

### 2.10 Integration test
- [x] `scripts/test-driver.ts` — detects simulator, launches driver, hits all endpoints
- [x] Verified screenshot is a valid PNG with expected dimensions
- [x] Verified /deviceInfo returns correct screen metrics
- [x] Verified /status returns `{ "status": "ready" }`

## Done when

- [x] `xcodebuild test-without-building` starts the driver on a booted simulator
- [x] `GET /status` returns `{ "status": "ready" }`
- [x] `GET /deviceInfo` returns screen dimensions
- [x] `GET /screenshot` returns a valid PNG
- [x] TypeScript can start, poll, and screenshot via the driver
- [x] Build script produces artifacts that can be committed/distributed
