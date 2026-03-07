# mobile-test — Roadmap & Architecture

> Overall architecture, API design, and phased implementation plan.
> See [research/](./research/) for deep dives: [Maestro](./research/maestro-deep-dive.md), [Detox](./research/detox-deep-dive.md), [Appium/WDIO](./research/appium-webdriverio-research.md), [Owl](./research/owl-research.md), [Playwright/Vitest](./research/playwright-vitest-api-patterns.md)
> See [plan/](./plan/) for detailed phase implementation plans.

---

## The Core Problem

Every existing tool makes a fundamental tradeoff:

| Tool | No custom build? | TS API? | Screenshot testing? | Simple setup? |
|------|-----------------|---------|-------------------|---------------|
| Maestro | Yes | No (YAML only) | Basic | Yes |
| Detox | **No** | Yes | No | No |
| Appium/WDIO | Yes | Yes | No (plugin) | No |
| Owl | Partial | Yes | Yes | Partial |

**Our goal: Yes to all four columns.**

---

## Key Architectural Insight: The Driver App Pattern

The single most important finding is how Maestro achieves zero-config:

**It installs its own driver app onto the device at runtime.** The driver app uses OS-level accessibility APIs to interact with ANY app — no custom builds, no SDK injection, no app code changes needed.

- **iOS**: A pre-built XCTest runner bundle is installed on the simulator. It starts an HTTP server and uses XCUITest accessibility APIs + private Apple APIs for touch synthesis.
- **Android**: Two APKs (a driver service + instrumentation test) are installed via ADB. The service uses UIAutomator (`UiDevice`/`UiAutomation`) and exposes a gRPC server.

**This is the approach we must adopt**, but simplified:

### What we keep from Maestro
- Pre-built driver apps installed at runtime (the zero-config magic)
- XCUITest accessibility APIs for iOS
- UIAutomator for Android
- Screenshots via native APIs (`XCUIScreen.main.screenshot()` on iOS, `UiAutomation.takeScreenshot()` on Android)

### What we fix from Maestro
- **Unified protocol**: HTTP/JSON for both platforms (Maestro uses HTTP for iOS, gRPC for Android — unnecessary split)
- **Fewer layers**: Maestro's iOS has 4 layers of abstraction. We need 2: TS client -> native driver
- **TypeScript all the way**: Host-side code is TS, not Kotlin/JVM
- **Proper screenshot comparison**: Built-in baseline management, approval workflow, region masking

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  User Test Code (TypeScript)                     │
│  describe('Login', () => {                       │
│    it('shows welcome screen', async () => {      │
│      await device.launch({                       │
│        path: '/welcome'                          │
│      })                                          │
│      await expect(screen).toMatchScreenshot()    │
│    })                                            │
│  })                                              │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Test Framework Core (TypeScript/Node.js)        │
│  - Vitest as test runner                         │
│  - Device/element/expect APIs                    │
│  - Screenshot comparison (odiff)            │
│  - Auto-waiting logic                            │
│  - Device lifecycle management                   │
└────────────────┬────────────────────────────────┘
                 │ HTTP/JSON
┌────────────────▼────────────────────────────────┐
│  Driver App (runs on simulator/emulator)         │
│                                                  │
│  iOS: Swift XCTest runner bundle                 │
│  - HTTP server (lightweight, e.g. Swifter/Vapor) │
│  - XCUITest accessibility APIs for element tree  │
│  - Private XCTest APIs for touch synthesis       │
│  - XCUIScreen for screenshots                    │
│                                                  │
│  Android: Kotlin UIAutomator service             │
│  - HTTP server (e.g. NanoHTTPD)                  │
│  - UIAutomator for element tree + interactions   │
│  - UiAutomation for screenshots                  │
│  - Installed via ADB at runtime                  │
└─────────────────────────────────────────────────┘
```

---

## API Design

Inspired by Playwright + Detox, familiar to anyone who uses Vitest/Jest:

### Test Structure (Vitest-native)

```typescript
import { describe, it, expect } from 'vitest'
import { device, by, element } from 'mobile-test'

