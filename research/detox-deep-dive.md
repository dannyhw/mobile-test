# Detox Deep Dive - Architecture & Implementation Analysis

## 1. Overall Architecture

Detox is a monorepo with several key components:

```
Detox/
  detox/               # Main npm package
    src/               # JS/TS source code (test runner side)
    ios/               # Native iOS code (Detox.framework + XCUITestRunner)
    android/           # Native Android code (Espresso-based)
    runners/           # Jest integration layer
    local-cli/         # CLI (`detox test`, `detox build`)
    detox.d.ts         # Full TypeScript type definitions
```

### Core Architecture Pattern: Client-Server with WebSocket

Detox uses a **client-server architecture** where:

1. **Node.js side** (the test runner) acts as the **client** (and also hosts a WebSocket server)
2. **Native app side** (Detox.framework on iOS / Detox Android library) embeds a **WebSocket client** that connects back to the Node.js server
3. Communication flows: Test code -> Node.js Client -> WebSocket Server -> Native App -> Execute action -> Response back

The flow is:
```
Test Code (Jest)
  -> DetoxWorker (JS)
    -> Client (WebSocket client to Detox server)
      -> DetoxServer (WebSocket server, localhost)
        -> Native App (WebSocket client embedded in app)
          -> InvocationManager (native, executes actions/expectations)
        <- Response
      <- Response
    <- Result
  <- Test assertion passes/fails
```

### Key Source Files

- `/detox/index.js` - Entry point, creates primary or secondary realm
- `/detox/src/DetoxWorker.js` - Main worker that holds device, element, expect, by, web, system facades
- `/detox/src/client/Client.js` - WebSocket client that sends actions to the app
- `/detox/src/server/DetoxServer.js` - WebSocket server (localhost) that brokers messages
- `/detox/src/invoke.js` - InvocationManager that serializes calls to native
- `/detox/src/environmentFactory.js` - Factory pattern that wires up all platform-specific components

### Factory/Plugin Architecture

Detox uses a factory pattern to compose platform-specific components. For each device type (e.g., `ios.simulator`, `android.emulator`), it creates:

1. **Environment Validator** - Validates prerequisites
2. **Device Allocator** - Manages simulator/emulator allocation and lifecycle
3. **Artifacts Manager** - Screenshots, videos, logs
4. **Matchers Factory** - Creates platform-specific element/expect APIs
5. **Runtime Device Factory** - Creates the device driver

This is configured in `environmentFactory.js`:
```js
switch (deviceConfig.type) {
  case 'ios.simulator':
    deviceAllocatorFactoryClass = deviceAllocationFactories.IosSimulator;
    matchersFactoryClass = matchersFactories.Ios;
    runtimeDeviceFactoryClass = runtimeDeviceFactories.IosSimulator;
    break;
  case 'android.emulator':
    deviceAllocatorFactoryClass = deviceAllocationFactories.AndroidEmulator;
    matchersFactoryClass = matchersFactories.Android;
    runtimeDeviceFactoryClass = runtimeDeviceFactories.AndroidEmulator;
    break;
}
```

---

## 2. TypeScript API Design

### Entry Point & Global Exports

Detox exposes these globals (via `DetoxWorker`):
- `device` - Device control (launch, install, permissions, etc.)
- `element(by.id('x'))` - Find and interact with elements
- `expect(element(...))` - Assert on elements
- `by` - Matchers (id, text, label, type, traits)
- `waitFor(element(...))` - Polling-based waiters
- `web` - WebView testing
- `system` - System-level UI (alerts, permissions dialogs)

### Type Definition Structure (`detox.d.ts`)

The type definitions are comprehensive (~2000+ lines) and live in `detox.d.ts`. Key interfaces:

**Configuration types:**
```ts
interface DetoxConfig {
  apps?: Record<string, DetoxAppConfig>;
  devices?: Record<string, DetoxDeviceConfig>;
  configurations: Record<string, DetoxConfiguration>;
}
```

**Element matching:**
```ts
interface ByFacade {
  id(id: string | RegExp): NativeMatcher;
  text(text: string | RegExp): NativeMatcher;
  label(label: string | RegExp): NativeMatcher;
  type(type: SemanticMatchingTypes | string): NativeMatcher;
  traits(traits: string[]): NativeMatcher;
}
```

