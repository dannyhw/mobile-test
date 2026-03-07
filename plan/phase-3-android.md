# Phase 3: Android Support — Detailed Plan

> Goal: Add Android emulator/device support using the same HTTP/JSON protocol as iOS. A single test file should run on both platforms.

---

## Overview

Mirror the iOS driver architecture:
- Kotlin UIAutomator instrumentation test APK (replaces Swift XCTest runner)
- Same HTTP/JSON endpoints as iOS driver
- ADB for device management (replaces `xcrun simctl`)
- Port forwarding via `adb forward`

## Milestones

### M1: Android Device Detection & Management

**Implementation:**
- `adb devices` to detect connected emulators/devices
- `adb install` / `adb shell am start` / `adb shell am force-stop` for app lifecycle
- Support optional deep-link launch via `adb shell am start -a android.intent.action.VIEW -d <url>`
- `adb shell screencap` for basic screenshots (fallback before driver is ready)

**Files to create/modify:**
- `src/device/android-device.ts` — `AndroidDevice` implementing `Device` interface
- `src/device/detect.ts` — add Android detection alongside iOS

### M2: Android Driver — HTTP Server + Core Endpoints

Kotlin UIAutomator instrumentation test that starts an HTTP server.

**Endpoints (same as iOS):**
- `GET /status` — health check
- `GET /deviceInfo` — screen dimensions
- `GET /screenshot` — PNG capture via `UiAutomation.takeScreenshot()`
- `GET /viewHierarchy` — accessibility tree via `UiDevice.dumpWindowHierarchy()`
- `POST /tap` — `UiDevice.click(x, y)`
- `POST /swipe` — `UiDevice.swipe()`
- `POST /typeText` — `UiDevice.pressKeyCode()` or instrumentation
- `POST /launchApp` — `am start` with optional deep-link URL
- `POST /terminateApp` — `am force-stop`

**Build & distribution:**
- Pre-built APK shipped in npm package (like the iOS .app)
- Debug-signed (works on emulators without config)
- Installed via `adb install` at test start

**Files to create:**
- `android-driver/` — Kotlin project with Gradle build
- `src/driver/installer.ts` — add Android driver install/launch logic

### M3: Port Forwarding & Connection

- `adb forward tcp:<port> tcp:<port>` to expose driver HTTP server
- Same `DriverClient` class works (just different port/host)
- Handle multiple devices (use `-s <serial>` flag)

### M4: Cross-Platform Test Config

**API:**
```typescript
export default defineConfig({
  app: {
    ios: {
      bundleId: 'com.example.myapp',
      scheme: 'myapp',
    },
    android: 'com.example.myapp',
  },
  projects: [
    { name: 'iphone-16', platform: 'ios', device: 'iPhone 16' },
    { name: 'pixel-9', platform: 'android', device: 'Pixel 9' },
  ],
})
```

**Implementation:**
- Config accepts per-platform bundle IDs
- `projects` array for multi-device runs
- Auto-detect platform from running simulators/emulators
- Screenshot baselines organized by device name (already works)

### M5: View Hierarchy Normalization

Android's `dumpWindowHierarchy()` returns XML with different attribute names than iOS. Normalize to the same `ElementHandle` structure.

**Mapping:**
- `resource-id` → `identifier`
- `text` → `label` / `value`
- `content-desc` → `label`
- `class` → `elementType`
- `bounds` → `frame`
- `enabled` / `clickable` → `enabled`

---

## Implementation Order

1. M1: Device detection (get `adb devices` working)
2. M2: Android driver (Kotlin HTTP server — biggest piece)
3. M3: Port forwarding
4. M5: View hierarchy normalization
5. M4: Cross-platform config
