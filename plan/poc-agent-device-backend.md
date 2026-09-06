# POC — agent-device as the native backend

> Status: done and hardened (2026-09-06). Native drivers removed. iOS 13/13, Android 12/13 on the example-app suite; the one Android failure is an agent-device gap (empty `EditText` reports its hint as its value, issue draft in the research doc). Storybook runs with Metro (channel server) or without (self-started channel server / deep links). Draft PR: https://github.com/dannyhw/mobile-test/pull/9
> Companion research: [research/agent-device-programmatic-api.md](../research/agent-device-programmatic-api.md)

## The idea in one paragraph

Keep everything users touch: the TypeScript API (`device`, `element`, `by`, the
auto-retrying `expect` matchers, `toMatchScreenshot` with odiff baselines), the
Vitest plugin/projects integration, and the config shape. Throw away everything
we built to talk to the device: the Swift XCTest driver, the Kotlin UIAutomator
driver, the HTTP/JSON protocol, the installer, and the simctl/adb device
detection. In their place, one TypeScript backend that drives devices through
agent-device's typed Node client (`createAgentDeviceClient`). agent-device
already ships and maintains the XCTest runner, the Android snapshot helper,
session/device claiming, and physical-device support. We stop owning native
code entirely.

## Why this is attractive

- **Zero native code in this repo.** No Xcode project, no Gradle build, no
  driver signing, no `build:drivers` step. `bun add agent-device` is the whole
  install story.
- **Same zero-config model we wanted.** agent-device installs its own runner at
  first `open` (with a build cache) and talks to any app via accessibility, so
  "no custom app build, no app code changes" still holds.
- **More reach for free.** Physical iOS devices, tvOS, macOS, device clouds and
  remote proxies all come with the client. We only need iOS sim + Android
  emulator for the POC, but nothing blocks the rest.
- **Server-side waits.** `wait text|selector|stable` and `--settle` run inside
  the daemon, so many of our 200ms TS polling loops can become one call.
- **It is actively maintained by Callstack** and already used by this repo for
  one-off simulator work.

## What we keep, change, delete

| Area | Today | POC |
|---|---|---|
| `src/element/{by,match,element,types}.ts` | Matches locators over a tree from `/viewHierarchy` | **Keep**, matching runs over agent-device's flat `SnapshotNode[]` converted to our `ElementHandle` tree |
| `src/expect/matchers.ts` | Polls `Element` | **Keep** as is (plus optional fast path via `wait`) |
| `src/screenshot/*` | odiff compare, baselines, crop, mask | **Keep**; only the capture call changes |
| `src/vitest/{plugin,context}.ts` | Provides config to workers | **Keep** |
| `src/vitest/setup.ts` | Detects device via simctl/adb, launches driver process | **Rewrite**: pick device via `client.devices.list`, open a session |
| `src/vitest/matchers-setup.ts` | Builds `DriverClient` from port | **Rewrite**: builds `AgentDeviceBackend` from session name |
| `src/device/{ios,android}-device.ts` | Mix of driver HTTP + simctl/adb shell-outs | **Rewrite** into one `Device` over the backend, platform differences shrink to a few branches |
| `src/device/detect.ts` | Parses `simctl list` / `adb devices` | **Delete** (agent-device `devices.list`) |
| `src/driver/{client,protocol,installer,context}.ts` | HTTP client + process launcher | **Delete**, replaced by `src/backend/` |
| `src/driver/android-view-hierarchy.ts` | XML → tree normalization | **Delete** (agent-device normalizes) |
| `src/screenshot/normalize.ts` | `simctl status_bar override` | **Delete** or keep as fallback; agent-device screenshot has `normalizeStatusBar` |
| `ios-driver/`, `android-driver/`, `scripts/build-drivers.sh` | Native drivers | **Delete** once the POC passes the example-app suite |
| `execa` dependency | Shell-outs everywhere | Likely **removable** |
| `by.type(number)` | XCUIElementType integer | **Change** to `by.role(string)` (agent-device exposes `role`, e.g. `button`) |

## Target architecture

