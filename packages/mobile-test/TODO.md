# POC: agent-device backend

## Goal

Execute `../../plan/poc-agent-device-backend.md`: keep the TypeScript API and
Vitest runner, replace the Swift/Kotlin drivers with agent-device's Node client
behind a `Backend` seam, and prove parity on the example-app suite.

Findings and timings live in `../../research/agent-device-programmatic-api.md`.

## M0 — Spike

- [x] `scripts/spike-agent-device.ts` answers units, off-screen nodes, latency, clear, double tap, deep links, keyboard, sessions.

## M1 — Backend seam

- [x] `src/backend/types.ts` interface, `src/backend/context.ts` global holder.
- [x] `src/backend/snapshot-tree.ts` flat → `ElementHandle` tree (+ unit tests).
- [x] `src/backend/agent-device.ts` (+ unit tests with an injected fake client).
- [x] `src/backend/legacy-driver.ts` adapter over `DriverClient` for A/B runs.
- [x] `element/element.ts`, `screenshot/workflow.ts`, `device/backend-device.ts` use the backend.
- [x] `by.role()`; `ElementHandle.role` / `visibleToUser` / `hittable`.
- [x] Config `backend: 'agent-device' | 'native'` (+ `MOBILE_TEST_BACKEND` env override).

## M2 — Vitest integration

- [x] `vitest/setup.ts` picks a device via `devices.list`, opens a session, warms the runner.
- [x] `vitest/matchers-setup.ts` builds the backend from the provided session.

## M3 — iOS parity

- [x] counter, form, list, animations pass on iPhone 17 (baselines regenerated for the Dynamic Island).
- [ ] Storybook test (needs the Storybook dev build + channel server; not backend related).
- [x] Timing comparison against the native driver: 60.3s native vs 45.9s agent-device (the env override was removed with the native backend).

## M4 — Android parity

- [x] Spike on Pixel_9 (rect units, keyboard status, snapshot helper install).
- [x] `bun run test:e2e:android`: 5 of 6 pass. `toHaveValue("")` after clear fails because agent-device reports the EditText hint as its value (upstream gap).

## M5 — Cut over

- [x] Delete `ios-driver/`, `android-driver/`, `scripts/build-drivers.sh`, `src/driver/`, `src/device/detect.ts`, `src/device/{ios,android}-device.ts`, `src/backend/legacy-driver.ts` and their tests.
- [x] Removed `build:drivers` scripts. `execa` stays for `simctl status_bar` and adb key events.
- [x] Update `ROADMAP.md`, package `CLAUDE.md`/`AGENTS.md`, README.
- [ ] Move this file to `completed-steps/poc-agent-device/`.

## M6 — Ready to try

- [x] iOS pixel density detected once per run from a `simctl io screenshot` (override: `screenshots.pixelDensity`).
- [x] `RUNNER_BUSY` and `retriable` agent-device errors retried 3x before failing.
- [x] Stale `mobile-test:*` sessions closed at startup; SIGINT/SIGTERM close the session.
- [x] `by.type(number)` removed; `by.role(string)` is the replacement.
- [x] e2e coverage for `openUrl` on a running app, `hideKeyboard`, `pressHome` + relaunch, `setLocation`, element-level screenshots and masks (`e2e/device.test.ts`, `e2e/screenshots.test.ts`): 12/12 on iOS, 11/12 on Android (hint gap).
- [x] `packages/mobile-test/README.md` quick start + API reference; root README "Try it".
- [ ] Storybook test (needs the Storybook dev build).
- [ ] Android hint-as-value gap (upstream; issue draft in the research doc).
