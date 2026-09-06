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

## Key Architectural Decision: agent-device as the device backend

The framework does not ship native code. All device interaction goes through
[agent-device](https://github.com/callstack/agent-device)'s typed Node client
(`createAgentDeviceClient`), which installs and maintains its own XCTest runner
on iOS and an accessibility snapshot helper on Android. That keeps the
zero-config model (no custom app build, no app code changes beyond test IDs)
without owning Swift or Kotlin.

This replaced an earlier in-house design (a Swift XCTest driver and a Kotlin
UIAutomator driver talking HTTP/JSON to the TypeScript client). Both worked,
but maintaining two native drivers was the bulk of the project's surface area.
The POC that made the switch, with measurements, is in
[plan/poc-agent-device-backend.md](./plan/poc-agent-device-backend.md) and
[research/agent-device-programmatic-api.md](./research/agent-device-programmatic-api.md).

### What we keep from the original design
- Auto-detection of the booted simulator/emulator, no config required
- Accessibility-tree element resolution with TypeScript-side locator matching
- Native screenshots compared with odiff, with baselines, masks and crops
- Vitest as the runner; Playwright-style auto-retrying assertions

### What agent-device gives us
- The iOS runner and Android helper, built and cached by agent-device
- Sessions and device claims, so parallel projects do not fight over devices
- Physical devices, tvOS, device clouds and remote proxies without extra work

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  User Test Code (TypeScript)                     │
│  describe('Login', () => {                       │
│    it('shows welcome screen', async () => {      │
│      await device.launch({ path: '/welcome' })   │
│      await expect(device).toMatchScreenshot()    │
│    })                                            │
│  })                                              │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Test Framework Core (TypeScript/Node.js)        │
│  - Vitest as test runner                         │
│  - Device/element/expect APIs                    │
│  - Screenshot comparison (odiff)                 │
│  - Auto-waiting logic                            │
└────────────────┬────────────────────────────────┘
                 │ Backend interface (points, frames, ElementHandle)
┌────────────────▼────────────────────────────────┐
│  AgentDeviceBackend (TypeScript)                 │
│  createAgentDeviceClient() → agent-device daemon │
│    iOS: XCTest runner (agent-device's)           │
│    Android: adb + snapshot helper (agent-device's)│
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

### 2. Device Backend (agent-device)

`src/backend/agent-device.ts` implements the `Backend` interface over
agent-device's client:

- `snapshot()` → `capture.snapshot({ raw: true, forceFull: true })`, rebuilt into
  an `ElementHandle` tree (`src/backend/snapshot-tree.ts`)
- `screenshot()` → `capture.screenshot({ pixelDensity: 3 })` on iOS simulators,
  native pixels on Android
- `tap`/`swipe`/`typeText`/`replaceText` → `press`, `pan`, `type`, `fill`
- `launchApp` → `apps.open({ app, url, relaunch: true })`
- Clear text: delete key per character (`"\b"` through XCTest on iOS, adb
  `KEYCODE_DEL` on Android), since agent-device has no clear command

Vitest `globalSetup` picks the device with `devices.list`, opens one session
per Vitest project, and workers attach to that session by name.

### 3. Screenshot Comparison (TypeScript)

Built-in, first-class, not an afterthought:

- **Capture**: Native screenshots via agent-device (device pixels; iOS simulators at the device scale)
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
- `globalSetup` to select the device and open the agent-device session
- `beforeAll`/`afterAll` hooks for app lifecycle
- Custom matchers via `expect.extend()` for `toMatchScreenshot()`, `toBeVisible()`, etc.

---

## What Makes This Different From Each Tool

### vs Maestro
- TypeScript API instead of YAML — full programming language, IDE support, type safety
- Built-in screenshot comparison with proper workflow
- Extensible — users can write helpers, abstractions, shared utilities
- Runs in Vitest — familiar to every TS/JS developer
- Same zero-config device interaction (agent-device installs its own runner)

### vs Detox
- No custom builds required — accessibility-driven runner instead of in-process injection
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

1. **agent-device is a moving dependency.** Pinned to an exact version; agent-device
   types never cross the `Backend` seam, so upgrades stay internal.

2. **Android empty text fields.** agent-device's Android snapshot reports the hint
   text as the value of an empty `EditText` and exposes no hint flag, so
   `toHaveValue("")` cannot pass on Android until that is added upstream.

3. **Per-call latency.** Observation through the daemon is 2-3x slower than the
   old raw HTTP driver (snapshot ~200ms vs ~60ms), while launches, typing and
   clearing are 3-4x faster. The example suite is ~25% faster overall.

4. **Synchronization without in-process access**: as before, we rely on element
   polling and screenshot-diff animation waits; agent-device's `wait stable`
   rarely settles on React Native screens.

5. **Baselines are backend-specific.** agent-device's iOS capture includes the
   Dynamic Island cutout; switching capture paths requires regenerating baselines.

---

## Implementation Phases

Detailed plans for each phase live in [`plan/`](./plan/).

> **agent-device POC (done):** the in-house Swift/Kotlin drivers were replaced by agent-device's Node client while keeping the TS API and Vitest runner. See [plan/poc-agent-device-backend.md](./plan/poc-agent-device-backend.md).

1. **Phase 1 — iOS Simulator MVP** ✅ [plan](./plan/phase-1-ios-mvp.md)
   - Swift XCTest driver with HTTP server (tap, type, screenshot, element tree) — since replaced by agent-device
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

3. **Phase 3 — Android Support** ✅ [plan](./plan/phase-3-android.md)
   - Kotlin UIAutomator driver with HTTP server (same API as iOS) — since replaced by agent-device
   - ADB-based device management
   - Port forwarding setup
   - Cross-platform test running

4. **Phase 4 — Polish** [plan](./plan/phase-4-polish.md)
   - CLI tool (`bunx mobile-test init`, `bunx mobile-test run`)
   - HTML report with screenshot diffs
   - CI/CD guidance and examples
   - Documentation