```
User test code (unchanged)
        │
Framework core (TS)  device · element · by · expect · screenshot workflow
        │
   Backend interface (new, ours, ~15 methods)
        │
AgentDeviceBackend ──► createAgentDeviceClient() ──► agent-device daemon
                                                       ├─ iOS: XCTest runner (theirs)
                                                       └─ Android: adb + snapshot helper (theirs)
```

The `Backend` interface is the seam. It is deliberately small and expressed in
our own terms (points, frames, our `ElementHandle`), so the rest of the
framework never imports agent-device types. That also lets us keep the old
`DriverClient` alive behind the same interface during the transition, so the
example-app suite can be run against both and timings compared.

### Backend interface (sketch)

```ts
// src/backend/types.ts
export interface Backend {
  readonly platform: 'ios' | 'android'
  readonly device: { name: string; id: string }

  // observation
  snapshot(opts?: { bundleId?: string }): Promise<ElementHandle>   // root of a tree
  screenshot(): Promise<{ png: Buffer; scale: number; widthPoints: number; heightPoints: number }>
  viewport(): Promise<Frame>
  keyboardVisible(): Promise<boolean>
  waitStable(opts?: { quietMs?: number; timeoutMs?: number }): Promise<void>

  // input (all coordinates in points, matching ElementHandle.frame)
  tap(x: number, y: number, opts?: { durationMs?: number; doubleTap?: boolean }): Promise<void>
  swipe(from: Point, to: Point, opts?: { durationMs?: number }): Promise<void>
  typeText(text: string): Promise<void>
  fillText(target: { x: number; y: number } | { selector: string }, text: string): Promise<void>
  clearText(target: ElementHandle): Promise<void>
  pressKey(key: 'return' | 'enter' | 'back' | 'home'): Promise<void>
  dismissKeyboard(): Promise<void>

  // lifecycle
  launchApp(bundleId: string, opts?: { url?: string; relaunch?: boolean }): Promise<void>
  terminateApp(bundleId: string): Promise<void>
  installApp(bundleId: string, path: string): Promise<void>
  openUrl(url: string): Promise<void>
  setLocation(lat: number, lng: number): Promise<void>
  close(): Promise<void>
}
```

### Mapping to agent-device client calls

| Backend method | agent-device |
|---|---|
| `snapshot()` | `client.capture.snapshot({ raw: true, forceFull: true })` → convert flat nodes (`index`, `parentIndex`, `rect`, `identifier`, `label`, `value`, `role`, `enabled`, `focused`, `selected`, `visibleToUser`, `hittable`) into an `ElementHandle` tree |
| `screenshot()` | `client.capture.screenshot({ path, normalizeStatusBar: true })` then read the PNG; `pixelDensity`, `logicalWidth/Height` give scale and points |
| `viewport()` | from `screenshot()` logical size, cached per session |
| `keyboardVisible()` / `dismissKeyboard()` | `client.command.keyboard({ action: 'status' | 'dismiss' })` |
| `waitStable()` | `client.command.wait({ stable: true, quietMs, timeoutMs })` |
| `tap()` | `client.interactions.press({ x, y, holdMs?, doubleTap? })` |
| `swipe()` | `client.interactions.swipe({ from, to })` |
| `typeText()` | `client.interactions.type({ text })` |
| `fillText()` | `client.interactions.fill({ x, y \| selector, text })` (replaces) |
| `clearText()` | **spike item**, see risks |
| `pressKey('back'/'home')` | `client.command.back()` / `client.command.home()` |
| `launchApp()` | `client.apps.open({ app, url?, relaunch: true, platform, udid/serial })` |
| `terminateApp()` | `client.apps.close({ app })` |
| `installApp()` | `client.apps.install({ app, appPath })` |
| `openUrl()` | `client.apps.open({ url })` (verify in spike; fall back to simctl/adb if needed) |
| `setLocation()` | `client.settings.update({ setting: 'location', state: 'set', latitude, longitude })` |
| device discovery | `client.devices.list({ platform })` |
| session end | `client.sessions.close()` |

### Sessions and Vitest workers

