# agent-device — programmatic (Node) API notes

> Gathered from the installed `agent-device@0.20.10` package types
> (`dist/src/client-types.d.ts`, `sdk-contracts.d.ts`, `sdk-selectors.d.ts`),
> its README and `agent-device help workflow`. Written for the
> [agent-device backend POC](../plan/poc-agent-device-backend.md).
> Verify anything marked *(verify)* in the M0 spike.

## Entry point

```ts
import { createAgentDeviceClient } from 'agent-device'

const client = createAgentDeviceClient({ session: 'qa-run' })
try {
  await client.apps.open({ app: 'com.example.app', platform: 'ios' })
  const snap = await client.capture.snapshot({ interactiveOnly: true })
  const btn = snap.nodes.find(n => n.role === 'button')
  if (btn) await client.interactions.press({ ref: btn.ref })
} finally {
  await client.sessions.close()
}
```

Package exports: `.` (client), `./contracts`, `./selectors`, `./finders`,
`./io`, `./artifacts`, `./batch`, `./android-adb`, `./metro`, `./ai-sdk`.
MIT licensed, ESM only, `main: dist/src/index.js`.

`createAgentDeviceClient(config?, deps?: { transport? })` — a transport can be
injected, which is handy for unit-testing our backend without a daemon.

### `AgentDeviceClientConfig` (relevant fields)

```ts
session?: string            // device ownership + command serialization key
lockPolicy?: DaemonLockPolicy
lockPlatform?: PlatformSelector
cwd?: string                // sessions are scoped to the git worktree
debug?: boolean
responseLevel?: 'digest' | 'default' | 'full'
iosXctestrunFile?: string   // bring-your-own runner
iosXctestDerivedDataPath?: string
iosXctestEnvDir?: string
// plus remote-proxy / device-cloud fields
```

Every command also accepts `AgentDeviceRequestOverrides` (same keys) and
`AgentDeviceSelectionOptions`:

```ts
platform?: 'apple'|'android'|'harmonyos'|'vega'|'linux'|'web'|'ios'|'macos'
target?: 'mobile'|'tv'|'desktop'
device?: string   // by name
udid?: string     // iOS
serial?: string   // Android
```

## Client surface (what the POC needs)

```ts
client.devices.list(opts)            → AgentDeviceDevice[]
client.devices.capabilities(opts)
client.devices.boot({ headless? })
client.devices.shutdown()

client.apps.install({ app, appPath })
client.apps.open({ app?, url?, relaunch?, launchArgs?, foreground? })  → AppOpenResult { session, appBundleId, device, snapshot? }
client.apps.close({ app? })
client.apps.list()

client.capture.snapshot({ interactiveOnly?, depth?, scope?, raw?, forceFull?, timeoutMs? })
    → { nodes: SnapshotNode[], truncated, visibility?, refsGeneration?, fallbackScreenshotPath? }
client.capture.screenshot({ path?, normalizeStatusBar?, stabilize?, scale?, pixelDensity?, fullscreen? })
    → { path, width?, height?, logicalWidth?, logicalHeight?, pixelDensity? }
client.capture.diff(...)

client.interactions.press({ x,y | ref | selector, count?, intervalMs?, holdMs?, jitterPx?, doubleTap?, settle?, verify? })
client.interactions.click(...)       // same shape + button
client.interactions.longPress({ ..., durationMs? })
client.interactions.swipe({ from:{x,y}, to:{x,y}, count?, pauseMs?, pattern? })
client.interactions.scroll({ direction, amount?, pixels?, durationMs? })
client.interactions.focus({ x, y })
client.interactions.type({ text, delayMs? })                 // appends to focused field
client.interactions.fill({ x,y | ref | selector, text })     // replaces field content
client.interactions.find({ locator?: 'any'|'text'|'label'|'value'|'role'|'id', query, action?: 'click'|'focus'|'exists'|'getText'|'getAttrs'|'list'|'wait'|'fill'|'type', first?, last?, timeoutMs?, value? })
client.interactions.get({ ref|selector, format: 'text'|'attrs' })
client.interactions.is({ selector, predicate: 'text'|'visible'|'hidden'|'exists'|'editable'|'selected'|'focused', value? })
client.interactions.pan / drag / fling / pinch / rotateGesture / transformGesture / swipeGesture

client.command.wait({ durationMs } | { text, timeoutMs? } | { ref } | { selector } | { stable: true, quietMs?, timeoutMs? })
client.command.alert({ action?: 'get'|'accept'|'dismiss'|'wait' })
client.command.keyboard({ action?: 'status'|'dismiss'|'enter'|'return' })
client.command.clipboard({ action: 'read' } | { action: 'write', text })
client.command.back()                // in-app back; system back via mode  (verify option name)
client.command.home()
client.command.appSwitcher()
client.command.orientation(...)      // `rotate` is the deprecated alias
client.command.appState()
client.command.viewport(...)
client.command.reactNative(...)
client.command.doctor() / prepare()

client.settings.update(
  | { setting: 'location', state: 'set', latitude, longitude }
  | { setting: 'wifi'|'airplane'|'location', state: 'on'|'off' }
  | { setting: 'animations', state: 'on'|'off' }
  | { setting: 'appearance', state: 'light'|'dark'|'toggle' }
  | { setting: 'permission', state: 'grant'|'deny'|'reset', permission }
  | { setting: 'clear-app-state', state: 'clear', app? }
  | { setting: 'faceid'|'touchid'|'fingerprint', ... })

client.sessions.list() / close({ shutdown? }) / stateDir()
client.observability.logs / perf / network / events / audio
client.recording.record / trace
client.replay.run / test ; client.batch.run
```