describe('Login Flow', () => {
  it('should show welcome screen', async () => {
    await device.launch({
      path: '/welcome',
    })

    // Take and compare screenshot
    await expect(device).toMatchScreenshot('welcome-screen')
  })

  it('should login successfully', async () => {
    // Locate by test ID (accessibility identifier)
    await element(by.id('email-input')).type('user@example.com')
    await element(by.id('password-input')).type('password123')
    await element(by.id('login-button')).tap()

    // Wait for element + assert
    await expect(element(by.id('home-screen'))).toBeVisible()

    // Screenshot comparison
    await expect(device).toMatchScreenshot('home-screen')
  })
})
```

### Locator Strategy (Playwright-inspired)

```typescript
// Primary: test IDs (maps to accessibilityIdentifier on iOS, content-description on Android)
element(by.id('submit-button'))

// Text matching
element(by.text('Sign In'))
element(by.text(/welcome/i))  // regex support

// Chaining/filtering (from Detox)
element(by.id('cell')).atIndex(2)
element(by.id('item').withAncestor(by.id('list')))

// Convenience shortcuts (Playwright-style)
device.getByTestId('submit-button')  // alias for element(by.id(...))
device.getByText('Sign In')          // alias for element(by.text(...))
```

### Actions

```typescript
// Taps
await element(by.id('button')).tap()
await element(by.id('button')).longPress()
await element(by.id('button')).doubleTap()

// Text input
await element(by.id('input')).type('hello')
await element(by.id('input')).clear()
await element(by.id('input')).replaceText('new text')

// Scrolling
await element(by.id('list')).scroll('down', 300)
await element(by.id('list')).scrollTo(element(by.id('item-50')))

// Swipe
await element(by.id('card')).swipe('left')

// Device-level
await device.launch()
await device.launch({ path: '/form' })  // uses configured scheme
await device.launch({ bundleId: 'com.example.otherapp', url: 'otherapp://deep-link' })
await device.pressBack()        // Android back
await device.pressHome()
await device.openUrl({ path: '/form' })  // uses configured scheme
await device.setLocation(37.7749, -122.4194)
```

### Assertions (Playwright-style auto-retrying)

```typescript
// Element assertions - auto-retry until timeout
await expect(element(by.id('title'))).toBeVisible()
await expect(element(by.id('title'))).toHaveText('Welcome')
await expect(element(by.id('title'))).not.toBeVisible()
await expect(element(by.id('button'))).toBeEnabled()

// Screenshot assertions - built-in and important
await expect(device).toMatchScreenshot('screen-name')
await expect(device).toMatchScreenshot('screen-name', {
  threshold: 0.1,                  // color difference sensitivity (0-1)
  maxDiffPercentage: 1,            // fail if >1% of pixels differ
  antialiasing: true,              // ignore antialiasing differences
  mask: [element(by.id('clock'))], // mask dynamic content (uses odiff ignoreRegions)
})

// Element-level screenshots
await expect(element(by.id('avatar'))).toMatchScreenshot('avatar')
```

### Configuration

```typescript
// mobile-test.config.ts
import { defineConfig } from 'mobile-test'

