# Phase 1: iOS Simulator MVP — Detailed Plan

> Goal: A working end-to-end flow where a developer writes a Vitest test in TypeScript, runs it against a booted iOS simulator, and gets screenshot comparison results.

---

## What "Done" Looks Like

A developer can do this:

```bash
# Install
bun add mobile-test

# Write a test (login.test.ts)
```

```typescript
import { describe, it, expect } from 'vitest'
import { device, element, by } from 'mobile-test'

describe('Login', () => {
  it('shows the welcome screen', async () => {
    await device.launch('com.example.myapp')
    await expect(device).toMatchScreenshot('welcome')
  })

  it('can log in', async () => {
    await element(by.id('email')).type('user@test.com')
    await element(by.id('password')).type('secret')
    await element(by.id('login-btn')).tap()

    await expect(element(by.text('Welcome back'))).toBeVisible()
    await expect(device).toMatchScreenshot('home')
  })
})
```

```bash
# Run (with a simulator already booted)
bunx vitest
```

No other config needed. The framework auto-detects the booted simulator, installs its driver, and runs tests.

---

## Project Structure

```
mobile-test/
├── package.json
├── tsconfig.json
├── vitest.config.ts              # our own vitest config for dev
├── src/
│   ├── index.ts                  # public API: device, element, by, expect matchers
│   ├── config.ts                 # defineConfig, config loading + defaults
│   ├── device/
│   │   ├── types.ts              # Device interface
│   │   ├── ios-device.ts         # iOS device: simctl wrapper + driver HTTP client
│   │   └── detect.ts            # auto-detect booted simulators
│   ├── element/
│   │   ├── element.ts            # Element class (lazy locator, actions)
│   │   ├── by.ts                 # Locator builders: by.id(), by.text()
│   │   └── types.ts              # ElementHandle, Locator types
│   ├── expect/
│   │   ├── matchers.ts           # toBeVisible, toHaveText, toMatchScreenshot
│   │   └── retry.ts             # auto-retry logic for assertions
│   ├── screenshot/
│   │   ├── compare.ts            # odiff integration
│   │   ├── baselines.ts          # baseline read/write/update logic
│   │   └── normalize.ts          # status bar normalization via simctl
│   ├── driver/
│   │   ├── client.ts             # HTTP client to talk to iOS driver
│   │   └── protocol.ts          # shared request/response types
│   └── vitest/
│       ├── setup.ts              # globalSetup: detect device, install driver, start it
│       └── plugin.ts             # vitest plugin to wire everything together
├── ios-driver/                   # Swift XCTest runner (separate Xcode project)
│   ├── Package.swift             # or .xcodeproj
│   ├── DriverApp/                # shell iOS app (minimal)
│   ├── Driver/                   # XCTest UI test bundle
│   │   ├── DriverTests.swift     # entry point: starts HTTP server
│   │   ├── Server.swift          # HTTP server setup + routing
│   │   ├── Handlers/
│   │   │   ├── TapHandler.swift
│   │   │   ├── TypeTextHandler.swift
│   │   │   ├── ScreenshotHandler.swift
│   │   │   ├── ViewHierarchyHandler.swift
│   │   │   ├── DeviceInfoHandler.swift
│   │   │   ├── StatusHandler.swift
│   │   │   └── LaunchAppHandler.swift
│   │   ├── EventSynthesis/       # touch synthesis via XCTest private APIs
│   │   │   ├── RunnerDaemonProxy.swift
│   │   │   ├── EventRecord.swift
│   │   │   └── PointerEventPath.swift
│   │   ├── ViewHierarchy/        # accessibility tree snapshot
│   │   │   ├── AXElement.swift
│   │   │   └── SnapshotHelper.swift
│   │   └── Models/               # request/response codable structs
│   └── build.sh                  # builds the .xctestrun bundle
├── scripts/
│   └── build-ios-driver.sh       # builds and copies driver into dist/
└── dist/
    └── ios-driver/               # pre-built XCTest runner artifacts
        ├── Driver-Runner.app
        ├── DriverApp.app
        └── Driver.xctestrun
```

---

## Implementation Steps