Errors: `AppError`, `isAgentDeviceError()`, `normalizeAgentDeviceError()` are
exported from the root. Wait failures carry `error.details.reason` values like
`wait_target_absent`, `wait_capture_stalled`, `wait_deadline_exceeded`,
`wait_stable_timeout`.

## Snapshot node shape

```ts
type SnapshotNode = {
  ref: string            // '@e12'
  index: number
  parentIndex?: number   // flat list → tree via these two
  depth?: number
  type?: string
  role?: string          // 'button', 'textfield', ...
  subrole?: string
  label?: string
  value?: string
  identifier?: string    // testID / accessibilityIdentifier / resource-id
  rect?: { x, y, width, height }   // units: points on iOS (verify), ? on Android (verify)
  enabled?: boolean
  selected?: boolean
  focused?: boolean
  visibleToUser?: boolean
  hittable?: boolean
  hiddenContentAbove?: boolean
  hiddenContentBelow?: boolean
  interactionBlocked?: 'covered'
  presentationHints?: string[]
  actions?: string[]     // only with customActions: true
  pid?, bundleId?, appName?, windowTitle?, surface?
  inheritsLabel?, inheritsIdentifier?   // client-side dedup markers, ignore
}
```

Mapping to our `ElementHandle`: `identifier→identifier`, `label→label`,
`value→value`, `rect→frame`, `role→elementType` (string, not the XCUIElementType
int we use today), `enabled`, `selected`, `focused→hasFocus`; children rebuilt
from `parentIndex`.

`CaptureSnapshotResult.visibility` reports `{ partial, visibleNodeCount,
totalNodeCount, reasons }`; the CLI shows `[off-screen below]` hints, which
suggests default captures trim off-screen nodes. `forceFull: true` should return
everything *(verify)*.

## Selectors (string form)

Keys: `id role text label value appname windowtitle visible hidden editable
selected focused enabled hittable`. Examples: `id="field-email"`,
`label="Allow"`, `role=button label="Search"`. Mutating commands fail with
`AMBIGUOUS_MATCH` when a selector hits distinct subtrees; read-only commands
pick per their own policy (`first`/`last` on `find`).

Refs (`@e12`) go stale after any mutation. Pin with `~s<n>` (refsGeneration).
For our polling model, selectors and coordinates are more convenient than refs.

## Sessions and daemon

- Commands go through a local daemon (socket/http). The daemon claims a device
  per session; stateful commands (open/press/fill/type/scroll/back/alert/
  replay/batch/close) run serially inside a session; read-only ones may run in
  parallel.
- Sessions are scoped to the caller's git worktree (`cwd`).
- `apps.open` on a simulator triggers "Warming iOS runner build cache" on first
  use; later opens reuse the cached runner. `agent-device prepare ios-runner`
  does it ahead of time (CI).
- `sessions.close({ shutdown: true })` also shuts the device down.

## How it drives devices

README "How it works": XCTest on iOS/tvOS, ADB plus a snapshot helper APK on
Android, HDC/ArkUI on HarmonyOS, Vega CLI on Vega, a local helper on macOS,
AT-SPI on Linux. The iOS runner source is built on the host with Xcode and
cached; the package ships the Android helper and macOS helper sources under
`android/` and `apple/`.

## Text entry rules worth remembering

- `fill` replaces, `type` appends to the focused field.
- Empty `fill` is documented as *not* a clear-field command.
- `keyboard dismiss` taps the keyboard's own dismiss key when one exists, else
  `UNSUPPORTED_OPERATION`; Android suggests `back` as a fallback.
