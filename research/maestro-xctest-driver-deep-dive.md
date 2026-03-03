# Maestro iOS XCTest Driver - Deep Dive

## Overview

Maestro's iOS driver is an XCTest UI test bundle that runs inside the simulator, starts an HTTP server (using FlyingFox), and exposes device actions (tap, swipe, screenshot, etc.) as HTTP endpoints. The Kotlin/Java host process communicates with this server over localhost.

---

## 1. Entry Point and Server Lifecycle

**File:** `maestro-driver-iosUITests/maestro_driver_iosUITests.swift`

The entire driver is a single XCTest UI test case:

```swift
final class maestro_driver_iosUITests: XCTestCase {
    func testHttpServer() async throws {
        let server = XCTestHTTPServer()
        try await server.start()  // blocks forever
    }
}
```

Key patterns:
- `continueAfterFailure = true` - prevents XCTest from aborting when internal assertions fail (common with React Native accessibility queries)
- The test method `testHttpServer()` is `async` - it awaits `server.start()` which calls `server.run()`, which blocks indefinitely serving requests
- The XCTest process stays alive as long as this test is "running" - the HTTP server's run loop IS the test
- This is the ONLY test method - the entire purpose of the XCTest bundle is to host the HTTP server

**Key takeaway for us:** A single `func testXxx() async throws` that starts an HTTP server and never returns is the minimal pattern to keep an XCTest runner alive as a persistent service.

---

## 2. FlyingFox Integration (HTTP Server)

**File:** `maestro-driver-iosUITests/Routes/XCTestHTTPServer.swift`

```swift
struct XCTestHTTPServer {
    func start() async throws {
        let port = ProcessInfo.processInfo.environment["PORT"]?.toUInt16()
        let server = HTTPServer(address: try .inet(ip4: "127.0.0.1", port: port ?? 22087), timeout: 100)

        for route in Route.allCases {
            let handler = await RouteHandlerFactory.createRouteHandler(route: route)
            await server.appendRoute(route.toHTTPRoute(), to: handler)
        }

        try await server.run()  // blocks forever
    }
}
```

Routes are defined as a simple enum:
```swift
enum Route: String, CaseIterable {
    case screenshot, touch, swipe, inputText, deviceInfo, status, viewHierarchy, ...

    func toHTTPRoute() -> HTTPRoute {
        return HTTPRoute(rawValue)  // e.g. "/screenshot"
    }
}
```

**File:** `Routes/RouteHandlerFactory.swift`

Simple factory maps each route enum case to a handler struct:
```swift
class RouteHandlerFactory {
    @MainActor class func createRouteHandler(route: Route) -> HTTPHandler {
        switch route {
        case .screenshot: return ScreenshotHandler()
        case .touch: return TouchRouteHandler()
        // ...
        }
    }
}
```

Key patterns:
- FlyingFox v0.22.0, added via Swift Package Manager (XCRemoteSwiftPackageReference in Xcode project)
- Port configurable via `PORT` environment variable, defaults to 22087
- Binds to 127.0.0.1 only (localhost)
- Timeout of 100 seconds on connections
- `@MainActor` used on handler creation (required for XCUIElement access)
- Each handler implements FlyingFox's `HTTPHandler` protocol

**Key takeaway for us:** FlyingFox is a lightweight, pure-Swift async HTTP server that works inside XCTest. The route/handler pattern is clean and simple. We should use the same library. The enum-based route registration is elegant.

---

## 3. Screenshot Capture

**File:** `Routes/Handlers/ScreenshotHandler.swift`

```swift
@MainActor
struct ScreenshotHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        let compressed = request.query["compressed"] == "true"
        let fullScreenshot = XCUIScreen.main.screenshot()
        let image = compressed
            ? fullScreenshot.image.jpegData(compressionQuality: 0.5)
            : fullScreenshot.pngRepresentation

        guard let image = image else {
            return AppError(...).httpResponse
        }
        return HTTPResponse(statusCode: .ok, body: image)
    }
}
```

Key patterns:
- `@MainActor` annotation - required because `XCUIScreen.main.screenshot()` must run on main thread
- `XCUIScreen.main.screenshot()` is the core API - returns an `XCUIScreenshot`
- Supports both PNG (lossless) and JPEG (compressed at 0.5 quality) via query parameter
- Raw image bytes returned directly as HTTP response body
- No file I/O - pure in-memory capture and return

**Key takeaway for us:** Screenshot capture is trivially simple - one line of code. The `@MainActor` requirement is important. Supporting both PNG and JPEG is a good pattern for balancing quality vs. speed.

---

## 4. Build and Install Flow

### Build Script

**File:** `build-maestro-ios-runner.sh`

```bash
xcodebuild clean build-for-testing \
  -project ./maestro-ios-xctest-runner/maestro-driver-ios.xcodeproj \
  -derivedDataPath "$PWD/$DERIVED_DATA_PATH" \
  -scheme maestro-driver-ios \
  -destination "$DESTINATION" \
  ARCHS="$ARCHS" ${DEVELOPMENT_TEAM_OPT}
```

Produces three artifacts:
1. `maestro-driver-iosUITests-Runner.app` - the XCTest runner app
2. `maestro-driver-ios.app` - the host app (minimal/empty)
3. `*.xctestrun` - configuration plist telling xcodebuild how to run the tests

