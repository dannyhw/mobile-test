# mobile-test

TypeScript-first end-to-end tests for iOS and Android apps, with screenshot
comparison built in. Tests run in Vitest. Devices are driven through
[agent-device](https://github.com/callstack/agent-device), so there is no
native code to build and no SDK to add to your app.

```ts
import { describe, it, expect } from "vitest";
import { device, element, by } from "mobile-test";

describe("Login", () => {
  it("logs in", async () => {
    await device.launch({ path: "/login" });

    await element(by.id("email")).type("user@example.com");
    await element(by.id("password")).type("secret");
    await element(by.id("login-button")).tap();

    await expect(element(by.text("Welcome back"))).toBeVisible();
    await expect(device).toMatchScreenshot("home");
  });
});
```

## Requirements

- Node 18+ and [Bun](https://bun.sh) (or npm/pnpm)
- macOS with Xcode for iOS simulators; Android SDK with `adb` on your `PATH`
  for emulators
- A booted simulator or emulator with your app installed. The app needs no
  test build; only `testID`s on the elements you want to find.

## Setup

```bash
bun add -d mobile-test vitest
```

`vitest.config.mts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import { defineConfig as defineMobileTestConfig, mobileTestProjects } from "mobile-test";

const mobileTest = defineMobileTestConfig({
  app: {
    ios: { bundleId: "com.example.app", scheme: "example" },
    android: { appId: "com.example.app", scheme: "example" },
  },
  projects: [
    { name: "ios-simulator", platform: "ios" },        // first booted simulator
    { name: "android-emulator", platform: "android" }, // first booted emulator
  ],
  screenshots: { dir: "./.screenshots" },
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
```

Add the matcher types to your `tsconfig.json`:

```json
{ "compilerOptions": { "types": ["mobile-test/matchers"] } }
```

Run:

```bash
bunx vitest run --project ios-simulator
bunx vitest run --project android-emulator
UPDATE_SCREENSHOTS=true bunx vitest run --project ios-simulator   # accept new baselines
```

The first run on a fresh simulator builds agent-device's iOS runner with
Xcode, which takes a few minutes. Later runs reuse the cached runner. In CI,
run `agent-device prepare ios-runner` once after booting the simulator.

Any installed build of your app works: a release build with the bundle
embedded, or a debug build served by Metro while you iterate. Screenshot
baselines are shared between the two; the builds render a few pixels
differently, so set `screenshots.maxDiffPercentage` to a small value (the
example app uses `0.01`) if you switch between them.

## API

### Device

```ts
await device.launch()                       // configured app, fresh start
await device.launch({ path: "/settings" })  // scheme://settings
await device.launch({ url: "other://x", bundleId: "com.other.app" })
await device.openUrl({ path: "/settings" }) // onto the running app
await device.terminate("com.example.app")
await device.install("./build/app.apk")     // for the configured app id
await device.waitForAnimationToEnd()        // screenshot-diff based
await device.hideKeyboard()
await device.pressHome()
await device.setLocation(37.7749, -122.4194)
```

### Elements

```ts
element(by.id("submit"))            // testID / accessibilityIdentifier / resource-id
element(by.text("Sign in"))         // label, value or title; string or RegExp
element(by.label(/item \d+/i))
element(by.role("button"))          // lowercase XCUIElementType name on iOS, class name on Android
element(by.id("row")).atIndex(2)
element(by.id("cell").withAncestor(by.id("list")))

await el.tap(); await el.doubleTap(); await el.longPress(1.5)
await el.type("text"); await el.replaceText("text"); await el.clear()
await el.swipe("up"); await el.scrollTo(target); await el.scrollToEnd("down")
await el.isVisible(); await el.exists(); await el.getText()
```

### Assertions (auto-retry until `actionTimeout`)

```ts
await expect(el).toBeVisible()
await expect(el).not.toBeVisible()
await expect(el).toHaveText("3")
await expect(el).toHaveValue("Alice")
await expect(el).toBeEnabled()

await expect(device).toMatchScreenshot("home")
await expect(device).toMatchScreenshot("home", {
  threshold: 0.1,            // per-pixel color sensitivity
  maxDiffPercentage: 0.5,    // fail above this
  antialiasing: true,
  mask: [element(by.id("clock"))],
})
await expect(element(by.id("avatar"))).toMatchScreenshot("avatar")
```

Baselines live in `<screenshots.dir>/baseline/<device name>/`, the latest run
in `latest/`, and diff images in `diff/`. A missing baseline is created on
first run.

## Configuration

| Option | Default | Notes |
|---|---|---|
| `app.ios` | | `{ bundleId, scheme }` or a bundle id string |
| `app.android` | | `{ appId, scheme }` or a package name string |
| `projects[]` | auto | `{ name, platform, device? }`; `device` is a simulator/emulator name or id. Omit it to use the first booted one. |
| `screenshots.dir` | `./screenshots` | |
| `screenshots.threshold` | `0.1` | |
| `screenshots.maxDiffPercentage` | `0` | |
| `screenshots.antialiasing` | `true` | |
| `screenshots.pixelDensity` | auto | iOS simulator scale (2 for iPad/SE, 3 for iPhone); detected when omitted |
| `actionTimeout` | `5000` | ms to wait for an element or assertion |
| `logLevel` | `info` | `debug` prints per-call timings |

## Troubleshooting

From a checkout of this repo, `packages/mobile-test` has a quick health check
that lists devices, opens your app through agent-device, and times a
snapshot and a screenshot:

```bash
bun run check-device -- --platform ios --app com.example.app
bun run check-device -- --platform android --app com.example.app --device emulator-5554
```

## How it works

- Each Vitest project opens one agent-device session, claims the selected
  device and warms the runner before tests start.
- Elements are resolved from agent-device's raw accessibility snapshot; locator
  matching happens in TypeScript, so `RegExp`, `atIndex` and `withAncestor`
  work the same on both platforms.
- Coordinates are logical points on iOS and device pixels on Android, matching
  each platform's snapshot.
- Screenshots are compared with [odiff](https://github.com/dmtrKovalenko/odiff).

## Known limitations

- Android reports the placeholder of an empty `TextInput` as its value, so
  `toHaveValue("")` does not pass on Android yet (agent-device does not expose
  the hint flag).
- `element.clear()` sends delete keys; on Android that goes through `adb`.
- Keyboard dismissal on iOS falls back to pressing return, then swiping and
  tapping, because the simulator keyboard has no dismiss key.
- Only one Vitest worker may drive a device at a time (`fileParallelism: false`).