### Step 1: Project Scaffolding

Set up the TypeScript project with proper build tooling.

- `package.json` with dependencies: `vitest` (peer), `odiff-bin`, `execa` (for running CLI commands)
- `tsconfig.json` targeting Node.js (ESM)
- Build with `tsup` or `unbuild` for publishing
- Export map: `mobile-test` → `src/index.ts`

### Step 2: iOS Device Detection & Management

**File: `src/device/detect.ts`**

Auto-detect booted simulators:

```typescript
// Runs: xcrun simctl list devices booted --json
// Returns: { udid, name, state, runtime } for each booted simulator
// Picks the first booted one by default
// Errors with helpful message if none booted
```

**File: `src/device/ios-device.ts`**

Wraps `xcrun simctl` for device lifecycle:

```typescript
class IOSDevice implements Device {
  udid: string
  name: string

  async launch(bundleId: string): Promise<void>
    // xcrun simctl launch <udid> <bundleId>

  async terminate(bundleId: string): Promise<void>
    // xcrun simctl terminate <udid> <bundleId>

  async install(appPath: string): Promise<void>
    // xcrun simctl install <udid> <appPath>

  async takeScreenshot(): Promise<Buffer>
    // delegates to driver HTTP: GET /screenshot

  async getViewHierarchy(): Promise<ElementTree>
    // delegates to driver HTTP: GET /viewHierarchy

  async openUrl(url: string): Promise<void>
    // xcrun simctl openurl <udid> <url>
}
```

### Step 3: iOS Driver (Swift XCTest Runner)

The native component that runs on the simulator. This is the most critical piece.

**Approach**: Follow Maestro's pattern but stripped down. A minimal XCTest UI test bundle that:
1. Starts an HTTP server on a known port
2. Exposes endpoints for all actions
3. Uses XCUITest APIs for interactions