export default defineConfig({
  // App configuration
  app: {
    ios: {
      bundleId: 'com.example.myapp',
      scheme: 'myapp',
    },
    android: 'com.example.myapp',    // package name (or path to .apk)
  },

  // Device targets
  // If omitted, auto-detects the currently running simulator/emulator
  // projects: [
  //   { name: 'iphone-16', device: 'iPhone 16' },
  //   { name: 'pixel-9', device: 'Pixel 9' },
  // ],

  // Screenshot comparison (powered by odiff)
  screenshots: {
    dir: './screenshots',
    threshold: 0.1,              // color sensitivity (0-1, lower = stricter)
    maxDiffPercentage: 1,        // fail above this % of different pixels
    antialiasing: true,          // ignore antialiasing diffs
    updateBaselines: process.env.UPDATE_SCREENSHOTS === 'true',
  },

  // Timeouts
  timeout: 30_000,
  actionTimeout: 5_000,
})
```

---

## How Each Piece Works (Implementation Plan)

### 1. Device Management (TypeScript)

Uses native CLI tools directly — no server processes, no Java:

```
iOS:  xcrun simctl boot/shutdown/install/launch/screenshot
Android: adb devices/install/shell/am/screencap
```

**Auto-detection of running devices (default behavior):**

When no `projects` are configured, the framework automatically detects running simulators/emulators:

- **iOS**: `xcrun simctl list devices booted --json` — returns all booted simulators with UDID, name, and OS version
- **Android**: `adb devices` — returns connected emulators/devices

Resolution order:
1. If `projects` is specified in config, use those exact targets (boot if needed)
2. If omitted, detect currently running simulators/emulators
3. If multiple are running, use the first booted one (or let the user pick via CLI flag `--device`)
4. If none are running, error with a helpful message suggesting which to boot

This matches Maestro's zero-config behavior — developers already have a simulator open while working, so tests just target it automatically.

Key commands:
- `xcrun simctl boot "iPhone 16"` — boot simulator
- `xcrun simctl install booted /path/to/app.app` — install app
- `xcrun simctl launch booted com.example.app` — launch app
- `xcrun simctl openurl booted myapp://deep-link` — open a deep link after launch when requested
- `adb install /path/to/app.apk` — install on Android
- `adb shell am start -n com.example.app/.MainActivity` — launch on Android
- `adb shell am start -a android.intent.action.VIEW -d myapp://deep-link` — launch via deep link on Android

### 2. Driver Apps (Swift / Kotlin)

Pre-built binaries shipped with the npm package. Installed onto the device at test start.

