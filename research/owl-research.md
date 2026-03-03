# React Native Owl - Research Findings

**Repository:** https://github.com/FormidableLabs/react-native-owl
**Version:** 1.5.0
**Stars:** ~684 | **Forks:** 28 | **Open Issues:** 26
**Language Breakdown:** TypeScript 72.6%, HTML 12.7%, Java 5.8%
**Status:** Active (maintained by Formidable/NearForm)

---

## 1. How It Works - Architecture and Approach

Owl is a visual regression testing library for React Native. It is heavily inspired by Detox but focuses specifically on screenshot comparison rather than general E2E testing.

### High-Level Architecture

The system has three main components:

1. **CLI (`lib/cli/`)** - Handles building the app, launching simulators/emulators, orchestrating test runs, and generating reports.
2. **Client (`lib/client/`)** - An in-app runtime that gets injected into the React Native app via a custom entry file. It patches `React.createElement` and `jsx()` to track elements with `testID` props, and communicates with the test runner via WebSocket.
3. **Test API (`lib/`)** - Exports like `takeScreenshot`, `press`, `longPress`, etc. that run within Jest test files (`.owl.tsx` extension).

### How the Communication Works

```
Jest Tests <--WebSocket--> WebSocket Server <--WebSocket--> In-App Client
```

- A **WebSocket server** runs on port 8123 during tests, acting as a relay.
- The **Jest test process** sends action commands (PRESS, LONG_PRESS, CHANGE_TEXT, SCROLL_TO, etc.) via WebSocket.
- The **in-app client** receives these commands, finds the element by `testID` in its tracked elements map, and executes the action by calling the element's callback props directly (e.g., `element.onPress(mockEvent)`).
- The client responds with DONE, NOT_FOUND, or ERROR.

### The React Patching Mechanism

This is the most notable (and potentially fragile) part of the architecture. Owl patches `React.createElement` and `react/jsx-runtime.jsx` to intercept every element creation:

- It scans all props for `testID`
- It stores refs, `onPress`, `onLongPress`, `onChangeText` callbacks in a tracked elements map
- It hides scroll indicators globally (`showsHorizontalScrollIndicator: false`, `showsVerticalScrollIndicator: false`)
- It tracks whether React is currently updating to avoid acting on stale state

The in-app client is loaded via a custom entry file:
```js
// node_modules/react-native-owl/dist/client/index.app.js
require('react-native-owl/dist/client').initClient();
require('../../../../index'); // loads the actual app
```

This entry file is passed via the `ENTRY_FILE` environment variable during the build step.

---

## 2. How It Takes and Compares Screenshots

### Taking Screenshots

Screenshots are taken using **native simulator/emulator CLI tools**, not in-app rendering:

- **iOS:** `xcrun simctl io <simulator> screenshot <filename>.png`
- **Android:** `adb exec-out screencap -p > <filename>.png`

These capture the full simulator/emulator screen, not individual components.

Screenshots are stored in the `.owl/` directory with the following structure:
```
.owl/
  baseline/
    ios/
      screenshot-name.png
    android/
      screenshot-name.png
  latest/
    ios/
      screenshot-name.png
    android/
      screenshot-name.png
  diff/
    ios/
      screenshot-name.png
    android/
      screenshot-name.png
  report/
```

### Comparing Screenshots

Owl uses the **pixelmatch** library (v5.2.1) for pixel-by-pixel image comparison:

```typescript
const diffPixelsCount = pixelmatch(
  baselineImage.data,
  latestImage.data,
  diffImage.data,
  baselineImage.width,
  baselineImage.height,
  { threshold: options?.threshold }  // default: 0.1
);
```

- Uses **pngjs** to read/write PNG files
- Generates a visual diff image saved to `.owl/diff/`
- Custom Jest matcher `toMatchBaseline()` integrates with Jest's assertion system
- Supports configurable threshold per assertion: `expect(screen).toMatchBaseline({ threshold: 0.25 })`
- On first run (no baseline exists), the screenshot becomes the baseline automatically

### Status Bar Normalization

For iOS, Owl overrides the simulator status bar to show a consistent time (9:41) using:
```
xcrun simctl status_bar <simulator> override --time 9:41
```
This prevents time changes from causing false diff failures.

---

## 3. Native Tooling Used

