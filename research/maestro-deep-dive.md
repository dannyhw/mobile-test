# Maestro Deep Dive: Architecture & Implementation Analysis

## 1. High-Level Architecture

Maestro is a Kotlin/JVM-based mobile testing framework organized as a Gradle multi-module project. The entire CLI and orchestration layer runs on the JVM (Java 17), with thin native drivers deployed onto the target devices.

### Module Map

```
maestro-cli/          -- CLI entry point (picocli commands: test, studio, record, etc.)
maestro-orchestra/    -- Command execution engine ("Orchestra") + YAML parsing
maestro-orchestra-models/ -- Data models for commands, selectors, config
maestro-client/       -- Core Maestro class + Driver interface + platform drivers (AndroidDriver, IOSDriver, WebDriver)
maestro-ios-driver/   -- iOS-specific: XCTestDriverClient (HTTP client), XCTestInstaller, SimctlIOSDevice
maestro-ios/          -- IOSDevice abstraction: XCTestIOSDevice (delegates to XCTestDriverClient)
maestro-ios-xctest-runner/ -- Swift XCTest UI test bundle deployed to iOS simulator (HTTP server)
maestro-android/      -- Android instrumentation APK (gRPC server running UIAutomator)
maestro-proto/        -- Protobuf definitions for Android gRPC protocol
maestro-ai/           -- AI-powered assertions (screenshot analysis)
maestro-web/          -- Chrome DevTools Protocol driver for web testing
maestro-studio/       -- Visual test editor (web UI + server)
maestro-utils/        -- Shared utilities
maestro-test/         -- Integration tests
```

### Dependency Flow (simplified)

```
CLI --> Orchestra --> Maestro (client) --> Driver interface
                                              |
                              +---------------+---------------+
                              |               |               |
                        AndroidDriver    IOSDriver       WebDriver
                              |               |
                         gRPC to APK     HTTP to XCTest
                        (UIAutomator)    (XCUITest runner)
```

## 2. How It Connects to Devices (No Custom Builds Required)

This is the most important architectural insight: Maestro ships its own driver apps that it installs onto the simulator/emulator at runtime. The user's app is never modified.

### Android Connection

1. **`dadb` library** (pure-Kotlin ADB implementation) connects to the emulator/device
2. Maestro **installs two APKs** from bundled resources onto the device:
   - `maestro-app.apk` (package `dev.mobile.maestro`) -- target app for instrumentation
   - `maestro-server.apk` (package `dev.mobile.maestro.test`) -- instrumentation test APK
3. Starts an **Android instrumentation test session** via `am instrument`:
   ```
   am instrument -w -m -e debug false
     -e class 'dev.mobile.maestro.MaestroDriverService#grpcServer'
     -e port 7001
     dev.mobile.maestro.test/androidx.test.runner.AndroidJUnitRunner
   ```
4. The instrumentation test starts a **gRPC server** (Netty) on port 7001 inside the emulator
5. `dadb.tcpForward()` sets up **ADB port forwarding** from host to device
6. The `AndroidDriver` communicates via **gRPC** to the on-device server

**Key**: The instrumentation test APK runs as a separate process with `UiAutomation` privileges. It can interact with ANY app on the device without modifying it.

### iOS Connection

1. Maestro **builds or extracts a pre-built XCTest runner** (`maestro-driver-iosUITests.xctrunner`)
2. Installs it on the simulator via `xcrun simctl install` or `xcodebuild test-without-building`
3. The XCTest runner starts a **FlyingFox HTTP server** on `127.0.0.1:22087` (configurable via PORT env)
4. `XCTestDriverClient` (Kotlin) communicates via **HTTP/JSON** to the Swift XCTest runner

**Key**: The XCTest runner runs as a UI test bundle (XCUITest), which Apple allows to interact with ANY app on the simulator/device through the accessibility framework. No modification to the user's app is needed.

### Why No Custom Builds Are Needed

Both platforms use the same trick: **system-level testing frameworks** (UIAutomator on Android, XCUITest on iOS) that run as separate processes with elevated permissions to observe and interact with any running app. Maestro simply deploys its own driver process that wraps these native capabilities in a network server.

## 3. The Driver Interface

The `Driver` interface (`maestro-client/src/main/java/maestro/Driver.kt`) is the core abstraction:

```kotlin
interface Driver {
    fun name(): String
    fun open()
    fun close()
    fun deviceInfo(): DeviceInfo
    fun launchApp(appId: String, launchArguments: Map<String, Any>)
    fun stopApp(appId: String)
    fun killApp(appId: String)
    fun clearAppState(appId: String)
    fun clearKeychain()
    fun tap(point: Point)
    fun longPress(point: Point)
    fun pressKey(code: KeyCode)
    fun contentDescriptor(excludeKeyboardElements: Boolean = false): TreeNode
    fun scrollVertical()
    fun isKeyboardVisible(): Boolean
    fun swipe(start: Point, end: Point, durationMs: Long)
    fun swipe(swipeDirection: SwipeDirection, durationMs: Long)
    fun swipe(elementPoint: Point, direction: SwipeDirection, durationMs: Long)
    fun backPress()
    fun inputText(text: String)
    fun openLink(link: String, appId: String?, autoVerify: Boolean, browser: Boolean)
    fun hideKeyboard()
    fun takeScreenshot(out: Sink, compressed: Boolean)
    fun startScreenRecording(out: Sink): ScreenRecording
    fun setLocation(latitude: Double, longitude: Double)
    fun setOrientation(orientation: DeviceOrientation)
    fun eraseText(charactersToErase: Int)
    fun setProxy(host: String, port: Int)
    fun resetProxy()
    fun isShutdown(): Boolean
    fun isUnicodeInputSupported(): Boolean
    fun waitUntilScreenIsStatic(timeoutMs: Long): Boolean
    fun waitForAppToSettle(initialHierarchy: ViewHierarchy?, appId: String?, timeoutMs: Int?): ViewHierarchy?
    fun capabilities(): List<Capability>
    fun setPermissions(appId: String, permissions: Map<String, String>)
    fun addMedia(mediaFiles: List<File>)
    fun isAirplaneModeEnabled(): Boolean
    fun setAirplaneMode(enabled: Boolean)
}
```

The `Maestro` class wraps a `Driver` and adds higher-level logic like retry, wait-for-settle, and screenshot comparison.

## 4. Command System

### Command Execution Pipeline

```
YAML File --> YamlCommandReader --> MaestroFlowParser --> List<MaestroCommand>
                                                              |
                                                              v
                                                         Orchestra.runFlow()
                                                              |
                                                              v
                                                    Orchestra.executeCommand()
                                                              |
                                                              v
                                                    Pattern match on command type
                                                              |
                                                              v
                                                    Calls methods on Maestro instance
                                                              |
                                                              v
                                                    Maestro delegates to Driver
```

### Command Types (from Orchestra.executeCommand)

The full list of supported commands:

| Command | YAML Syntax | What It Does |
|---------|-------------|--------------|
| `TapOnElementCommand` | `- tapOn: "text"` | Find element by text/id, tap its center |
| `TapOnPointCommand` | `- tapOn: {point: "50%, 50%"}` | Tap at coordinates |
| `BackPressCommand` | `- back` | Android back button |
| `HideKeyboardCommand` | `- hideKeyboard` | Dismiss keyboard |
| `ScrollCommand` | `- scroll` | Scroll vertically |
| `ScrollUntilVisibleCommand` | `- scrollUntilVisible` | Scroll until element found |
| `SwipeCommand` | `- swipe: {direction: LEFT}` | Swipe in direction |
| `AssertCommand` | `- assertVisible: "text"` | Assert element visible/not visible |
| `AssertScreenshotCommand` | `- assertScreenshot: path.png` | Compare screenshot against reference |
| `AssertConditionCommand` | `- assertTrue: condition` | Assert JS condition |
| `InputTextCommand` | `- inputText: "hello"` | Type text |
| `LaunchAppCommand` | `- launchApp` | Launch the app |
| `StopAppCommand` | `- stopApp` | Stop the app |
| `KillAppCommand` | `- killApp` | Kill the app (process death) |
| `ClearStateCommand` | `- clearState` | Clear app data |
| `PressKeyCommand` | `- pressKey: Enter` | Press a specific key |
| `EraseTextCommand` | `- eraseText: 5` | Delete characters |
| `TakeScreenshotCommand` | `- takeScreenshot: name` | Save a screenshot |
| `OpenLinkCommand` | `- openLink: "https://..."` | Open a deep link |
| `SetLocationCommand` | `- setLocation: {lat, lng}` | Mock GPS location |
| `SetOrientationCommand` | `- setOrientation: Landscape` | Set device orientation |
| `RunFlowCommand` | `- runFlow: other.yaml` | Run a sub-flow |
| `RepeatCommand` | `- repeat: {times: 3}` | Repeat commands |
| `RunScriptCommand` | `- runScript: file.js` | Execute JavaScript |
| `EvalScriptCommand` | `- evalScript: "..."` | Evaluate inline JS |
| `WaitForAnimationToEndCommand` | `- waitForAnimationToEnd` | Wait for screen to be static |
| `StartRecordingCommand` | `- startRecording` | Start screen recording |
| `StopRecordingCommand` | `- stopRecording` | Stop screen recording |
| `AddMediaCommand` | `- addMedia: [file]` | Add media to device |
| `SetAirplaneModeCommand` | `- setAirplaneMode` | Toggle airplane mode |
| `AssertNoDefectsWithAICommand` | `- assertNoDefectsWithAI` | AI-powered defect detection |
| `AssertWithAICommand` | `- assertWithAI` | AI-powered assertion |
| `CopyTextFromCommand` | `- copyTextFrom` | Copy text from element |
| `PasteTextCommand` | `- pasteText` | Paste from clipboard |
| `SetPermissionsCommand` | `- setPermissions` | Set app permissions |