- `type "\n"` submits on iOS when dismiss fails.
- `--delay-ms` (`delayMs`) helps debounced iOS fields that drop characters.

## Local environment at time of writing

`agent-device devices` listed: Pixel_9 (emulator, not booted), iPhone 17 and
iPhone 17 Pro (simulators, booted), a physical iPhone, and this Mac. The pnpm
global install resolves to 0.20.10 even though an older 0.18.0 copy still exists
in the pnpm store.

## M0 spike results (iOS simulator, iPhone 17, 2026-09-06)

Run with `bun run scripts/spike-agent-device.ts "iPhone 17"` in
`packages/mobile-test`, plus CLI probes with the package-local binary.

| Question | Answer |
|---|---|
| Rect units | Points. Screenshot `logicalWidth/Height` = 402x874 and root rects match. |
| Off-screen nodes | Default snapshot trims (`visibility.partial`, `scroll-hidden-below`). `raw: true` returns every node (94 vs 29); `forceFull` adds nothing on top of raw. |
| Snapshot latency | ~80-100ms for raw on the counter screen; 300-900ms on heavier screens or right after navigation. |
| Screenshot | Default is 1x (402x874). `pixelDensity: 3` gives 1206x2622, matching existing baselines. 140-470ms. |
| Press | ~400-600ms per `press` (coordinates or selector). `doubleTap: true` works. |
| Deep links | `apps.open({ app, url, relaunch: true })` lands directly on the route. Opening a URL onto a *running* app shows the iOS "Open in <app>?" alert; alerts stack one per open. XCTest auto-dismissed these before. `alert accept` reported failure while another alert was still queued; pressing `text="Open"` works. |
| Clear text | `fill('')` is rejected (`INVALID_ARGS: Expected text to be a non-empty string`). `type("\b")` sends a delete key per character and works. |
| Empty fields | Raw snapshot omits `value` (and `label`) for an empty TextField; `get attrs` shows the placeholder as `value`. Our matcher normalizes undefined to "". |
| Keyboard | `keyboard status` is Android-only. On iOS the raw snapshot contains a `Keyboard` node with `Key` children while the keyboard is up; none after `keyboard return`. `keyboard dismiss` returns `UNSUPPORTED_OPERATION` on iOS. `keyboard return` works. |
| Focus flags | iOS nodes never report `focused`. `hittable` is `false` for RN elements (documented as unreliable). |
| Roles | Raw iOS nodes carry `type` = XCUIElementType name (`Button`, `TextField`, `StaticText`, `Switch`); non-raw uses lowercase roles. |
| Two clients, one session | Works; read-only calls from a second client succeed. |
| `apps.close({ app })` | Ends the session (session list is empty afterwards). A subsequent `apps.open` recreates it (~2.3s). |
| `settings.update location`, `command.home` | Work. |
| `wait stable` | Works; 1-3s on the counter screen. `wait` takes positional `[quietMs] [timeoutMs]`, no `--timeout` flag. |
| Runner watchdog | Saw `RUNNER_BUSY` once right after a deep link to the 30-item list screen ("accessibility capture on a heavy or animating screen"). Retry after a short wait. |
| Daemon | Using the global CLI and the package-local copy alternately restarts the daemon ("code-signature mismatch"). Use one binary consistently; the framework uses the package-local one. |
| First open | ~6.4s on a warm runner cache. |

## M3 result: example-app iOS suite on the agent-device backend

Counter, form, list and animations pass (6 tests, ~46s wall-clock, iPhone 17,
Release build of the example app). Storybook was not run: it needs the
Storybook dev build and channel server on port 7007, unrelated to the backend.

What had to change to get there:

- **Deep links**: `apps.open({ app, url, relaunch: true })` for `device.launch`.
  For `device.openUrl` on a running app, accept the iOS "Open in <app>?" alert
  by pressing `text="Open"` (looping, since alerts stack).
- **Swipe**: agent-device `swipe` is a fling that reaches the end of a 30-row
  list in one go and then toggles the iOS 26 tab bar between collapsed and
  expanded on every bounce, so `scrollToEnd`'s "content stopped moving" check
  never settled. Using `gesture pan` with a 300ms duration reproduces the old
  driver's drag and the test completes in two iterations.
- **Screenshots**: `pixelDensity: 3` for native-pixel output. agent-device's
  `normalizeStatusBar` shows no cellular bars, so the backend leaves it off and
  globalSetup keeps our `simctl status_bar override` (9:41, 4 bars).
- **Dynamic Island**: agent-device's capture includes the Dynamic Island
  cutout; XCUIScreen screenshots did not. With that region ignored every
  screenshot is pixel-identical to the old baselines (odiff `match: true` on
  all four). The iPhone 17 baselines were regenerated once.