**Element actions:**
```ts
interface NativeElementActions {
  tap(point?: Point2D): Promise<void>;
  longPress(point?: Point2D, duration?: number): Promise<void>;
  typeText(text: string): Promise<void>;
  replaceText(text: string): Promise<void>;
  clearText(): Promise<void>;
  scroll(pixels: number, direction: Direction, ...): Promise<void>;
  swipe(direction: Direction, speed?: Speed, ...): Promise<void>;
  takeScreenshot(name: string): Promise<string>;
  getAttributes(): Promise<IosElementAttributes | AndroidElementAttributes>;
}
```

**Expectations:**
```ts
interface Expect<R = Promise<void>> {
  toBeVisible(pct?: number): R;
  not: this;    // Chainable negation
  toExist(): R;
  toBeFocused(): R;
  toHaveText(text: string): R;
  toHaveId(id: string): R;
  toHaveValue(value: any): R;
  toHaveToggleValue(value: boolean): R;
  toHaveSliderPosition(position: number, tolerance?: number): R;
}
```

**WaitFor (polling-based):**
```ts
interface WaitFor {
  withTimeout(millis: number): Promise<void>;
  whileElement(by: NativeMatcher): NativeElementWaitableActions & WaitFor;
}
// Usage: await waitFor(element(by.id('x'))).toBeVisible().withTimeout(2000);
```

**Device API:**
```ts
interface Device {
  id: string;
  name: string;
  launchApp(config?: DeviceLaunchAppConfig): Promise<void>;
  terminateApp(bundle?: string): Promise<void>;
  installApp(path?: any): Promise<void>;
  takeScreenshot(name: string): Promise<string>;
  setOrientation(orientation: Orientation): Promise<void>;
  setLocation(lat: number, lon: number): Promise<void>;
  openURL(url: { url: string; sourceApp?: string }): Promise<void>;
  sendToHome(): Promise<void>;
  reloadReactNative(): Promise<void>;
  // ... many more
}
```

### API Patterns Worth Noting

1. **Fluent/chainable matcher composition**: `by.id('x').and(by.text('y'))`, `by.id('x').withAncestor(by.id('parent'))`
2. **`not` as a getter** that returns `this` with modified state - very clean negation: `expect(el).not.toBeVisible()`
3. **WaitFor with fluent chaining**: `waitFor(el).toBeVisible().whileElement(by.id('list')).scroll(50, 'down')`
4. **Element indexing**: `element(by.text('Item')).atIndex(2)` for disambiguation
5. **RegExp support in matchers**: `by.id(/^item_\d+$/)`

---

## 3. How It Connects to Devices

### iOS Simulator Connection

**Tools used:**
- `xcrun simctl` - Apple's simulator control CLI (boot, install, uninstall, launch, screenshots, permissions)
- `applesimutils` - Third-party tool by Wix for additional simulator features (some permissions, biometrics)
- `xcodebuild test-without-building` - For XCUITest runner execution

The `AppleSimUtils` class (`src/devices/common/drivers/ios/tools/AppleSimUtils.js`) wraps both `simctl` and `applesimutils`:

```js
// Booting a simulator
await this._execSimctl({ cmd: `boot ${udid} ${deviceBootArgs}` });
// Installing an app
await this._execSimctl({ cmd: `install ${udid} "${absPath}"` });
// Launching an app (uses the Detox framework injection)
await this._launchMagically(frameworkPath, udid, bundleId, launchArgs, languageAndLocale);
// Taking screenshots
await this._execSimctl({ cmd: `io ${udid} screenshot "${tempPath}"` });
// Setting permissions
await this._execSimctl({ cmd: `privacy ${udid} grant camera ${bundleId}` });
```

### Android Emulator/Device Connection

**Tools used:**
- `adb` (Android Debug Bridge) - Device communication, app installation, process management
- Android Instrumentation - Launches the test APK which bootstraps Detox inside the app process
- `emulator` binary - For starting/managing emulators

The `ADB` class (`src/devices/common/drivers/android/exec/ADB.js`) wraps adb commands:
```js
this.adbBin = getAdbPath();
await this.adbCmd(deviceId, 'install', appPath);
await this.adbCmd(deviceId, 'reverse', `tcp:${port} tcp:${port}`);
```

---

## 4. iOS Driver - How It Drives Tests

Detox has a **dual-driver architecture** on iOS:

### Driver 1: Detox.framework (In-Process, linked into the app)