agent-device keys device ownership on a **session** (string) and serializes
stateful commands within a session. The daemon is shared and scoped to the git
worktree.

- `globalSetup` (`vitest/setup.ts`): build a session name
  `mobile-test:<vitest project>:<pid>`, resolve the device with
  `devices.list`, call `apps.open` once so the iOS runner is warmed, and
  `project.provide('__mobileTestRuntime', { session, platform, deviceId, deviceName })`.
- `setupFiles` (`vitest/matchers-setup.ts`): each worker creates its own
  `createAgentDeviceClient({ session })` pointing at the same session. Since
  `fileParallelism: false` is already required, only one worker acts at a time.
- Teardown: `sessions.close()`. If the daemon is left running between test runs
  that is fine and actually speeds up the next run.

### Locator strategy

Keep TS-side matching over the snapshot tree. That preserves regex text,
`atIndex`, `withAncestor` and our error messages with no dependency on
agent-device selector semantics. Two follow-ups once it works:

1. Add `by.role('button')` replacing `by.type(number)`.
2. Optional fast path: translate simple locators to agent-device selectors
   (`id="form-name"`, `label="Item 0"`) and use `command.wait({ selector })`
   inside `Element.resolve()` and `toBeVisible`, so waiting happens in the
   daemon instead of 200ms polls that each pull a full snapshot.

## Milestones

### M0 — Spike (half a day, no framework changes)

A throwaway script a throwaway probe script (since replaced by `scripts/check-device.ts`) run
against the booted iPhone 17 and the example app. It must answer:

- [x] Rect units: are `rect` values in points on iOS and dp on Android? Do they
      match what `press({x,y})` expects? Compare with screenshot
      `logicalWidth/Height`.
- [x] Does the default snapshot omit off-screen nodes? Does `forceFull` include
      them? (Needed for `scrollTo` and `exists()`.)
- [x] Latency: snapshot, screenshot, press, type. Compare with
      `log.printTimingSummary()` numbers from the current driver on the same
      suite.
- [x] Clear text: does `fill` with `''` work, or do we need `press` +
      select-all + delete, or `type` with backspace characters?
- [x] Double tap: `press({ doubleTap: true })` behaves on iOS and Android.
- [x] Deep links: `apps.open({ url })` vs a separate URL command for cold and
      warm app.
- [x] `wait({ stable })` semantics vs our screenshot-diff
      `waitForAnimationToEnd`.
- [ ] Android: same script on Pixel_9; confirm snapshot helper install is
      automatic.
- [x] Session behaviour when two `createAgentDeviceClient` instances share a
      session name (the worker + globalSetup case).
- [x] `apps.close({ app })` terminates the app but keeps the session usable.
- [x] Screenshot density: iOS defaults to 1x logical points; confirm
      `pixelDensity: 3` matches our existing baselines, and what Android returns.
- [x] Keyboard dismiss on iOS returns unsupported when no dismiss key exists;
      confirm our fallback ladder (return key, pan, tap) still works.
- [x] `settings.update` location and `command.home` work on both platforms.

Known non-equivalences going in (from the API review):

- No clear/erase command and no delete key; only `fill` (replace) and `type`
  (append).
- Key presses limited to enter/return; no tab, escape, or backspace.
- Plain `swipe` has no duration; use `gesture pan` when timing matters.
- No device-info call; derive points/pixels/scale from screenshot metadata.
- Snapshot nodes have no `title` or `placeholderValue`; element type is a role
  string.

Record the answers in the research doc.

### M1 — Backend seam

- [x] Add `src/backend/types.ts` (interface above) and
      `src/backend/context.ts` (replaces `driver/context.ts`).
- [x] Implement `src/backend/agent-device.ts` including the flat-node → tree
      converter with unit tests (`__tests__/agent-device-snapshot.test.ts`).
- [x] Implement `src/backend/legacy-driver.ts` adapting the existing
      `DriverClient` to the interface (temporary, for A/B runs).
- [x] Rewire `element/element.ts`, `expect/matchers.ts`,
      `screenshot/workflow.ts`, `device/*` to call the backend. `Element` no
      longer needs `deviceInfo()`; it gets `viewport()`.
