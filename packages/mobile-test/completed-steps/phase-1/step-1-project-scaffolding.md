# Step 1: Project Scaffolding

Set up the TypeScript project structure, build tooling, and initial source files so we have a working foundation to build on.

**When done**: `bun install` works, `bun run build` compiles TypeScript, `bun test` runs unit tests, and `import { device, element, by } from 'mobile-test'` resolves correctly.

---

## Package Setup

- [x] Create `package.json`
  - name: `mobile-test`
  - type: `module` (ESM)
  - exports: `{ ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }`
  - dependencies: `odiff-bin`, `execa`
  - peerDependencies: `vitest`
  - devDependencies: `typescript`, `tsup`, `vitest`
  - scripts: `build`, `dev`, `test`

- [x] Create `tsconfig.json`
  - target: `ES2022`
  - module: `ESNext` / `NodeNext`
  - moduleResolution: `NodeNext` or `Bundler`
  - strict: `true`
  - outDir: `dist`
  - rootDir: `src`
  - declaration: `true`
  - sourceMap: `true`

- [x] Create `tsup.config.ts`
  - entry: `src/index.ts`
  - format: `esm`
  - dts: `true`
  - sourcemap: `true`
  - clean: `true`

- [x] Create `.gitignore`
  - `node_modules/`, `dist/`, `screenshots/latest/`, `screenshots/diff/`

- [x] Run `bun install` and verify it works

## Source File Skeleton

Create the initial source files with types and placeholder implementations. These will be filled in during later steps, but the structure and exports need to exist now.

- [x] Create `src/index.ts` — public API barrel export
  ```typescript
  export { device } from './device/index.js'
  export { element } from './element/element.js'
  export { by } from './element/by.js'
  export { defineConfig } from './config.js'
  ```

- [x] Create `src/config.ts` — config types and `defineConfig` helper
  - `MobileTestConfig` interface with: `app` (ios/android bundle IDs), `projects` (optional device targets), `screenshots` (dir, threshold, maxDiffPercentage, antialiasing, updateBaselines), `timeout`, `actionTimeout`
  - `defineConfig(config: MobileTestConfig): MobileTestConfig` — identity function for type inference
  - Sensible defaults: timeout 30s, actionTimeout 5s, screenshots dir `./screenshots`, threshold 0.1, antialiasing true
  - Reference: `../research/synthesis-and-approach.md` lines 192-221 for the config shape

- [x] Create `src/device/types.ts` — Device interface
  ```typescript
  interface Device {
    name: string
    udid: string
    platform: 'ios' | 'android'
    launch(bundleId: string): Promise<void>
    terminate(bundleId: string): Promise<void>
    install(appPath: string): Promise<void>
    takeScreenshot(): Promise<Buffer>
    openUrl(url: string): Promise<void>
  }
  ```
  - Reference: `../Maestro/maestro-client/src/main/java/maestro/Driver.kt` for the full operation list
  - Reference: `../Detox/detox/detox.d.ts` for the Detox device type (search for `interface DeviceFacade`)
  - Reference: `../research/phase-1-plan.md` lines 137-164 for our device class sketch

- [x] Create `src/device/detect.ts` — auto-detect booted simulators
  - `detectBootedSimulators()`: runs `xcrun simctl list devices booted --json`, parses JSON, returns array of `{ udid, name, state, runtime }`
  - `getDefaultDevice()`: calls `detectBootedSimulators()`, returns first booted one, throws with helpful message if none found
  - Use `execa` to run the command
  - Reference: `../Maestro/maestro-ios-driver/src/main/kotlin/device/SimctlIOSDevice.kt` for how Maestro parses simctl output

- [x] Create `src/device/ios-device.ts` — IOSDevice class (stub)
  - Implements `Device` interface
  - Constructor takes `udid` and `name`
  - Methods are stubs that will be wired to the driver client in Step 2+
  - `launch()` / `terminate()` use `xcrun simctl launch/terminate` via `execa`
  - `install()` uses `xcrun simctl install` via `execa`
  - `takeScreenshot()` — stub, throws "driver not connected"
  - `openUrl()` uses `xcrun simctl openurl` via `execa`

- [x] Create `src/device/index.ts` — device singleton export
  - Exports a `device` proxy or lazy-initialized singleton
  - Actual device instance is set during test setup (vitest globalSetup)
  - For now, throw "device not initialized — are you running inside a test?" if accessed before setup

- [x] Create `src/element/by.ts` — locator builders
  - `Locator` class with `type` ('id' | 'text') and `value` (string | RegExp)
  - `by.id(id: string): Locator`
  - `by.text(text: string | RegExp): Locator`
  - Reference: `../Detox/detox/detox.d.ts` (search for `interface ByFacade`)
  - Reference: `../research/playwright-vitest-api-patterns.md` for the locator pattern

- [x] Create `src/element/types.ts` — element types
  - `ElementHandle` interface: `{ label, identifier, frame: { x, y, width, height }, elementType, value, children }`
  - This maps to the AXElement model from the iOS driver
  - Reference: `../Maestro/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/Models/AXElement.swift`