These are zipped and bundled into the Maestro Java resources for distribution.

### Run Script (for local dev)

**File:** `run-maestro-ios-runner.sh`

```bash
xcodebuild test-without-building \
    -xctestrun "$xctestrun_file" \
    -destination "platform=iOS Simulator,name=$DEVICE" \
    -destination-timeout 1
```

### Programmatic Install (from Kotlin host)

**File:** `LocalXCTestInstaller.kt`

The flow is:
1. Extract pre-built `.app` bundles from resources (zipped)
2. Install on simulator: `xcrun simctl install <deviceId> <path-to-app>`
3. Launch the XCTest runner via `xcodebuild test-without-building`
4. Pass port via environment variable `TEST_RUNNER_PORT`
5. Poll `GET /status` endpoint until it responds (up to 120s timeout, checking every 500ms)
6. Return `XCTestClient(host, port)` for the host to use

Key details from `XCRunnerCLIUtils.runXcTestWithoutBuild()`:
```kotlin
CommandLineUtils.runCommand(
    listOf("xcodebuild", "test-without-building",
        "-xctestrun", xcTestRunFilePath,
        "-destination", "id=$deviceId",
        "-derivedDataPath", logOutputDir),
    waitForCompletion = false,  // runs in background
    params = mapOf("TEST_RUNNER_PORT" to port.toString())
)
```

**Key takeaway for us:**
- `xcodebuild build-for-testing` produces a portable test bundle
- `xcodebuild test-without-building` launches it on any simulator without rebuilding
- The xctestrun file is the glue between building and running
- Environment variables pass configuration (port) to the running test
- A simple HTTP health check loop confirms the server is ready
- For simulators, `xcrun simctl install` + `xcodebuild test-without-building` is the install path

---

## 5. Project Structure

### Xcode Project Targets

From `project.pbxproj`:

1. **maestro-driver-ios** (app target) - Minimal host app with AppDelegate, SceneDelegate, ViewController, storyboards. This is required because XCTest UI tests need a "host application" to attach to.

2. **maestro-driver-iosUITests** (UI test bundle) - Contains ALL the actual driver code:
   - `maestro_driver_iosUITests.swift` - entry point
   - `Routes/XCTestHTTPServer.swift` - HTTP server setup
   - `Routes/RouteHandlerFactory.swift` - route-to-handler mapping
   - `Routes/Handlers/*.swift` - one handler per action (ScreenshotHandler, TouchRouteHandler, etc.)
   - `Routes/Helpers/AppError.swift` - error handling
   - `Routes/Models/*.swift` - request/response models
   - Various ObjC helpers for private API access (accessibility, quiescence)

3. **MaestroDriverLib** (framework) - Shared logic extracted into a framework (AXElement parsing, permission handling, etc.)

### Dependencies

- **FlyingFox v0.22.0** - Swift async HTTP server, added via SPM (XCRemoteSwiftPackageReference to `https://github.com/swhitty/FlyingFox`)
- **XCTest.framework** - linked directly for XCUIElement, XCUIScreen, etc.
- **MaestroDriverLib.framework** - their own shared library

### Handler Pattern

Every handler is a struct conforming to FlyingFox's `HTTPHandler` protocol:
```swift
@MainActor
struct SomeHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse { ... }
}
```

---

## What We Need (Minimal Set)

For our simpler driver focused on screenshot testing:

### Must Have
1. **Minimal host app** - empty iOS app (AppDelegate + storyboard), required by XCTest
2. **UI test bundle** with a single `async` test method that starts HTTP server
3. **FlyingFox** dependency for the HTTP server
4. **Route handlers** for our core operations:
   - `/screenshot` - capture screen (XCUIScreen.main.screenshot())
   - `/tap` - touch at coordinates
   - `/swipe` - swipe gesture
   - `/status` - health check
   - `/inputText` - type text
   - `/pressButton` - home button, etc.
   - `/deviceInfo` - screen size, etc.
   - `/launchApp` - launch app by bundle ID
   - `/terminateApp` - terminate app
5. **Build script** using `xcodebuild build-for-testing`
6. **Install flow** using `xcrun simctl install` + `xcodebuild test-without-building`

### Can Skip (Maestro complexity we don't need)
- MaestroDriverLib framework (keep everything in the test bundle)
- ObjC accessibility helpers (AXClientProxy, XCTestDaemonsProxy) - only needed for advanced view hierarchy introspection
- View hierarchy handler (we rely on screenshots, not element queries)
- Screen diff handler (we do comparison on the TypeScript side)
- Keyboard state handler
- Permission handler
- Multiple swipe versions
- RunnerDaemonProxy / EventRecord / PointerEventPath (low-level touch synthesis)
- The entire Kotlin/Java installer layer (we replace with TypeScript)

### Architecture Simplification
- Maestro: Java CLI -> Kotlin installer -> xcodebuild -> XCTest (Swift) -> FlyingFox HTTP
- Us: TypeScript CLI -> child_process(xcodebuild) -> XCTest (Swift) -> FlyingFox HTTP

We eliminate the Java/Kotlin layer entirely. Our TypeScript code directly spawns xcodebuild and talks HTTP to the Swift server.