**How it gets into the app:**
- Detox.framework is linked as a dynamic framework into the app at build time
- `DetoxInit.m` uses `__attribute__((constructor))` to auto-initialize when the framework loads
- This forces accessibility: `[[[NSUserDefaults alloc] initWithSuiteName:@"com.apple.Accessibility"] setBool:YES forKey:@"ApplicationAccessibilityEnabled"]`
- `DetoxManager.swift` starts a WebSocket client that connects to the Node.js Detox server

**What it handles (in-process via WebSocket messages):**
- Element matching via accessibility APIs (predicates on accessibility identifier, label, type, traits)
- Element actions: tap, longPress, typeText, swipe, scroll, pinch (via `NSObject+DetoxActions`)
- Expectations: visibility, existence, text content, values
- Synchronization via `DetoxSync` - tracks animations, timers, network requests, React Native bridge activity
- View hierarchy dumping via `LNViewHierarchyDumper`

**The Invocation flow (in-process):**
```
Node.js sends JSON invocation via WebSocket
  -> DetoxManager.swift receives it
    -> InvocationManager.swift dispatches to Action/Expectation
      -> Action.swift / Expectation.swift parse params
        -> NSObject+DetoxActions (ObjC) executes actual touch/gesture
      <- Result sent back via WebSocket
```

**Key native types:**
- `Predicate.swift` - Matches elements using accessibility properties
- `Element.swift` - Resolves matched elements in the view hierarchy
- `Action.swift` - Performs actions (tap, type, scroll, etc.) using ObjC categories
- `Expectation.swift` - Evaluates assertions
- `DetoxSync` - Synchronization framework that tracks app idle state

### Driver 2: XCUITestRunner (Out-of-Process, separate test runner app)

**For system-level interactions that can't be done in-process:**

A separate XCUITest app (`DetoxXCUITestRunner`) is built and runs via `xcodebuild test-without-building`. This handles:
- System dialogs (permission prompts, alerts)
- Coordinate-based taps on the device (device.tap())
- Coordinate-based long presses

**Flow:**
```
Node.js XCUITestRunner.js
  -> Serializes params to base64
  -> Runs: xcodebuild -xctestrun <path> -destination "platform=iOS Simulator,id=<udid>" test-without-building
  -> XCUITestRunner.swift reads params from environment variables
    -> PredicateHandler finds elements using XCUITest accessibility queries
    -> ActionHandler performs XCUIElement.tap(), .press(), .typeText()
  -> Result or error returned via process exit
```

The XCUITestRunner is invoked per-action (spawns xcodebuild each time), which is **slow** but necessary for out-of-process interactions.

---

## 5. Android Driver - How It Drives Tests

### Architecture: Instrumentation + Espresso + UiAutomator

On Android, Detox uses **Android Instrumentation** to run code inside the app process:

1. **Test APK** - A separate APK built with `./gradlew assembleAndroidTest` that contains Detox's Android runtime
2. **Instrumentation** - `adb shell am instrument` launches the test APK, which bootstraps inside the app's process
3. **Espresso** - Google's in-process UI testing framework, used for element matching and actions
4. **UiAutomator** - Used for device-level interactions (pressBack, pressHome) via `UiDeviceProxy`

### How Android tests are launched:

```js
// In AndroidDriver.js
async _launchInstrumentationProcess(adbName, bundleId, userLaunchArgs) {
  const serverPort = await this._reverseServerPort(adbName);
  await this.instrumentation.launch(adbName, bundleId, userLaunchArgs);
}
```

```js
// In Instrumentation.js
async launch(deviceId, bundleId, userLaunchArgs) {
  const testRunner = await this.adb.getInstrumentationRunner(deviceId, bundleId);
  this.instrumentationProcess = this.adb.spawnInstrumentation(deviceId, spawnArgs, testRunner);
}
```

### The Native Android Flow:

```
DetoxMain.kt (entry point, runs on instrumentation thread)
  -> Connects to Detox WebSocket server
  -> Sets up action handlers:
     "invoke" -> InvokeActionHandler -> MethodInvocation (reflection-based)
     "isReady" -> ReadyActionHandler
     "reactNativeReload" -> ReactNativeReloadActionHandler
  -> Launches the activity under test
  -> Waits for React Native bootstrap
  -> Dispatches incoming actions
```

### Espresso API Layer (Auto-Generated JS Wrappers):