### iOS
- **`xcodebuild`** - Builds the iOS app (workspace, scheme, configuration, sdk iphonesimulator)
- **`xcrun simctl io`** - Takes screenshots from the simulator
- **`xcrun simctl install`** - Installs the app on the simulator
- **`xcrun simctl launch`** - Launches the app on the simulator
- **`xcrun simctl terminate`** - Terminates the app on the simulator
- **`xcrun simctl status_bar`** - Overrides status bar for consistent screenshots
- **`xcrun simctl ui`** - Toggles dark/light mode (workaround for home button color consistency)
- **`PlistBuddy`** - Reads bundle ID from Info.plist

### Android
- **`./gradlew assembleDebug|assembleRelease`** - Builds the Android app
- **`adb install`** - Installs the APK on the emulator
- **`adb shell monkey`** - Launches the app
- **`adb shell am force-stop`** - Terminates the app
- **`adb exec-out screencap`** - Takes screenshots from the emulator

### Node.js Dependencies
- **execa** - Process execution (running native CLI commands)
- **ws** - WebSocket server and client
- **pixelmatch** - Pixel-level image comparison
- **pngjs** - PNG image parsing
- **handlebars** - HTML report generation
- **ajv** - JSON schema validation for config
- **yargs** - CLI argument parsing

---

## 4. API

### Test API (used in `.owl.tsx` test files)

```typescript
import {
  takeScreenshot,
  press,
  longPress,
  changeText,
  scrollTo,
  scrollToEnd,
  toExist,
  reload,
} from 'react-native-owl';

// Take a screenshot and get the file path back
const screen = await takeScreenshot('screenshot-name');

// Interact with elements by testID
await press('ButtonTestID');
await longPress('PressableTestID');
await changeText('TextInputTestID', 'some text');
await scrollTo('ScrollViewTestID', { y: 50 });
await scrollToEnd('ScrollViewTestID');

// Wait for an element to exist
await toExist('ElementTestID');

// Reload the app
await reload();

// Compare screenshot to baseline (Jest matcher)
expect(screen).toMatchBaseline();
expect(screen).toMatchBaseline({ threshold: 0.25 });
```

### Example Test File

```typescript
describe('App.tsx', () => {
  it('takes a screenshot of the initial screen', async () => {
    const screen = await takeScreenshot('initial');
    expect(screen).toMatchBaseline();
  });

  it('press a button, wait for element, take screenshot', async () => {
    await press('Pressable');
    await toExist('TextInput');
    const screen = await takeScreenshot('test-input');
    expect(screen).toMatchBaseline();
  });
});
```

### Configuration (`owl.config.json`)

```json
{
  "ios": {
    "workspace": "ios/MyApp.xcworkspace",
    "scheme": "MyApp",
    "configuration": "Release",
    "device": "iPhone 15 Pro",
    "quiet": true
  },
  "android": {
    "packageName": "com.myapp",
    "buildType": "Release",
    "quiet": true
  },
  "debug": false,
  "report": true
}
```

Supports custom build commands and binary paths:
```json
{
  "ios": {
    "buildCommand": "custom build command here",
    "binaryPath": "/path/to/app.app",
    "device": "iPhone 15 Pro"
  }
}
```

### CLI Commands

```bash
# Build the app for testing
npx owl build --platform ios --config owl.config.json

# Run tests (compare to baseline)
npx owl test --platform ios --config owl.config.json

# Update baseline screenshots
npx owl test --platform ios --config owl.config.json --update
```

---

## 5. Does It Require Custom Builds?

**Yes, partially.** Owl requires a build step, but it is a standard build process:

- **iOS:** Runs `xcodebuild` with standard parameters (workspace, scheme, configuration, sdk iphonesimulator)
- **Android:** Runs `./gradlew assembleDebug` or `assembleRelease`

The key difference from Detox:
- Owl does **not** require a special test build configuration or modifications to the native build setup
- However, it **does** inject a custom entry file via the `ENTRY_FILE` environment variable during the build, which loads the Owl client before the app
- For Android, it passes `-PisOwlBuild=true` to Gradle to enable a custom AndroidManifest that allows WebSocket usage (cleartext network traffic)

So while it does not require the heavy custom build setup that Detox needs, it is **not truly zero-build-modification** -- it needs:
1. The app to be built with the `ENTRY_FILE` env var pointing to Owl's client entry
2. Android needs the Gradle property for WebSocket support

