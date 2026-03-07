# Milestone: Config-Backed iOS Launch + Deep-Link Support

> Goal: let tests use configured iOS app defaults for bundle ID and URL scheme, while still allowing structured per-call overrides such as `device.launch({ path })`, `device.launch({ url })`, or `device.launch({ bundleId, scheme, path })`.

## Scope

Keep this milestone simple:
- Put iOS app identity in config instead of requiring bundle IDs in each test.
- Add optional deep-link URL support at the `IOSDevice.launch()` layer.
- When an app scheme is configured, allow deep-link navigation to be expressed as a structured `path` like `/form`.
- Reuse the existing `xcrun simctl openurl` path instead of expanding the iOS driver protocol.
- Keep an explicit open-link API for already-running-app flows.
- Allow explicit launch arguments to override config when a test needs a different app or URL.

If this approach proves unreliable in e2e runs, revisit the driver `/launchApp` contract in a later milestone. It is out of scope for this checklist.

## References

- `src/device/types.ts` — `Device` interface
- `src/config.ts` — config types and defaults
- `src/config-context.ts` — config available during test execution
- `src/device/ios-device.ts` — current iOS launch and `openUrl()` behavior
- `src/driver/context.ts` — active bundle tracking
- `src/vitest/plugin.ts` — current plugin config wiring
- `src/vitest/matchers-setup.ts` — worker-side config hydration
- `src/__tests__/config.test.ts` — current config coverage
- `e2e/example-app.test.ts` — existing package-level iOS coverage
- `../example-app/vitest.config.mts` — current consumer config entry point
- `../example-app/app.json` — current app scheme (`exampleapp`)
- `../example-app/app/_layout.tsx` — Expo Router root layout
- `../example-app/app/(tabs)/_layout.tsx` — current default route
- `../example-app/app/(tabs)/(counter)/index.tsx` — existing stable screen/test IDs

## Checklist

### 1. Config shape and API contract

- [ ] Design config-backed iOS app settings instead of a bare `app.ios` string
- [ ] Prefer a nested shape that can carry both bundle ID and scheme, e.g.:
  - `app.ios.bundleId`
  - `app.ios.scheme`
- [ ] Decide the launch API so tests can omit the bundle ID when config is present
- [ ] Prefer structured launch/open-link options over string parsing, e.g.:
  - `device.launch()`
  - `device.launch({ path: '/form' })`
  - `device.launch({ url: 'myapp://form' })`
  - `device.launch({ bundleId: 'com.example.otherapp', scheme: 'otherapp', path: '/form' })`
- [ ] Decide whether `openUrl()` should accept the same structured options or whether a separate helper name is clearer
- [ ] Keep explicit per-call overrides available for unusual cases
- [ ] Update `src/device/types.ts` so launch supports the config-default flow
- [ ] Keep this milestone iOS-focused; do not broaden the implementation to Android yet
- [ ] Document the intended behavior in code comments or nearby docs:
  - resolve bundle ID and scheme from config by default
  - allow per-call override of configured values
  - launch app normally when no URL is provided
  - if `path` is present, compose the final deep link from scheme + path
  - if `url` is present, use it as the full deep link
  - if both `url` and `path` are provided, validate or reject clearly
  - the explicit open-link API uses the same structured model for mid-test navigation

### 2. Config plumbing

- [ ] Update `src/config.ts` types to represent iOS bundle ID + scheme cleanly
- [ ] Preserve backward compatibility if practical:
  - accept the existing `app.ios: string` form as shorthand for bundle ID
  - normalize it into the resolved config shape
- [ ] Extend `src/config-context.ts` so workers can read the resolved iOS app defaults
- [ ] Pass the relevant app config through the vitest plugin/setup path
- [ ] Add a small shared resolver for structured launch/open-link input:
  - config supplies default `bundleId` and `scheme`
  - `path` composes a full URL from `scheme + path`
  - `url` is treated as already complete
  - explicit `bundleId` / `scheme` overrides config
  - invalid combinations fail with clear errors
- [ ] Add config tests covering:
  - empty config
  - legacy string form
  - nested iOS object form
  - override precedence rules

### 3. iOS implementation

- [ ] Update `src/device/ios-device.ts` so `launch()` can use configured bundle ID by default
- [ ] Support a structured launch call shape that can override config when needed
- [ ] Preserve the current launch flow:
  - terminate existing app instance when the driver client is connected
  - launch via `client.launchApp(bundleId)` when the driver is present
  - otherwise fall back to `xcrun simctl launch`
- [ ] After a successful launch, call the open-link path when `path` or `url` is provided
- [ ] Compose the final deep-link URL from structured overrides before calling `simctl openurl`
- [ ] Keep `setActiveBundleId(bundleId)` behavior intact for follow-up element queries
- [ ] Avoid adding fixed sleeps unless e2e proves they are necessary
- [ ] Improve the failure surface when config is missing or incomplete:
  - clear error if no bundle ID is configured and none is passed
  - clear error if `path` is given and no scheme is available from config or override
  - clear error for ambiguous or invalid override combinations
  - clear error if deep-link opening fails, including the URL being opened

### 4. Tests

- [ ] Add unit coverage for launch behavior with config defaults
- [ ] Add unit coverage for override precedence:
  - explicit bundle ID overrides configured bundle ID
  - explicit scheme overrides configured scheme
  - explicit URL overrides any scheme/path composition
- [ ] Add unit coverage for the iOS deep-link path:
  - with driver client attached
  - without driver client attached
  - without `path` or `url` to confirm normal launch behavior is unchanged
  - without configured bundle ID to confirm the error is actionable
- [ ] Add unit coverage for structured deep-link resolution:
  - configured scheme + `path: '/form'`
  - explicit `scheme` + `path: '/form'`
  - explicit `url`
  - missing scheme + `path: '/form'`
  - invalid `url` + `path` combination
- [ ] If there is no focused device test file yet, add one under `src/__tests__/` for `IOSDevice`
- [ ] Mock shell execution so tests assert `simctl openurl` is called only when a URL is provided

### 5. Example-app proving path

- [ ] Configure `mobileTestPlugin()` in the example app with iOS bundle ID and scheme instead of hardcoding them in each test
- [ ] Update the package e2e tests to launch without repeating the bundle ID in each file
- [ ] Pick a stable deep-link destination in `example-app`
- [ ] Prefer reusing an existing route/screen if it gives a clean assertion target
- [ ] If the current routes are awkward for a deterministic test, add a minimal deep-link-specific target with obvious test IDs
- [ ] Add or update package-level e2e coverage in `e2e/example-app.test.ts` so it launches from config defaults and also proves a structured deep-link override such as `{ path: '/form' }`
- [ ] Update at least one consumer-facing example to show the override path when a test needs a non-default app or URL

### 6. Verification

- [ ] Run `bun run build`
- [ ] Run `bun run test`
- [ ] Run the relevant iOS e2e coverage against a booted simulator
- [ ] Confirm launch works when app identity comes only from config
- [ ] Confirm explicit per-call bundle ID / URL overrides still work
- [ ] Confirm the non-deep-link launch path still passes after the API change

## Done when

- Tests no longer need to repeat the default iOS bundle ID and scheme in each file
- `device.launch()` can use configured iOS app defaults
- Explicit per-call overrides still work when needed
- A configured scheme allows structured path-based deep links such as `{ path: '/form' }`
- Deep-link launch works on iOS using the existing host-side deep-link mechanism
- There is automated coverage for the new code path
- There is at least one end-to-end example proving a deep link opens the intended app screen