Detox auto-generates JS wrappers for Espresso/UiAutomator APIs in `src/android/espressoapi/`:
- `DetoxAction.js` - Wraps Espresso ViewActions
- `DetoxMatcher.js` - Wraps Espresso ViewMatchers
- `DetoxAssertion.js` - Wraps Espresso ViewAssertions
- `EspressoDetox.js` - Wraps custom Detox extensions
- `UiDeviceProxy.js` - Wraps UiAutomator UiDevice

These generate JSON invocation objects that are sent via WebSocket and executed reflectively on the Android side using `MethodInvocation`.

### Key Android native components:
- `com.wix.detox.espresso/` - Custom Espresso actions (scroll, swipe, tap, screenshot)
- `com.wix.detox.adapters.server/` - WebSocket server adapter and action handlers
- `com.wix.detox.reactnative/` - React Native bridge integration
- `com.wix.invoke.MethodInvocation` - Reflective method invocation from JSON

---

## 6. Why It Requires Custom Builds

### iOS: Detox.framework must be linked into the app

**The fundamental requirement:** Detox.framework needs to run **inside the app process** to:
- Hook into the app's run loop for synchronization (DetoxSync)
- Access the view hierarchy directly for element matching
- Perform touch injection via private APIs
- Monitor React Native bridge activity

**How it gets linked:**
- The framework is built during `npm install` (postinstall script builds it with Xcode)
- Users must modify their Xcode project / Podfile to link Detox.framework
- The app must be rebuilt with the framework included

**Can this be avoided?** Partially. The XCUITestRunner approach (used for system-level interactions) does NOT require linking into the app. However:
- XCUITest-based element matching is slower and less precise
- Synchronization (idle detection) is impossible without in-process access
- React Native-specific features (reloadReactNative, RN bridge monitoring) require in-process access

### Android: Test APK with Instrumentation

**The fundamental requirement:** Android Instrumentation requires a **separate test APK** that:
- Declares the instrumentation runner in its manifest
- Contains Detox's Espresso-based test code
- Gets installed alongside the app APK
- Runs in the same process as the app via `am instrument`

**How it works:**
- Users run `./gradlew assembleAndroidTest` which produces a test APK
- Detox installs both the app APK and the test APK
- The test APK bootstraps Detox inside the app process

**Can this be avoided?** With UiAutomator alone (out-of-process), you could avoid the test APK, but you'd lose:
- Espresso's precise view matching
- In-process synchronization (idle resource tracking)
- React Native bridge access
- Reflective method invocation

### Summary: What requires custom builds

| Requirement | Why | Avoidable? |
|---|---|---|
| iOS Detox.framework linking | In-process synchronization, view hierarchy access | Yes, if using only XCUITest/accessibility APIs |
| iOS XCUITestRunner | System-level interactions | Pre-built, doesn't require user builds |
| Android test APK | Espresso instrumentation | Yes, if using only UiAutomator + ADB |
| Android Detox library | In-process WebSocket client | Comes with test APK |

---

## 7. Good API Patterns to Learn From

### 1. Matcher Composition
```ts
// AND composition
element(by.id('submit').and(by.text('Submit')))
// Hierarchical matching
element(by.id('item').withAncestor(by.id('list')))
element(by.id('list').withDescendant(by.id('item')))
```
This is elegant and reads naturally. The `and()`, `withAncestor()`, `withDescendant()` pattern is very composable.

### 2. Negation Pattern
```ts
await expect(element(by.id('x'))).not.toBeVisible();
```
Using `not` as a getter that modifies internal state and returns `this` is clean and familiar from Jest.

### 3. WaitFor with Action Loop
```ts
await waitFor(element(by.text('Item #5')))
  .toBeVisible()
  .whileElement(by.id('list'))
  .scroll(50, 'down');
```
This combines waiting with an action in a very readable way - "wait for this element to be visible while scrolling this list."

### 4. Device API Simplicity
```ts
await device.launchApp({ newInstance: true });
await device.takeScreenshot('after-login');
await device.setLocation(32.08, 34.78);
```
Simple, flat API. No deep nesting or complex setup.

### 5. Element Screenshots
```ts
const path = await element(by.id('chart')).takeScreenshot('chart-state');
```
Per-element screenshots are very useful for visual testing.

### 6. RegExp Matchers
```ts
element(by.id(/^item_\d+$/))
element(by.text(/Welcome.*/))
```
Regex support in matchers is powerful for dynamic content.