- [x] Config: add `backend?: 'agent-device' | 'native'` (default
      `agent-device`) so the example-app can flip between them during the POC.
- [x] `by.role()` added, `by.type()` deprecated.

### M2 — Vitest integration

- [x] Rewrite `vitest/setup.ts` and `vitest/matchers-setup.ts` for sessions as
      described above. `__mobileTestRuntime` carries `session` instead of
      `port`.
- [x] `projects[].device` resolves via `devices.list` by name or udid/serial.
- [x] Error mapping: wrap `AppError` / `isAgentDeviceError` into our messages
      (keep the "is the simulator booted?" style hints).

### M3 — iOS parity on the example-app suite

- [x] `bun run test:e2e` in `packages/example-app` passes on the agent-device
      backend: counter, form, list, animations, storybook.
- [x] Gaps found (clear, doubleTap, scrollToEnd, hideKeyboard) fixed in the
      backend, not in tests.
- [x] Timing comparison table (native driver vs agent-device) added to the
      research doc.

### M4 — Android parity

- [x] `bun run test:e2e:android` runs on the same backend: 5 of 6 pass; `toHaveValue("")` after `clear()` is blocked by the Android hint-as-value gap.
- [x] Per-platform baselines still land in the same folders.

### M5 — Cut over

- [x] Delete `ios-driver/`, `android-driver/`, `scripts/build-drivers.sh`,
      `src/driver/`, `src/device/detect.ts`, legacy backend, `execa` if unused.
- [x] Update `ROADMAP.md` architecture section, package `CLAUDE.md`
      conventions ("HTTP/JSON protocol" line), README.
- [ ] Move the checklist to `completed-steps/poc-agent-device/`.

## Risks and open questions

1. **Snapshot latency.** agent-device's snapshot is also an XCTest AX query but
   goes through its daemon and merges/annotates nodes. If it is markedly slower
   than our raw `/viewHierarchy`, the polling loops in `resolve()` and the
   matchers will feel it. Mitigation: the selector fast path via `wait`, and
   `--settle` diffs after actions.
2. **Clear text.** agent-device's own guidance says an empty `fill` is not a
   clear command. We had to build a native `/clearText` for the same reason.
   Candidate approaches in order: `fill('')`, `type` with `\b` repeated by value
   length, select-all via long press + "Select All" (iOS only). If none is
   robust this is the one place we might ask upstream for a feature.
3. **Coordinate systems.** Our whole element layer assumes points. If Android
   rects come back in pixels we convert once in the backend using
   `pixelDensity`.
4. **Off-screen nodes.** If snapshots hide off-screen nodes by default,
   `exists()` and `scrollTo` semantics change. `forceFull` should cover it;
   verify.
5. **Runner warm-up.** First `apps.open` on a fresh simulator builds and caches
   the iOS runner (needs Xcode on the host). This is the same class of cost as
   our own driver install, but we no longer control it. CI should run
   `agent-device prepare ios-runner` in a setup step.
6. **Dependency weight and stability.** agent-device is a large, fast-moving
   package (0.18 → 0.20 in two months, deprecated method aliases already
   present). Pin an exact version and keep agent-device types out of our public
   API so upgrades stay internal.
7. **Daemon lifecycle in CI.** A stale daemon or a different version on the
   host can confuse things. Consider `sessions.close({ shutdown })` on
   teardown when `CI` is set.
8. **Session ownership.** agent-device claims devices per session and per git
   worktree. Two Vitest projects (iOS + Android) running in one `vitest run`
   need distinct session names, which the plan already does.
9. **What we give up.** Direct control over touch synthesis details, the
   ability to add a driver endpoint in an afternoon, and the "two layers only"
   promise from the roadmap. In exchange we shed all native maintenance. This
   trade is the point of the POC and should be judged on M3's results.

## Success criteria for the POC

- Example-app iOS and Android suites pass unchanged (except `by.type` →
  `by.role`).
- Wall-clock for the iOS suite within ~1.5x of the native driver, or a clear
  plan to close the gap.
- No Swift, Kotlin, Gradle or Xcode project left in the repo.