### MaestroCommand Design Problem

The `MaestroCommand` class is a data class with ~30+ nullable fields, one for each command type. This is the "tagged union via nullable fields" anti-pattern:

```kotlin
data class MaestroCommand(
    val tapOnElement: TapOnElementCommand? = null,
    val tapOnPoint: TapOnPointCommand? = null,
    val scrollCommand: ScrollCommand? = null,
    val swipeCommand: SwipeCommand? = null,
    // ... 30+ more nullable fields
)
```

The `asCommand()` method then has a massive `when` block checking which field is non-null. This design exists because of backend serialization constraints (noted in the code comments).

## 5. iOS Driver Deep Dive

### Architecture Layers (4 layers deep!)

```
IOSDriver (maestro-client) -- implements Driver interface
    |
    v
XCTestIOSDevice (maestro-ios) -- implements IOSDevice interface, delegates to client
    |
    v
XCTestDriverClient (maestro-ios-driver) -- HTTP client, sends JSON requests
    |
    v (HTTP/JSON over localhost)
XCTestHTTPServer (maestro-ios-xctest-runner) -- Swift HTTP server inside XCTest bundle
    |
    v
RouteHandlers (Swift) -- actual XCUITest/accessibility API calls
```

### How Touch Works (iOS)

1. `IOSDriver.tap(point)` calls `iosDevice.tap(x, y)`
2. `XCTestIOSDevice.tap()` calls `client.tap(x, y)`
3. `XCTestDriverClient.tap()` sends HTTP POST to `/touch` with JSON `{x, y, duration}`
4. `TouchRouteHandler` (Swift):
   - Creates an `EventRecord` (wraps `XCTSynthesizedEventRecord`)
   - Adds a pointer touch event at the coordinate
   - Calls `RunnerDaemonProxy().synthesize(eventRecord:)` to actually perform the touch
5. `RunnerDaemonProxy` uses **private XCTest APIs** via Objective-C runtime:
   - Gets `XCTRunnerDaemonSession.sharedSession`
   - Gets the `.daemonProxy` from the session
   - Calls `_XCT_synthesizeEvent:completion:` to synthesize the touch event

### How View Hierarchy Works (iOS)