### 7. getAttributes() for Inspection
```ts
const attrs = await element(by.id('switch')).getAttributes();
// Returns { visible, enabled, text, value, frame, ... }
```
Ability to read element properties is useful for custom assertions.

### 8. Extensible Driver Architecture
The factory pattern allows custom drivers:
```ts
// In .detoxrc.js
devices: {
  myDevice: {
    type: './my-custom-driver',  // Points to a module
  }
}
```

---

## 8. Test Runner Integration (Jest)

### How Detox Integrates with Jest

Detox provides a custom Jest environment: `DetoxCircusEnvironment` (in `runners/jest/testEnvironment/index.js`).

**Setup in `jest.config.js`:**
```js
module.exports = {
  testEnvironment: 'detox/runners/jest/testEnvironment',
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
};
```

**The environment handles:**
1. `setup()` - Calls `detox.init()` or `detox.installWorker()` to boot device, install app, connect WebSocket
2. `handleTestEvent()` - Listens to Jest Circus events (test_start, test_done, test_fn_start, etc.)
3. `teardown()` - Calls `detox.cleanup()` or `detox.uninstallWorker()`

**Listener pattern:** The environment registers multiple listeners:
- `DetoxCoreListener` - Handles beforeEach/afterEach lifecycle
- `DetoxInitErrorListener` - Handles initialization failures
- `DetoxPlatformFilterListener` - Skips tests for wrong platform
- `SpecReporter` - Reports test names in logs
- `WorkerAssignReporter` - Reports device assignment

### Primary/Secondary Realms (Multi-Worker Support)

Detox supports parallel test execution with multiple Jest workers:

- **Primary realm** (`DetoxPrimaryContext`) - Runs in the main process, manages the IPC server, device allocation
- **Secondary realm** (`DetoxSecondaryContext`) - Runs in each Jest worker, communicates via IPC

IPC is done via `node-ipc` library (`src/ipc/IPCClient.js`, `src/ipc/IPCServer.js`).

### Global Setup/Teardown

- `globalSetup.js` - Starts the Detox server, initializes the primary context
- `globalTeardown.js` - Shuts down server, cleans up devices

---

## 9. Device Management

### iOS Simulator Management

**Allocation** (`src/devices/allocation/drivers/ios/`):
- Queries available simulators via `applesimutils --list`
- Supports matching by name, OS version, type
- Can create new simulators if needed
- Uses a lock file (device registry) to prevent multiple workers from using the same simulator

**Lifecycle:**
```
1. Query matching simulators
2. Acquire lock on a free simulator
3. Boot simulator (simctl boot)
4. Open Simulator.app (unless headless)
5. Install app (simctl install)
6. Launch app with Detox framework injected
7. Run tests
8. Terminate app
9. Release lock
10. Optionally shutdown simulator
```

### Android Emulator Management

**Allocation** (`src/devices/allocation/drivers/android/`):
- Queries running emulators via `adb devices`
- Can start new emulators from AVD names
- Supports Genymotion Cloud devices
- ADB port-based identification (emulator-5554, etc.)

**Lifecycle:**
```
1. Find or start emulator matching AVD name
2. Wait for device to be online (adb get-state)
3. Unlock screen
4. Reverse TCP port for WebSocket connection
5. Install app APK + test APK
6. Start instrumentation process
7. Wait for WebSocket connection from app
8. Run tests
9. Terminate instrumentation
10. Optionally shutdown emulator
```

### Device Registry (Lock File)

Both platforms use a `DeviceRegistry` (`src/devices/allocation/DeviceRegistry.js`) that maintains a JSON lock file to coordinate device access across multiple test workers. This prevents two workers from accidentally using the same simulator/emulator.

---

## 10. Weaknesses & Complexity

### 1. WebSocket Client-Server Architecture is Overly Complex

The entire WebSocket server + in-app client + message serialization is a massive amount of code. The Node.js side runs a WebSocket server, the app connects to it, and every action is serialized as JSON, sent over the wire, deserialized, executed, and the response sent back.

**Simpler alternative:** Use `xcrun simctl` and `adb` commands directly for most operations, only using in-process communication when absolutely necessary.

### 2. Requiring Detox.framework to be Linked into the App

This is the single biggest adoption barrier. Users must:
- Modify their build configuration
- Rebuild the app with Detox linked
- Maintain separate debug/release build schemes
- Deal with framework version mismatches