**This is a significant limitation** -- the ENTRY_FILE mechanism means the app is not running in its normal state. The Owl client patches React.createElement globally, which could affect behavior.

---

## 6. Strengths and Weaknesses

### Strengths

1. **TypeScript API** - Tests are written in TypeScript, familiar to React Native developers
2. **Jest integration** - Uses Jest as the test runner with custom matchers, familiar workflow
3. **Built-in screenshot comparison** - pixelmatch-based diffing with configurable thresholds and visual diff output
4. **HTML report generation** - Generates visual reports showing baseline, latest, and diff images
5. **Simple, focused scope** - Does one thing (visual regression testing) rather than trying to be a full E2E framework
6. **Native screenshot capture** - Uses `xcrun simctl` and `adb screencap` for full-fidelity screenshots
7. **Status bar normalization** - Overrides iOS simulator status bar time for consistent screenshots
8. **Supports custom build commands** - Can work with non-standard project structures
9. **Baseline management** - Automatic baseline creation on first run, `--update` flag for refreshing
10. **Lightweight dependencies** - Small dependency footprint, no heavy native modules

### Weaknesses

1. **React patching is fragile** - Monkey-patching `React.createElement` and `jsx()` is inherently fragile and may break with React updates. This also means it only works with React/React Native, not truly native apps.
2. **Limited interaction capabilities** - Only supports: press, longPress, changeText, scrollTo, scrollToEnd, toExist, reload. No swipe, no drag, no pinch, no native keyboard input, no back button.
3. **Actions are simulated, not native** - `press` calls the `onPress` callback directly rather than simulating an actual touch event. This means it does not test the actual touch handling pipeline and may miss issues with hit testing, gesture handlers, or native touch processing.
4. **Requires custom entry file injection** - The `ENTRY_FILE` mechanism means the app runs differently during testing vs. production.
5. **WebSocket communication overhead** - Adds latency and complexity. If the WebSocket connection fails, tests fail.
6. **Full-screen screenshots only** - Cannot screenshot individual components or regions.
7. **No element-level querying** - Can only find elements by `testID`, no support for text content, accessibility labels, or other selectors.
8. **Sequential test execution** - Runs Jest with `--runInBand` (single thread).
9. **No wait/retry mechanism for screenshots** - No built-in way to wait for animations to complete before screenshotting.
10. **Limited Android support** - Uses `adb shell monkey` for launching apps (a debugging tool), no status bar normalization for Android.
11. **No CI-specific features** - No built-in retry logic, flake detection, or parallelization.
12. **Hides scroll indicators globally** - The React patch forces `showsHorizontalScrollIndicator: false` and `showsVerticalScrollIndicator: false` on ALL elements, which changes the visual appearance of the app.
13. **Project activity** - While marked as active, the 26 open issues and reliance on React internals patching raises maintenance concerns.

---

## 7. Key Takeaways for Our Tool

### What to Adopt
- Using `xcrun simctl io` and `adb exec-out screencap` for screenshots -- this is the right approach
- Status bar normalization with `xcrun simctl status_bar`
- pixelmatch for image comparison (or consider alternatives like `resemblejs` or `ssim`)
- Jest integration with custom matchers for a familiar testing workflow
- `.owl/` style directory structure for baseline/latest/diff organization
- HTML report generation for visual review

### What to Avoid
- **Do NOT patch React internals** -- this is fragile and limits the tool to React apps only
- **Do NOT simulate actions by calling callbacks directly** -- use native automation (xcrun simctl, UIAutomation on iOS; adb/UIAutomator on Android) for real touch events
- **Do NOT require a custom entry file** -- the tool should work with the app as-is
- **Do NOT use WebSocket relay** for action communication -- prefer direct native automation commands

### What to Improve On
- Support more interaction types (swipe, drag, native keyboard, back button)
- Support element-level screenshots (crop regions)
- Use native automation tools for interactions instead of callback simulation
- Add wait/retry mechanisms for animations and network requests
- Add proper Android status bar normalization
- Support finding elements by text, accessibility label, not just testID
- Add CI-friendly features (retries, parallelization, flake detection)
- Make it work with any app (native or React Native) without code modifications