- [x] Create `src/element/element.ts` — Element class (stub)
  - `element(locator: Locator): Element`
  - `Element` class with: `tap()`, `type(text)`, `clear()`, `longPress()`, `isVisible()`, `getText()`
  - All methods are stubs that throw "driver not connected" for now
  - These will be wired to the driver client + view hierarchy resolution in Step 4
  - Reference: `../Detox/detox/detox.d.ts` (search for `interface IndexableNativeElement`)
  - Reference: `../research/phase-1-plan.md` lines 297-324 for element resolution logic

- [x] Create `src/driver/protocol.ts` — shared HTTP protocol types
  - Request/response types for each driver endpoint:
    - `TapRequest: { x: number, y: number }`
    - `TypeTextRequest: { text: string }`
    - `LaunchAppRequest: { bundleId: string }`
    - `TerminateAppRequest: { bundleId: string }`
    - `DeviceInfoResponse: { widthPoints, heightPoints, widthPixels, heightPixels, scale }`
    - `ViewHierarchyResponse: ElementHandle` (tree)
  - Reference: `../research/phase-1-plan.md` lines 179-191 for the endpoint table

- [x] Create `src/driver/client.ts` — DriverClient class (stub)
  - `DriverClient` class with `baseUrl` constructor param (default `http://localhost:22087`)
  - Methods: `status()`, `tap()`, `typeText()`, `screenshot()`, `viewHierarchy()`, `launchApp()`, `terminateApp()`, `deviceInfo()`
  - Implement using `fetch` (Node 18+ built-in, no extra dependency)
  - For now just the class structure — actual HTTP calls can be implemented here or in Step 2
  - Reference: `../Maestro/maestro-ios-driver/src/main/kotlin/xcuitest/XCTestDriverClient.kt` for Maestro's client

- [x] Create `src/vitest/setup.ts` — globalSetup placeholder
  - Export `setup()` and teardown function
  - Stub: detect device, log which simulator was found
  - Will be filled in during Step 6
  - Reference: `../Detox/detox/runners/jest/testEnvironment/index.js`

- [x] Create `src/vitest/plugin.ts` — vitest plugin placeholder
  - `mobileTestPlugin()` function returning a Vitest plugin object
  - Sets `globalSetup` and `setupFiles`
  - Reference: https://vitest.dev/advanced/api/plugin.html

- [x] Create `src/expect/matchers.ts` — custom matcher stubs
  - `toBeVisible()`, `toHaveText()`, `toMatchScreenshot()` — stubs that throw "not implemented"
  - Will be filled in during Step 5-6
  - Reference: https://vitest.dev/guide/extending-matchers.html

- [x] Create `src/screenshot/compare.ts` — odiff wrapper placeholder
  - Stub `compareScreenshots()` function
  - Will be filled in during Step 5

- [x] Create `src/screenshot/baselines.ts` — baseline management placeholder
  - Stub `resolveBaselinePath()`, `saveLatest()`, `updateBaseline()`
  - Will be filled in during Step 5

- [x] Create `src/screenshot/normalize.ts` — status bar normalization placeholder
  - Stub `normalizeStatusBar()`, `resetStatusBar()`
  - Will be filled in during Step 5

## Build Verification

- [x] Run `bun run build` — verify `tsup` compiles without errors
- [x] Verify `dist/index.js` and `dist/index.d.ts` are generated
- [x] Verify exports resolve: tested via example-app importing `mobile-test`

## Initial Tests

- [x] Create `src/__tests__/config.test.ts`
  - Test that `defineConfig()` returns the config with defaults applied
  - Test that user overrides are preserved

- [x] Create `src/__tests__/by.test.ts`
  - Test `by.id('foo')` creates a Locator with type 'id' and value 'foo'
  - Test `by.text('bar')` creates a Locator with type 'text' and value 'bar'
  - Test `by.text(/regex/)` works with RegExp

- [x] Create `src/__tests__/detect.test.ts`
  - Test parsing of `xcrun simctl list devices booted --json` output (mock the command)
  - Test error message when no simulators are booted

- [x] Run `bun test` — verify all tests pass (11 tests passing)

## Directory Structure Verification

After completing all items, the project should look like:

```
mobile-test/
├── CLAUDE.md
├── TODO.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── matchers.d.ts              # vitest matcher type augmentation
├── .gitignore
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── device/
│   │   ├── types.ts
│   │   ├── detect.ts
│   │   ├── ios-device.ts
│   │   └── index.ts
│   ├── element/
│   │   ├── by.ts
│   │   ├── element.ts
│   │   └── types.ts
│   ├── expect/
│   │   └── matchers.ts
│   ├── driver/
│   │   ├── client.ts
│   │   └── protocol.ts
│   ├── screenshot/
│   │   ├── compare.ts
│   │   ├── baselines.ts
│   │   └── normalize.ts
│   ├── vitest/
│   │   ├── setup.ts
│   │   └── plugin.ts
│   └── __tests__/
│       ├── config.test.ts
│       ├── by.test.ts
│       └── detect.test.ts
└── dist/                  # generated by build
```