### 3. Android Test APK Requirement

Similarly, requiring `assembleAndroidTest` adds build time and complexity. The test APK embeds Espresso, UiAutomator, and Detox's entire Android runtime.

### 4. Synchronization is Complex but Fragile

DetoxSync on iOS tracks:
- Run loop activity, timers, animations
- Network requests, dispatch queues
- React Native bridge messages

This is powerful when it works but leads to flaky tests when:
- Third-party libraries have unexpected background activity
- Animations don't settle
- Network requests hang

Users often end up disabling synchronization and adding manual waits, which defeats the purpose.

### 5. Java/Kotlin on Android, Swift/ObjC on iOS

The entire native codebase is complex:
- ~50+ Kotlin files for Android
- ~30+ Swift/ObjC files for iOS
- Auto-generated Espresso API wrappers
- Reflection-based method invocation

This makes it very hard for JS/TS developers to debug issues or contribute fixes.

### 6. XCUITestRunner Spawns xcodebuild Per Action

For system-level iOS interactions, Detox runs `xcodebuild test-without-building` **per action**. This is extremely slow (seconds per action) because it:
- Spawns a new process
- Loads the XCUITest framework
- Finds and activates the app
- Performs one action
- Exits

### 7. Configuration Complexity

The `.detoxrc.js` configuration is verbose:
```js
module.exports = {
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/MyApp.app',
      build: 'xcodebuild -workspace ios/MyApp.xcworkspace ...',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest ...',
    },
  },
  devices: { ... },
  configurations: { ... },
};
```

### 8. No Built-in Screenshot Comparison

Detox can take screenshots but has no built-in visual regression testing. You get a file path and must integrate a separate tool for comparison.

### 9. React Native-Specific Code Scattered Throughout

RN-specific logic is embedded in:
- `Predicate.swift` (checks `ReactNativeSupport.isReactNativeApp`, looks for RN class names)
- `DetoxMain.kt` (waits for RN bootstrap)
- Various element matching heuristics

This coupling makes it harder to use with non-RN apps.

### 10. Slow Feedback Loop

Between building the app, building Detox framework, installing, launching instrumentation, establishing WebSocket connection, and executing tests - the startup time is significant (30-60+ seconds).

---

## Key Takeaways for Our Tool

### What to Keep
1. The TS API design patterns (fluent matchers, `not` negation, `waitFor`, `element().atIndex()`)
2. The factory/driver pattern for platform abstraction
3. Per-element and per-device screenshots
4. The `getAttributes()` API for element inspection
5. Device management abstractions (launch, install, permissions, location)

### What to Avoid
1. WebSocket client-server architecture (use CLI tools directly instead)
2. Requiring framework linking / test APK builds
3. In-process synchronization (use polling/waiting instead)
4. Auto-generated Espresso API wrappers (too many abstraction layers)
5. Java/Kotlin for Android runtime (use ADB/UiAutomator CLI tools)

### What to Improve
1. Use `xcrun simctl` + XCUITest for iOS (no framework linking needed)
2. Use `adb` + UIAutomator CLI for Android (no test APK needed)
3. Built-in screenshot comparison (pixel diff, perceptual hash)
4. Simpler configuration (auto-detect app paths, minimal config)
5. Faster startup (no WebSocket handshake, no instrumentation boot)
6. TypeScript-first implementation (not JS with .d.ts bolted on)

### Critical Insight: XCUITest Runner Pattern

Detox's newer `DetoxXCUITestRunner` is very interesting. It:
- Is a standalone XCUITest app that does NOT need to be linked into the user's app
- Uses XCUITest accessibility APIs to find and interact with elements
- Is driven by passing parameters via environment variables
- Uses `xcodebuild test-without-building` to execute

This is exactly the pattern we should use for iOS - but we need to solve the performance problem of spawning xcodebuild per action. Possible approaches:
- Keep a long-running XCUITest process that reads commands from a pipe/socket
- Batch multiple actions into a single XCUITest invocation
- Use `xcrun simctl` for simple operations (screenshot, install) and XCUITest only for element interactions

### Critical Insight: Android Without Test APK

For Android, UIAutomator can be driven via `adb shell uiautomator` without needing a test APK compiled into the app. Combined with `adb shell input` for basic touch events and `adb shell screencap` for screenshots, we could build a functional Android driver without any custom builds.
