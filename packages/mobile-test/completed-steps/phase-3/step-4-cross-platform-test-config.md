# Phase 3 Step 4: Cross-Platform Test Config

## Goal

Continue Phase 3 from `../../plan/phase-3-android.md`: make the shared config and Vitest setup feel first-class for iOS and Android so the same suite can be selected and run across multiple projects/devices without platform-specific setup hacks.

## Checklist

- [x] Scope the minimal config changes needed from Phase 3 M4 without breaking the current iOS default path.
  References: `../../plan/phase-3-android.md`, `src/config.ts`, `src/device/detect.ts`, `src/vitest/context.ts`
- [x] Add cross-platform app config support for per-platform bundle IDs/app IDs.
  References: `src/config.ts`, `src/config-context.ts`, `src/device/launch-config.ts`
- [x] Support project-style runtime selection so shared suites can target both iOS and Android devices cleanly.
  References: `src/vitest/plugin.ts`, `src/vitest/setup.ts`, `src/vitest/matchers-setup.ts`, `src/vitest/context.ts`, `src/device/detect.ts`
- [x] Prove at least one shared test configuration path that can select Android without relying on ad hoc env wiring.
  References: `../../e2e/vitest.config.ts`, `../../../example-app/vitest.config.mts`, `../../../example-app/package.json`

## Notes

- `projects` are now platform-aware and normalize to iOS by default when `platform` is omitted, so the existing single-platform path stays intact.
- Project device names can be omitted to fall back to the default booted simulator or connected Android device, which makes the shared sample config less brittle across machines.
- Vitest runtime setup now uses project-scoped `provide`/`inject` state for connection info and config instead of relying on shared process env for per-project runtime selection.
- `mobileTestProjects()` creates named Vitest projects directly from the mobile-test config, which lets shared suites select `ios-simulator` or `android-emulator` via `vitest --project ...`.
- Device selection can now target a configured device name per platform, with relaxed matching for Android emulator display names like `Pixel 9` vs `Pixel 9 Pro`.

## Verification

- [x] `bun install`
- [x] `bun run test`
- [x] `bun run build`
- [x] `bun --eval "import('./packages/example-app/vitest.config.mts').then(({ default: config }) => { console.log(JSON.stringify(config.test.projects?.map(project => project?.test?.name) ?? [])) })"`
- [x] `bun --eval "import('./packages/mobile-test/e2e/vitest.config.ts').then(({ default: config }) => { console.log(JSON.stringify(config.test.projects?.map(project => project?.test?.name) ?? [])) })"`