1. `ViewHierarchyHandler` (Swift) gets the foreground app via `RunningApp.getForegroundApp()`
2. Calls `xcuiElement.snapshot().dictionaryRepresentation` to get the XCUITest accessibility snapshot
3. Converts to `AXElement` (custom struct with label, identifier, frame, value, title, elementType, etc.)
4. Returns as JSON over HTTP
5. Kotlin side (`IOSDriver.viewHierarchy()`) maps `AXElement` to `TreeNode` (Maestro's unified tree model)

### How Screenshots Work (iOS)

Simple: `XCUIScreen.main.screenshot()` returns a `XCUIScreenshot`, then `.pngRepresentation` or `.jpegData()` gives the bytes.

### Native Tools Used (iOS)

- **XCUITest framework** (Apple's official UI testing framework) -- for touch synthesis, view hierarchy, screenshots
- **Private XCTest APIs** -- `XCTRunnerDaemonSession`, `_XCT_synthesizeEvent`, `_XCT_sendString`
- **`xcrun simctl`** -- for install, launch, terminate, open URL, set location, add media, set permissions
- **`xcodebuild test-without-building`** -- to run the XCTest runner
- **FlyingFox** -- lightweight Swift HTTP server library
- **Accessibility framework** -- `XCUIElement.snapshot().dictionaryRepresentation` for view hierarchy

### Key Swizzling

`AXClientSwizzler` swizzles `XCAXClient_iOS.defaultParameters` to inject custom parameters like `maxDepth` when the view hierarchy is too deep.

## 6. Android Driver Deep Dive

### Architecture Layers

```
AndroidDriver (maestro-client) -- implements Driver interface
    |
    v (gRPC over TCP, port-forwarded via ADB)
MaestroDriverService (maestro-android) -- Android instrumentation test with gRPC server
    |
    v
UiDevice / UiAutomation -- Android's UIAutomator framework
```

### How Touch Works (Android)

1. `AndroidDriver.tap(point)` sends gRPC `tap` request with `{x, y}`
2. `MaestroDriverService.tap()` calls `uiDevice.clickExt(x, y)` (custom extension on UIAutomator's `UiDevice`)

For some operations, Maestro bypasses gRPC and uses ADB directly:
- `longPress`: `dadb.shell("input swipe x y x y 3000")`
- `pressKey`: `dadb.shell("input keyevent $code")`
- `swipe`: `dadb.shell("input swipe x1 y1 x2 y2 duration")`
- `stopApp`: `shell("am force-stop $appId")`
- `clearAppState`: `shell("pm clear $appId")`

### How View Hierarchy Works (Android)

1. gRPC `viewHierarchy` request
2. `ViewHierarchy.dump()` uses `UiAutomation` to get `AccessibilityNodeInfo` roots
3. Recursively serializes the accessibility tree as XML
4. Returns XML string over gRPC
5. Kotlin side parses XML into `TreeNode` using `DocumentBuilderFactory`

### How Screenshots Work (Android)

1. gRPC `screenshot` request
2. `uiAutomation.takeScreenshot()` returns a `Bitmap`
3. Encoded as PNG bytes via `ScreenshotService`
4. Returned as protobuf bytes

### Native Tools Used (Android)

- **`dadb`** -- pure-Kotlin ADB client (no dependency on `adb` CLI)
- **UIAutomator** (`UiDevice`, `UiAutomation`) -- for tap, view hierarchy, screenshot
- **Android Instrumentation** (`am instrument`) -- to run the driver as a test
- **ADB shell** -- for `input`, `am`, `pm` commands
- **gRPC/Protobuf** -- communication protocol between host and device
- **Accessibility APIs** (`AccessibilityNodeInfo`) -- for the view hierarchy

## 7. Screenshot Capabilities

### Screenshot Capture

Both platforms support capturing screenshots:
- **iOS**: `XCUIScreen.main.screenshot()` -- returns PNG or compressed JPEG
- **Android**: `uiAutomation.takeScreenshot()` -- returns PNG bitmap

### Screenshot Comparison (assertScreenshot)

Maestro has a `assertScreenshot` command that compares against a reference image:

```yaml
- assertScreenshot: screenshots/login-screen.png
```

Implementation (`Orchestra.assertScreenshotCommand()`):
1. Takes a current screenshot
2. Loads the expected reference image
3. Uses `ImageComparison` library (java-image-comparison by `romankh3`) to compare
4. Configurable threshold percentage (default allows some pixel difference)
5. Generates a diff image file (`_diff.png`) showing differences
6. Supports `cropOn` to crop to a specific element's bounds before comparing

### Wait-for-Settle (Screenshot-based)

The `waitForAppToSettle` mechanism has two strategies:
- **Hierarchy-based**: Compare view hierarchy trees for equality
- **Screenshot-based**: Take two consecutive screenshots and compare pixel difference (threshold: 0.5%)

iOS uses `isScreenStatic` (done on-device in the XCTest runner) as a fast check before falling back to hierarchy comparison.

### Limitations

- No built-in visual regression workflow (no baseline management, no approval flow)
- `assertScreenshot` requires pre-existing reference files -- no auto-creation
- No pixel-by-pixel comparison options beyond threshold percentage
- Comparison is basic (whole-image or element-crop, no region masking)

## 8. YAML Flow Format

### Structure

A flow file has two YAML documents separated by `---`:

```yaml
# Document 1: Configuration
appId: com.example.app
name: My Test Flow
tags:
  - smoke
env:
  USERNAME: testuser

# Optional hooks
onFlowStart:
  - launchApp
onFlowComplete:
  - stopApp
---
# Document 2: Commands (list)
- launchApp:
    clearState: true
- tapOn: "Login"
- inputText: "user@test.com"
- tapOn: "Password"
- inputText: "password123"
- tapOn: "Submit"
- assertVisible: "Welcome"
```

### Parsing Pipeline

1. `YamlCommandReader.readCommands()` reads the file
2. `MaestroFlowParser.parseFlow()` uses Jackson YAML parser
3. Custom deserializer handles both **string commands** (`- launchApp`) and **object commands** (`- launchApp: {clearState: true}`)
4. Maps YAML structures to `YamlFluentCommand` objects
5. Converts to `List<MaestroCommand>` (the internal representation)

### Element Selection

Elements can be targeted by:
- **Text**: `- tapOn: "Login"` (matches text content)
- **ID**: `- tapOn: {id: "login-button"}` (matches accessibility ID / resource-id)
- **Index**: `- tapOn: {index: 0}` (nth matching element)
- **Point**: `- tapOn: {point: "50%, 50%"}` (absolute/relative coordinates)
- **Below/Above/Left/Right of another element**: Relative positioning
- **Traits**: `containsText`, `containsChild`, etc.

### JavaScript Integration

Maestro supports inline JavaScript via GraalJS or Rhino:

```yaml
- evalScript: ${output.username = 'test_' + Math.random()}
- inputText: ${output.username}
- runScript: setup.js
```

## 9. What Makes Maestro Easy to Use

### Zero-Config Design

1. **No build modifications**: Maestro deploys its own driver apps, never touches the user's app
2. **No SDK integration**: No code changes to the app under test
3. **Auto-installs drivers**: On `open()`, it automatically installs the UIAutomator APK (Android) or XCTest runner (iOS)
4. **Works with any app**: Since it uses system-level accessibility/automation APIs, it works with React Native, Flutter, native, or any framework

### Simple YAML API

```yaml
appId: com.example.app
---
- launchApp
- tapOn: "Sign In"
- inputText: "user@test.com"
- assertVisible: "Welcome"
```

4 lines to write a basic test. No imports, no boilerplate, no compilation.

### Automatic Waiting

- `waitForAppToSettle` after every interaction (tap, swipe, input)
- Compares view hierarchies or screenshots to detect when UI has stabilized
- No manual `sleep()` or `waitFor()` needed in most cases

### Single Binary Distribution

Installed via a single shell command. Everything (CLI, drivers, XCTest runner) is bundled.

## 10. Weaknesses & Complexity Analysis

### Too Many Abstraction Layers

The iOS path has **4 layers** between a command and the actual native API call:

```
IOSDriver (Kotlin)
  -> XCTestIOSDevice (Kotlin)
    -> XCTestDriverClient (Kotlin, HTTP)
      -> Swift HTTP Handler (actual XCUITest call)
```

There are also TWO IOSDevice interfaces:
- `device.IOSDevice` (in maestro-ios-driver)
- `ios.LocalIOSDevice` (in maestro-ios, wraps the above plus simctl)

And two IOSDevice implementations that both delegate to the same XCTestDriverClient:
- `XCTestIOSDevice` (in maestro-ios) -- used for cloud/remote
- `SimctlIOSDevice` (in maestro-ios-driver) -- used for local, but many methods are `TODO("Not yet implemented")`

### Java/Kotlin Complexity

- The entire system is JVM-based (Java 17 + Kotlin)
- Requires Gradle build system with ~15 modules
- Uses gRPC + Protobuf for Android communication (heavy dependency)
- Uses Jackson YAML for parsing (verbose configuration)
- GraalJS for JavaScript execution (large dependency)

### MaestroCommand Anti-Pattern

The `MaestroCommand` data class has 30+ nullable fields -- one per command type. This creates:
- Massive `when` blocks in `asCommand()` and `executeCommand()`
- Every new command requires changes in ~5 places
- The constructor with 30+ optional parameters is unwieldy
- Exists because of backend serialization constraints (tech debt acknowledged in comments)

### Communication Protocol Mismatch

- **Android**: gRPC + Protobuf (heavy, complex, but efficient)
- **iOS**: HTTP + JSON (simple, but different from Android)
- No unified protocol -- each platform has its own completely different wire format

### Mixed ADB Usage (Android)

The Android driver uses BOTH:
- gRPC for some operations (tap, viewHierarchy, screenshot, launchApp, inputText)
- Direct ADB shell for others (longPress, pressKey, swipe, stopApp, clearAppState)

This split creates inconsistency and makes it harder to reason about the communication path.

### YAML-Only Interface

- No programmatic TypeScript/JavaScript API
- YAML is hard to debug, no IDE support for custom commands
- Limited control flow (repeat, runFlow, JS eval -- but no proper conditionals, try/catch is limited)
- Cannot compose tests programmatically or share logic via functions

### Screenshot Comparison Limitations

- No built-in baseline management
- No visual regression workflow (approve/reject)
- No region masking for dynamic content
- Simple threshold-based comparison only
- `assertScreenshot` requires pre-existing reference files

### Slow Startup

- Android: Install 2 APKs + start instrumentation + wait for gRPC server (can take 10-30 seconds)
- iOS: Extract/install XCTest runner + wait for HTTP server (can take 30-120 seconds)
- Port forwarding and process management adds latency

### View Hierarchy Limitations

- Deep React Native hierarchies (>60 levels) cause timeouts
- iOS uses XCUITest snapshot which can be slow for complex UIs
- Android XML serialization of accessibility tree can hit NPEs (bug in UIAutomator, worked around with retries)

## 11. Key Takeaways for Our New Tool

### What to Keep

1. **The driver-app approach**: Deploy a thin native server onto the device, communicate over a network protocol. This is what makes "no custom builds" possible.
2. **System-level automation APIs**: UIAutomator (Android) and XCUITest private APIs (iOS) are the right tools.
3. **Automatic wait-for-settle**: Comparing view hierarchies/screenshots between interactions is smart.
4. **Element selection via accessibility**: Using text, IDs, and accessibility labels works well.

### What to Simplify

1. **Reduce layers**: Go from 4 iOS layers to 2 (TypeScript client -> Swift HTTP server)
2. **Unified protocol**: Use HTTP/JSON for both platforms (drop gRPC/Protobuf for Android)
3. **TypeScript API instead of YAML**: Familiar to target users, better IDE support, proper control flow
4. **Simpler command model**: Use a discriminated union / tagged type instead of 30 nullable fields
5. **TypeScript/Node.js host**: Replace the entire JVM stack with Node.js for the host side

### What to Improve

1. **Built-in screenshot comparison workflow**: Baseline management, approval flow, region masking
2. **Extensibility**: Let users write custom commands and helpers in TypeScript
3. **Speed**: Reduce startup time, keep driver running between tests
4. **Unified view hierarchy model**: One clean tree structure, same on both platforms

### Native Integration Points We Need

**iOS (Swift)**:
- `XCUIScreen.main.screenshot()` -- screenshots
- `xcuiElement.snapshot().dictionaryRepresentation` -- view hierarchy
- `RunnerDaemonProxy._XCT_synthesizeEvent` -- touch/gesture synthesis
- `RunnerDaemonProxy._XCT_sendString` -- text input
- `xcrun simctl` -- app lifecycle, install, permissions, location

**Android (Kotlin)**:
- `UiAutomation.takeScreenshot()` -- screenshots
- `AccessibilityNodeInfo` tree traversal -- view hierarchy
- `UiDevice.click/swipe` -- touch synthesis
- ADB shell `am`/`pm`/`input` commands -- app lifecycle, key events
- Android Instrumentation -- to get system-level access

### Communication Architecture Recommendation

```
TypeScript Test Code
    |
    v
Node.js Test Runner
    |
    +-- iOS: HTTP/JSON --> Swift XCTest HTTP Server (deployed to simulator)
    |
    +-- Android: HTTP/JSON --> Kotlin/Android HTTP Server (deployed via instrumentation)
```

Use HTTP/JSON for both platforms. It's simpler, debuggable, and sufficient for the command set we need. The Swift and Kotlin servers should be as thin as possible -- just translate HTTP requests into native API calls.