- **Clear**: `type("\b" * value.length)`; the form test's clear + `toHaveValue("")`
  passes.
- **Keyboard**: iOS visibility from the raw snapshot's `Keyboard` node;
  `keyboard return` for the dismiss ladder.

Per-call timings from the run (agent-device backend):

| Call | Typical |
|---|---|
| `backend.snapshot` (raw) | 50-200ms, up to ~600ms right after navigation |
| `backend.screenshot` (3x) | 370-390ms |
| `backend.tap` | 400-600ms |
| `backend.typeText` | ~950ms for a short string |
| `device.launch` (relaunch + deep link) | 760-790ms |
| `device.waitForAnimationToEnd` (via `wait stable`) | 1.5-2.0s |

### `wait stable` is not a replacement for `waitForAnimationToEnd`

In the iOS run, `device.waitForAnimationToEnd` implemented via
`command.wait({ stable: true, quietMs: 400, timeoutMs: 2000 })` hit the
timeout on 6 of 8 calls ("UI never settled"), so every call cost the full 2s.
The accessibility-tree based quiet detection does not settle on these React
Native screens. The screenshot-diff implementation (two captures ~370ms each)
returns in well under a second when the screen is still, so `BackendDevice`
uses that on every backend. `Backend.waitStable` stays in the interface for
callers who want the daemon's semantics explicitly.

## M4 result: Android (Pixel 9 emulator, Release build)

Spike answers:

| Question | Answer |
|---|---|
| Rect units | Device pixels (1080-wide), and `press({x,y})` takes the same pixels. Screenshots are 1080x2424 with no `logicalWidth`/`pixelDensity`. So on Android scale = 1 and "points" are pixels, same as the old driver's baselines. |
| Off-screen nodes | Raw snapshot returns everything (86 nodes vs 50 default). |
| Snapshot latency | 20-25ms raw; up to ~1.4s right after an interaction (helper waits for idle). |
| Screenshot | ~1.2s with stabilization (demo-mode status bar + settle delay). `stabilize: false` for motion-diff loops. |
| Press / type | ~165ms per press, `doubleTap` works (+2), `type` ~120ms, `fill` ~1.75s. |
| Deep links | `apps.open({ app, url })` works with or without relaunch, no alert. |
| Clear text | `type("\b")` inserts literal backspace characters through the test IME. `adb shell input keyevent KEYCODE_MOVE_END` + `KEYCODE_DEL` × n clears correctly (agent-device's own `fill` does the same internally but does not expose it). The backend shells out to adb for this one operation. |
| Empty fields | **Gap.** An empty `EditText` reports its hint as `value` (and `label`); there is no `hintText` / `isShowingHintText` field. The old uiautomator normalizer used `hintText` to blank the value. `toHaveValue("")` after `clear()` therefore fails on Android with agent-device. Needs an upstream change in the Android snapshot helper. |
| Keyboard | `keyboard status` works but the emulator uses agent-device's headless test IME, so the keyboard is never "visible"; `hideKeyboard()` becomes a no-op instead of pressing BACK. |
| Focus | `focused: true` is reported after interacting with a field. |
| Roles | `type` is the Android class name (`android.widget.Button`), lowercased by the converter. |

Suite: counter, list, animations and the first form test pass (5 of 6, ~53s
wall-clock, baselines created fresh under `Pixel-9/`). The failing assertion is
the hint gap above; the clear itself works (the submit button returns to
disabled).

## Timing comparison: native driver vs agent-device (iOS, same six tests)

Same simulator, same Release build, run back to back. The native driver's
screenshot assertions fail only because the baselines now include the Dynamic
Island; the work performed is identical.

| | Native driver | agent-device |
|---|---|---|
| Suite wall-clock (4 files, 6 tests) | 60.3s | 45.9s |
| View hierarchy / snapshot | 40-100ms | 170-230ms |
| Screenshot (3x) | 70-90ms | 155-170ms |
| Tap | (inside `tap()` ~40ms resolve + tap) | ~390ms |
| Type "Alice" / email | ~3.3s | ~950ms |
| `element.clear()` | 6.0s | 1.6s |
| `device.launch` with deep link | 3.0s | 0.77s |
| `waitForAnimationToEnd` (screenshot diff) | 0.4-1.2s | 0.4-1.2s (same code path) |

Per-call observation is 2-3x slower through the daemon, but launches, typing
and clearing are 3-4x faster, and the suite is ~25% faster overall. The
timings above for agent-device were taken before `waitForAnimationToEnd`
switched back to screenshot diffing, which removes a further ~1.5s per call.