**HTTP Server**: Use [FlyingFox](https://github.com/swhitty/FlyingFox) (same as Maestro — proven, lightweight, async/await Swift).

**Port**: `22087` (same as Maestro, or configurable via env var). Could consider a different default to avoid conflicts.

#### Endpoints for Phase 1

| Method | Path | Request Body | Response | Implementation |
|--------|------|-------------|----------|----------------|
| `GET` | `/status` | — | `{ status: "ready" }` | Health check |
| `GET` | `/deviceInfo` | — | `{ width, height, scale }` | `UIScreen.main` |
| `POST` | `/tap` | `{ x, y }` | `{ success: true }` | `RunnerDaemonProxy._XCT_synthesizeEvent` |
| `POST` | `/typeText` | `{ text }` | `{ success: true }` | `RunnerDaemonProxy._XCT_sendString` or `XCUIElement.typeText` |
| `GET` | `/screenshot` | — | PNG bytes | `XCUIScreen.main.screenshot().pngRepresentation` |
| `GET` | `/viewHierarchy` | — | JSON element tree | `XCUIApplication.snapshot().dictionaryRepresentation` |
| `POST` | `/launchApp` | `{ bundleId }` | `{ success: true }` | `XCUIApplication(bundleIdentifier:).launch()` |
| `POST` | `/terminateApp` | `{ bundleId }` | `{ success: true }` | `XCUIApplication(bundleIdentifier:).terminate()` |

#### Event Synthesis (Touch)

Based on Maestro's approach:

```swift
// RunnerDaemonProxy.swift
// Access XCTRunnerDaemonSession.sharedSession via Obj-C runtime
// Call _XCT_synthesizeEvent:completion: to perform touches

// EventRecord.swift
// Wrapper around XCSynthesizedEventRecord (private class)
// Created via: XCSynthesizedEventRecord(name:interfaceOrientation:)

// PointerEventPath.swift
// Wrapper around XCPointerEventPath (private class)
// liftUp / moveToPoint for touch events
```

This is the hardest part and requires working with private APIs. We can reference Maestro's implementation directly since it's Apache 2.0 licensed.

#### View Hierarchy

```swift
// Get accessibility snapshot of the foreground app
let app = XCUIApplication(bundleIdentifier: targetBundleId)
let snapshot = try app.snapshot()
// Convert to our AXElement model (label, identifier, frame, elementType, children)
// Return as JSON
```

The element tree is what powers `by.id()` and `by.text()` lookups on the TypeScript side.

#### Building & Packaging

```bash
# build.sh
xcodebuild clean build-for-testing \
  -project ios-driver.xcodeproj \
  -scheme DriverApp \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath ./build

# Output:
# build/Build/Products/Debug-iphonesimulator/Driver-Runner.app
# build/Build/Products/Debug-iphonesimulator/DriverApp.app
# build/Build/Products/*.xctestrun
```

Pre-built artifacts are committed to the npm package (or downloaded on first run). The XCTest runner is ~5-10MB.

#### Installing & Starting the Driver

From the TypeScript side:

```typescript
// 1. Install the shell app
await exec('xcrun simctl install', [udid, driverAppPath])

// 2. Start the XCTest runner via xcodebuild
const proc = exec('xcodebuild test-without-building', [
  '-xctestrun', xctestrunPath,
  '-destination', `platform=iOS Simulator,id=${udid}`,
])

// 3. Poll GET /status until the HTTP server is ready
await waitForDriverReady('http://localhost:22087/status')
```

### Step 4: Driver HTTP Client (TypeScript)

**File: `src/driver/client.ts`**

Thin HTTP client that talks to the driver on the simulator:

```typescript
class DriverClient {
  constructor(private baseUrl = 'http://localhost:22087') {}

  async status(): Promise<{ status: string }>
  async tap(x: number, y: number): Promise<void>
  async typeText(text: string): Promise<void>
  async screenshot(): Promise<Buffer>
  async viewHierarchy(): Promise<AXElement>
  async launchApp(bundleId: string): Promise<void>
  async terminateApp(bundleId: string): Promise<void>
  async deviceInfo(): Promise<DeviceInfo>
}
```

Uses `fetch` (Node 18+ built-in). No dependencies needed.

### Step 5: Element Locators & Actions

**File: `src/element/by.ts`**

```typescript
// Locator builders — lazy, don't query until needed
export const by = {
  id: (id: string) => new Locator('id', id),
  text: (text: string | RegExp) => new Locator('text', text),
}
```

**File: `src/element/element.ts`**

```typescript
// element() returns a lazy Element that resolves on action
export function element(locator: Locator): Element {
  return new Element(locator)
}

class Element {
  constructor(private locator: Locator) {}

  async tap(): Promise<void> {
    const node = await this.resolve()  // query view hierarchy, find matching element
    await driver.tap(node.frame.centerX, node.frame.centerY)
  }

  async type(text: string): Promise<void> {
    await this.tap()  // focus the element first
    await driver.typeText(text)
  }

  private async resolve(): Promise<AXNode> {
    // 1. GET /viewHierarchy from driver
    // 2. Walk tree to find element matching this.locator
    // 3. Auto-retry with timeout if not found yet (auto-wait)
    // 4. Throw if not found after timeout
  }
}
```

**Element resolution** is where auto-waiting lives. The `resolve()` method polls the view hierarchy until the element appears (up to `actionTimeout`), similar to Playwright's locator model.

### Step 6: Screenshot Comparison with odiff

**File: `src/screenshot/compare.ts`**

```typescript
import { ODiffServer } from 'odiff-bin'

// Singleton server for the test run
let server: ODiffServer

export async function compareScreenshots(
  baselinePath: string,
  currentPath: string,
  diffPath: string,
  options: ScreenshotOptions
): Promise<ComparisonResult> {
  if (!server) server = new ODiffServer()

  const result = await server.compare(baselinePath, currentPath, diffPath, {
    threshold: options.threshold ?? 0.1,
    antialiasing: options.antialiasing ?? true,
    outputDiffMask: true,
    ignoreRegions: options.ignoreRegions,
  })

  return {
    match: result.match,
    diffPercentage: result.reason === 'pixel-diff' ? result.diffPercentage : 0,
    diffPath: result.match ? undefined : diffPath,
    reason: result.reason,
  }
}
```

**File: `src/screenshot/baselines.ts`**

```typescript
// Directory structure:
// screenshots/
//   baseline/          ← committed to git
//     iPhone-16/
//       welcome.png
//       home.png
//   latest/            ← gitignored, current run
//   diff/              ← gitignored, diff images

export async function resolveBaselinePath(name: string, device: DeviceInfo): string
  // → screenshots/baseline/<device-name>/<name>.png

export async function saveLatest(name: string, device: DeviceInfo, buffer: Buffer): string
  // → screenshots/latest/<device-name>/<name>.png

export async function updateBaseline(name: string, device: DeviceInfo): void
  // copy latest → baseline
```

**File: `src/screenshot/normalize.ts`**

```typescript
// Normalize the status bar before taking screenshots so time/battery don't cause diffs
export async function normalizeStatusBar(udid: string): Promise<void> {
  await exec('xcrun simctl status_bar', [
    udid, 'override',
    '--time', '9:41',
    '--batteryState', 'charged',
    '--batteryLevel', '100',
    '--cellularMode', 'active',
    '--cellularBars', '4',
  ])
}

export async function resetStatusBar(udid: string): Promise<void> {
  await exec('xcrun simctl status_bar', [udid, 'clear'])
}
```

### Step 7: Vitest Integration

**File: `src/vitest/setup.ts`**

```typescript
// Vitest globalSetup — runs once before all tests
export async function setup() {
  // 1. Detect booted simulator (or use config)
  const sim = await detectBootedSimulator()

  // 2. Install driver app on simulator
  await installDriver(sim.udid)

  // 3. Start XCTest runner (launches HTTP server on simulator)
  const proc = await startDriver(sim.udid)

  // 4. Wait for driver to be ready
  await waitForDriverReady()

  // 5. Normalize status bar
  await normalizeStatusBar(sim.udid)

  // 6. Store device info globally for tests
  globalThis.__mobileTest = { sim, proc }

  return async () => {
    // teardown: stop driver, reset status bar
    proc.kill()
    await resetStatusBar(sim.udid)
  }
}
```

**File: `src/vitest/plugin.ts`**

```typescript
// Vitest plugin that wires up custom matchers and global setup
export function mobileTestPlugin(): VitestPlugin {
  return {
    name: 'mobile-test',
    config() {
      return {
        test: {
          globalSetup: [require.resolve('./setup')],
          setupFiles: [require.resolve('./matchers')],
        },
      }
    },
  }
}
```

**File: `src/expect/matchers.ts`**

```typescript
// Custom Vitest matchers
expect.extend({
  async toBeVisible(element: Element) {
    // Auto-retry: poll view hierarchy until element is found or timeout
    const found = await retry(() => element.isVisible(), { timeout: 5000 })
    return {
      pass: found,
      message: () => `Expected element ${element.locator} to be visible`,
    }
  },

  async toHaveText(element: Element, expected: string) {
    const text = await retry(() => element.getText(), { timeout: 5000 })
    return {
      pass: text === expected,
      message: () => `Expected "${expected}" but got "${text}"`,
    }
  },

  async toMatchScreenshot(device: Device, name: string, options?: ScreenshotOptions) {
    // 1. Take screenshot via driver
    const buffer = await device.takeScreenshot()

    // 2. Save to latest/
    const latestPath = await saveLatest(name, device.info, buffer)

    // 3. Check if baseline exists
    const baselinePath = resolveBaselinePath(name, device.info)
    if (!existsSync(baselinePath)) {
      // First run — save as baseline
      await copyFile(latestPath, baselinePath)
      return { pass: true, message: () => `New baseline created: ${name}` }
    }

    // 4. Compare with odiff
    const diffPath = resolveDiffPath(name, device.info)
    const result = await compareScreenshots(baselinePath, latestPath, diffPath, options)

    return {
      pass: result.match || result.diffPercentage <= (options?.maxDiffPercentage ?? 0),
      message: () => result.match
        ? `Screenshot matches baseline`
        : `Screenshot differs by ${result.diffPercentage}% (${result.reason}). Diff: ${diffPath}`,
    }
  },
})
```

### Step 8: Public API & Exports

**File: `src/index.ts`**

```typescript
export { device } from './device/ios-device'
export { element } from './element/element'
export { by } from './element/by'
export { defineConfig } from './config'
export { mobileTestPlugin } from './vitest/plugin'
```

Users import: `import { device, element, by } from 'mobile-test'`

---

## Dependency List (Phase 1)

| Package | Purpose | Size |
|---------|---------|------|
| `odiff-bin` | Screenshot comparison | ~5MB (prebuilt binary) |
| `execa` | Run CLI commands (`xcrun simctl`, `xcodebuild`) | Small |
| `vitest` | Peer dependency — test runner | User's own |

That's it. Minimal dependency footprint.

---

## Open Questions to Resolve During Phase 1

### 1. Private API stability
Maestro's touch synthesis uses `_XCT_synthesizeEvent`. We should test this against Xcode 15 and 16 to verify it still works. Fallback: use `XCUIElement.tap()` (public API) which requires resolving elements first but avoids private APIs.

### 2. Driver app signing
XCTest runner bundles need to be signed for real devices but simulators accept ad-hoc signing. Verify that our pre-built bundle works on simulators without code signing configuration.

### 3. Driver startup time
Maestro's iOS cold start can take 30-120s (mostly `xcodebuild test-without-building`). Mitigations:
- Keep the driver running between test files (don't restart per-test)
- Investigate if we can skip `xcodebuild` and install/launch the runner directly via `simctl`
- Explore using `xcrun xctest` directly instead of `xcodebuild`

### 4. View hierarchy depth
React Native apps can have 60+ levels of nesting. Maestro handles this with swizzling `XCAXClient_iOS.defaultParameters` to set maxDepth. We may need the same workaround.

### 5. Port conflicts
If the user has Maestro's driver running on 22087, we'll conflict. Options:
- Use a different default port
- Auto-detect available port and pass via env var to the XCTest runner
- Check if port is in use before starting

---

## Build & Test Strategy

### Building the iOS driver
```bash
# One-time build (or on Xcode version change)
cd ios-driver && ./build.sh

# Outputs pre-built artifacts to dist/ios-driver/
```

### Running our own tests during development
```bash
# Unit tests (no simulator needed)
bunx vitest run --project unit

# Integration tests (requires booted simulator + test app)
bunx vitest run --project integration
```

### CI
- macOS runner with Xcode installed
- Boot a simulator in CI: `xcrun simctl boot "iPhone 16"`
- Install a test app (we'll build a minimal RN app for testing)
- Run tests

---

## Milestones

### M1: TypeScript skeleton + device detection
- Project scaffolding, build setup
- `detect.ts`: auto-detect booted simulators via `xcrun simctl list`
- `ios-device.ts`: launch/terminate app via `simctl`
- **Testable**: can detect a booted simulator and launch an app

### M2: iOS driver (Swift) — HTTP server + screenshot
- Xcode project with XCTest bundle
- FlyingFox HTTP server on port 22087
- `GET /status`, `GET /screenshot`, `GET /deviceInfo`
- Build script, pre-built artifacts
- **Testable**: can start driver, hit /status, take a screenshot

### M3: iOS driver — touch + text + view hierarchy
- `POST /tap` with event synthesis
- `POST /typeText`
- `GET /viewHierarchy` returning element tree as JSON
- **Testable**: can tap on coordinates, type text, query elements

### M4: TypeScript element API
- `by.id()`, `by.text()` locators
- `element().tap()`, `element().type()`
- Element resolution: query view hierarchy, match locator, extract coordinates
- Auto-wait / retry on resolution
- **Testable**: `element(by.id('login')).tap()` works end-to-end

### M5: Screenshot comparison
- odiff integration with `ODiffServer`
- Baseline management (save/load/update)
- Status bar normalization
- **Testable**: `toMatchScreenshot('name')` creates baseline on first run, compares on subsequent

### M6: Vitest integration
- `globalSetup` to start/stop driver
- Custom matchers: `toBeVisible`, `toHaveText`, `toMatchScreenshot`
- Vitest plugin for zero-config
- **Testable**: full test file runs with `bunx vitest`

### M7: Polish for usability
- Good error messages (simulator not booted, app not installed, element not found)
- TypeScript types and JSDoc
- Reasonable defaults for all config
- `UPDATE_SCREENSHOTS=true` workflow

---

## Implementation References

Local file paths and URLs to reference during implementation. Organized by milestone.

### M1: Device Detection & Management

**Maestro — simctl usage (how they detect/manage simulators):**
- `Maestro/maestro-ios-driver/src/main/kotlin/device/SimctlIOSDevice.kt` — simctl wrapper for install, launch, terminate, status bar, open URL

**Detox — device management (JS-side device lifecycle):**
- `Detox/detox/src/devices/runtime/RuntimeDevice.js` — device abstraction (launch, terminate, install, etc.)
- `Detox/detox/src/environmentFactory.js` — how platform-specific components are wired up

### M2: iOS Driver — HTTP Server + Screenshot

**Maestro — the XCTest runner (our primary reference for the Swift driver):**
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/maestro_driver_iosUITests.swift` — **entry point**: XCTest class that starts the HTTP server
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/XCTestHTTPServer.swift` — **HTTP server setup**: route registration, FlyingFox config, port binding
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/Handlers/ScreenshotHandler.swift` — screenshot via `XCUIScreen.main.screenshot()`
- `Maestro/maestro-ios-xctest-runner/MaestroDriverLib/Package.swift` — **FlyingFox dependency** declaration

**Maestro — build & install the driver:**
- `Maestro/maestro-ios-xctest-runner/build-maestro-ios-runner.sh` — **build script**: `xcodebuild build-for-testing` invocation
- `Maestro/maestro-ios-xctest-runner/run-maestro-ios-runner.sh` — how to launch via `xcodebuild test-without-building`
- `Maestro/maestro-ios-driver/src/main/kotlin/xcuitest/installer/LocalXCTestInstaller.kt` — how Maestro installs and starts the XCTest runner on the simulator

**FlyingFox (HTTP server library):**
- https://github.com/swhitty/FlyingFox — lightweight async Swift HTTP server

### M3: iOS Driver — Touch, Text, View Hierarchy

**Maestro — touch synthesis (private XCTest APIs):**
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/XCTest/RunnerDaemonProxy.swift` — **critical**: accesses `XCTRunnerDaemonSession.sharedSession` and calls `_XCT_synthesizeEvent:completion:`
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/XCTest/EventRecord.swift` — wraps `XCSynthesizedEventRecord` (private class)
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/XCTest/PointerEventPath.swift` — creates touch/swipe event paths via `XCPointerEventPath`
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/Handlers/TouchRouteHandler.swift` — **tap handler**: creates EventRecord, adds pointer event, synthesizes via RunnerDaemonProxy

**Maestro — text input:**
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/Handlers/InputTextRouteHandler.swift` — text input via `_XCT_sendString` or keyboard simulation

**Maestro — view hierarchy (accessibility tree):**
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/Handlers/ViewHierarchyHandler.swift` — gets `XCUIApplication.snapshot().dictionaryRepresentation`, converts to AXElement tree
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/Models/AXElement.swift` — **element model**: label, identifier, frame, elementType, children, value, title
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/XCTest/AXClientSwizzler.swift` — **view hierarchy depth fix**: swizzles `XCAXClient_iOS.defaultParameters` to handle deep React Native trees

**Maestro — the Driver interface (what operations a driver exposes):**
- `Maestro/maestro-client/src/main/java/maestro/Driver.kt` — full list of driver operations (tap, swipe, inputText, screenshot, viewHierarchy, etc.)

**Maestro — HTTP client (how the host talks to the driver):**
- `Maestro/maestro-ios-driver/src/main/kotlin/xcuitest/XCTestDriverClient.kt` — Kotlin HTTP client that calls the Swift driver endpoints

### M4: TypeScript Element API

**Detox — TS API design (our primary reference for the element/expect API):**
- `Detox/detox/detox.d.ts` — **full TypeScript API**: ~2000 lines, element matchers, expectations, device API, waitFor
- `Detox/detox/src/ios/expectTwo.js` — iOS expect/assertion implementation
- `Detox/detox/src/android/core/NativeElement.js` — element actions (tap, typeText, scroll, swipe, etc.)
- `Detox/detox/src/android/core/NativeExpect.js` — assertion implementation (toBeVisible, toHaveText, etc.)
- `Detox/detox/src/android/core/NativeMatcher.js` — matcher implementation (by.id, by.text, by.label, etc.)
- `Detox/detox/src/matchers/factories/index.js` — how matchers are created per-platform

**Detox — invocation pattern (how JS calls are serialized to native):**
- `Detox/detox/src/invoke/Invoke.js` — invocation serialization (call, action, target pattern)
- `Detox/detox/ios/Detox/Invocation/InvocationManager.swift` — native side: receives serialized invocations and executes them
- `Detox/detox/ios/Detox/Invocation/Element.swift` — native element resolution and actions
- `Detox/detox/ios/Detox/Invocation/Action.swift` — native action execution (tap, type, scroll, etc.)
- `Detox/detox/ios/Detox/Invocation/Predicate.swift` — native element matching (by id, text, label, traits, etc.)
- `Detox/detox/ios/Detox/Invocation/Expectation.swift` — native assertion execution

**Playwright — locator and assertion patterns:**
- https://playwright.dev/docs/locators — locator API design
- https://playwright.dev/docs/test-assertions — auto-retrying assertion patterns
- https://playwright.dev/docs/actionability — auto-wait checks before actions

### M5: Screenshot Comparison

**odiff:**
- https://github.com/dmtrKovalenko/odiff — SIMD-optimized image comparison
- https://www.npmjs.com/package/odiff-bin — npm package with Node.js API
- Key API: `ODiffServer` (persistent process), `compare()`, `compareBuffers()`, `ignoreRegions`

**Maestro — screenshot comparison:**
- `Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/Handlers/ScreenshotHandler.swift` — how screenshots are captured

**Owl — screenshot workflow patterns:**
- https://github.com/nicklockwood/Owl (screenshot baseline management, status bar normalization)
- See `research/owl-research.md` for analysis of their approach

**Playwright — screenshot comparison API:**
- https://playwright.dev/docs/test-snapshots — `toHaveScreenshot()` API, threshold config, masking, update workflow

### M6: Vitest Integration

**Detox — Jest integration (reference for test runner integration):**
- `Detox/detox/runners/jest/testEnvironment/index.js` — Jest test environment setup
- `Detox/detox/runners/jest/JestCircusEnvironment.js` — Jest Circus integration
- `Detox/detox/runners/jest/globalTeardown.js` — cleanup after all tests
- `Detox/detox/src/DetoxWorker.js` — main worker: holds device, element, expect, by globals

**Vitest — plugin and extension APIs:**
- https://vitest.dev/advanced/api/plugin.html — Vitest plugin API
- https://vitest.dev/guide/extending-matchers.html — custom matchers via `expect.extend()`
- https://vitest.dev/config/#globalsetup — globalSetup for one-time setup/teardown

**Detox — global exports pattern:**
- `Detox/detox/index.d.ts` — how Detox exports device, element, by, expect as globals
- `Detox/detox/globals.d.ts` — TypeScript global augmentation for Detox APIs

### General Architecture References

**Maestro — overall architecture:**
- See `research/maestro-deep-dive.md`
- `Maestro/maestro-android/src/androidTest/java/dev/mobile/maestro/MaestroDriverService.kt` — Android driver (for future Phase 3 reference)

**Detox — overall architecture:**
- See `research/detox-deep-dive.md`
- `Detox/detox/src/client/Client.js` — WebSocket client (we use HTTP instead, but the message patterns are useful)
- `Detox/detox/src/client/AsyncWebSocket.js` — async WebSocket wrapper

**Other research docs:**
- `research/appium-webdriverio-research.md` — how Appium drives apps without custom builds
- `research/owl-research.md` — screenshot comparison patterns
- `research/playwright-vitest-api-patterns.md` — API design patterns to adopt
- `research/odiff-research.md` — odiff API and benchmarks
- `research/synthesis-and-approach.md` — overall architecture and approach