**iOS Driver (Swift)**:
- XCTest UI test runner bundle (like Maestro's approach)
- Starts lightweight HTTP server on a known port (e.g., localhost:8100)
- Endpoints: `POST /tap`, `POST /type`, `GET /screenshot`, `GET /tree`, etc.
- Uses `XCUIApplication(bundleIdentifier:)` to attach to any running app
- Uses `XCUIElement.snapshot` for view hierarchy
- Uses XCTest touch synthesis for interactions
- Uses `XCUIScreen.main.screenshot()` for screenshots

**Android Driver (Kotlin)**:
- UIAutomator instrumentation test APK (like Maestro's approach)
- Starts HTTP server (NanoHTTPD) on a known port
- Same REST endpoints as iOS for unified interface
- Uses `UiDevice` for interactions and hierarchy
- Uses `UiAutomation.takeScreenshot()` for screenshots
- Port-forwarded via `adb forward tcp:8100 tcp:8100`

### 3. Screenshot Comparison (TypeScript)

Built-in, first-class, not an afterthought:

- **Capture**: Native screenshots via driver apps (full device resolution)
- **Normalize**: `xcrun simctl status_bar` to fix time/battery (from Owl)
- **Compare**: [odiff](https://github.com/dmtrKovalenko/odiff) — SIMD-optimized native image comparison, ~6x faster than odiff. Written in Zig with SSE2/AVX2/NEON support. Key advantages:
  - Built-in `ignoreRegions` option (no manual masking needed)
  - `antialiasing` detection to reduce false positives
  - `layout-diff` detection (catches size changes separately from pixel diffs)
  - Returns `diffPercentage` directly (no manual calculation)
  - `ODiffServer` mode keeps a persistent process for fast sequential comparisons
  - Prebuilt binaries for all platforms via `odiff-bin` npm package
- **Baseline management**: `screenshots/baseline/`, `screenshots/latest/`, `screenshots/diff/`
- **Update workflow**: `UPDATE_SCREENSHOTS=true bunx vitest` to accept new baselines
- **Per-platform baselines**: Separate baselines per device/platform automatically

### 4. Test Runner Integration

**Use Vitest directly** — don't build a custom runner:

- Custom Vitest reporter for mobile-specific output
- `globalSetup` to boot devices and install driver apps
- `beforeAll`/`afterAll` hooks for app lifecycle
- Custom matchers via `expect.extend()` for `toMatchScreenshot()`, `toBeVisible()`, etc.

---

## What Makes This Different From Each Tool

### vs Maestro
- TypeScript API instead of YAML — full programming language, IDE support, type safety
- Built-in screenshot comparison with proper workflow
- Extensible — users can write helpers, abstractions, shared utilities
- Runs in Vitest — familiar to every TS/JS developer
- Same zero-config device interaction (driver app pattern)

### vs Detox
- No custom builds required — driver app pattern instead of in-process injection
- Much simpler setup — no `detox build` step, no native config changes
- No WebSocket complexity — simple HTTP from TS to driver
- Built-in screenshot testing
- Trade-off: we lose idle-state synchronization (use auto-waiting + timeouts instead, like Playwright)

### vs Appium/WDIO
- No Java server to install and run
- No WebDriverAgent build/signing headaches
- Direct native tool usage instead of WebDriver protocol layers
- Built-in screenshot comparison
- Purpose-built for mobile instead of generic automation protocol

### vs Owl
- Real native touch simulation instead of calling JS callbacks
- Works with native apps, not just React Native
- No React.createElement patching
- Proper element querying via accessibility tree
- Same good ideas: native screenshots, odiff, simctl status_bar normalization

---

## Open Questions / Risks

1. **iOS driver distribution**: Shipping a pre-built XCTest runner in an npm package means it must be signed or the simulator must allow unsigned test runners. Maestro solves this — need to study how.

2. **Private Apple APIs**: Maestro uses `_XCT_synthesizeEvent` for touch synthesis. These are undocumented and could break with Xcode updates. Alternative: use `XCUIElement.tap()` through the accessibility tree, which is public API but requires finding elements first.

3. **Driver startup time**: Installing and launching the driver app adds overhead. Maestro takes 10-120s for cold start. We should keep the driver running between tests and only restart when needed.

4. **Synchronization without in-process access**: Detox's main advantage is knowing when the app is idle (animations done, network settled). Without in-process injection, we must rely on:
   - Element visibility polling (like Playwright's auto-wait)
   - Configurable timeouts
   - Optional explicit waits
   - This is a reasonable trade-off for zero-config.

5. **Android driver signing**: UIAutomator APKs need to be signed. We can use debug signing which works on emulators without configuration.

---

## Implementation Phases

Detailed plans for each phase live in [`plan/`](./plan/).

1. **Phase 1 — iOS Simulator MVP** ✅ [plan](./plan/phase-1-ios-mvp.md)
   - Swift XCTest driver with HTTP server (tap, type, screenshot, element tree)
   - TypeScript client that talks to driver over HTTP
   - Basic device management via `xcrun simctl`
   - Screenshot capture and odiff comparison
   - Vitest integration with `toMatchScreenshot()`
   - Basic locators: `by.id()`, `by.text()`

2. **Phase 2 — Full iOS + Screenshot Workflow** 🔜 [plan](./plan/phase-2-full-ios.md)
   - Region masking for dynamic content
   - Element-level screenshots
   - Additional locators (`by.type()`, `by.label()`, chaining)
   - Additional actions (`doubleTap()`, `replaceText()`, `scrollTo()`)
   - Additional assertions (`toBeEnabled()`, `toHaveAttribute()`)

3. **Phase 3 — Android Support** [plan](./plan/phase-3-android.md)
   - Kotlin UIAutomator driver with HTTP server (same API as iOS)
   - ADB-based device management
   - Port forwarding setup
   - Cross-platform test running

4. **Phase 4 — Polish** [plan](./plan/phase-4-polish.md)
   - CLI tool (`bunx mobile-test init`, `bunx mobile-test run`)
   - HTML report with screenshot diffs
   - CI/CD guidance and examples
   - Documentation
