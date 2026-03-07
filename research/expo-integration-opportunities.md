# Expo Integration Opportunities

Research into how `mobile-test` could integrate directly with Expo projects for app metadata discovery and optional EAS build/workflow scaffolding.

---

## Summary

Expo already has the data we want for app launch and deep linking:

- top-level `scheme`
- `ios.bundleIdentifier`
- `android.package`

The strongest near-term opportunity is to let `mobile-test` read the resolved Expo config and use it as an input source for our existing `app.ios.bundleId`, `app.ios.scheme`, and future Android package config.

EAS is also a good optional fit for producing testable build artifacts:

- `eas.json` can define reusable simulator / emulator / internal-distribution build profiles
- EAS Build can create installable `.apk` and iOS simulator builds
- EAS Workflows can store pre-made YAML pipelines and run cloud jobs, including custom shell steps

The recommendation is to split this into two layers:

1. **Do first:** Expo config discovery and mapping into our runtime config.
2. **Do later / optional:** EAS scaffolding commands that generate `eas.json` profiles and `.eas/workflows/*.yml`.

---

## Relevant Local Context

The example app is already an Expo app and already declares the values we care about in [packages/example-app/app.json](/Users/danielwilliams/.codex/worktrees/8cf3/test-framework/packages/example-app/app.json):

- `scheme: "exampleapp"`
- `ios.bundleIdentifier: "com.dannyhw.exampleapp"`
- `android.package: "com.dannyhw.exampleapp"`

That makes this a good real target for an Expo-aware config resolver.

---

## What Expo Already Exposes

### 1. Expo config contains the exact identifiers we need

Expo documents these fields directly:

- top-level `scheme` is the app URL scheme and can be a string or string array
- `ios.bundleIdentifier` is the iOS bundle identifier
- `android.package` is the Android package name

That maps almost directly to our current model.

### 2. Expo supports both static and dynamic config

Expo config can come from:

- static: `app.config.json` or `app.json`
- dynamic: `app.config.js` or `app.config.ts`

Expo’s resolution rules matter here because many real projects compute identifiers from env or other shared config. A plain JSON reader would miss those cases.

### 3. Expo CLI already resolves config for us

Expo CLI documents `npx expo config` for evaluating app config, with:

- `--json` for machine-readable output
- `--full` for more project config data
- `--type public|prebuild|introspect`

This is the cleanest integration point if we want to use the app’s own Expo toolchain instead of bundling our own parser.

### 4. Expo has a reusable config parser package internally

Expo’s repo exposes `@expo/config`, including:

- `getConfig(projectRoot, options)`
- `getConfigFilePaths(projectRoot)`
- `modifyConfigAsync(projectRoot, modifications, ...)`

The source shows `getConfig` explicitly supports:

- `app.config.ts`
- `app.config.js`
- `app.config.json`
- `app.json`

It also looks for dynamic config extensions beyond just `.js` and `.ts`.

---

## Best Opportunity: Expo-Aware Config Resolution

### Proposed user experience

Allow `mobile-test` config to opt into Expo discovery:

```ts
import { defineConfig } from 'mobile-test'

export default defineConfig({
  app: {
    expo: {
      root: './packages/example-app',
    },
  },
})
```

Or support an even smaller shortcut:

```ts
export default defineConfig({
  app: {
    expo: './packages/example-app',
  },
})
```

Then resolve:

- iOS bundle ID from `expo.ios.bundleIdentifier`
- launch scheme from `expo.scheme`, with platform-specific `ios.scheme` as an override if present
- Android package from `expo.android.package`

### Why this is worth doing

- Removes duplicated config between Expo app config and `mobile-test.config.ts`
- Works for both managed and prebuild/bare Expo apps
- Makes our deep-link launch story better immediately
- Fits the project goal of a thin wrapper around native tooling instead of inventing a parallel config system

### Recommended implementation shape

Prefer **calling Expo CLI from the target app directory**:

```sh
npx expo config --json
```

Reasons:

- Uses the project’s own Expo installation and config behavior
- Handles static and dynamic config via Expo’s supported resolution path
- Avoids us pinning a separate Expo parser version inside `mobile-test`

Suggested fallback order:

1. explicit `mobile-test` values
2. resolved Expo config values
3. fail with a targeted error if required values are still missing

### Data-shape caveats to handle

- `scheme` may be a string or array
- platform-specific `ios.scheme` / `android.scheme` can be merged with top-level `scheme`
- dynamic config may depend on environment variables

For `scheme`, the safest first version is:

- if a single scheme exists, use it
- if multiple schemes exist, require an explicit override in `mobile-test` rather than guessing

---

## Secondary Opportunity: Use Expo Introspection as an Advanced Fallback

Expo CLI supports config types including `introspect`, described as the subset of prebuild config that shows in-memory native modifications like `Info.plist` and `AndroidManifest.xml`.

That suggests a possible future feature:

- start with `expo config --json`
- if a needed value is absent or ambiguous, optionally inspect `expo config --json --type introspect`

This is interesting because config plugins can influence native output. If we ever need the effective native launch metadata rather than just raw Expo fields, introspection is likely the right advanced source.

I would not start here. It is more complex and should only be added if normal config lookup proves insufficient.

---

## EAS Build Opportunities

### 1. Generate test-oriented `eas.json` profiles

Expo documents that `eas build:configure` creates a default `eas.json`, and the default profile layout already separates:

- `development`
- `preview`
- `production`

For our use case, a generated `eas.json` could add opinionated test profiles such as:

```json
{
  "build": {
    "mobile-test-ios-simulator": {
      "ios": {
        "simulator": true
      }
    },
    "mobile-test-android-emulator": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

This is a good fit because Expo documents:

- iOS simulator builds via `ios.simulator: true`
- Android installable emulator/device builds via `android.buildType: "apk"`
- local EAS builds with `eas build --local`

### 2. Artifact-oriented workflows for local install

EAS docs also describe:

- `eas build:run -p ios --latest` for downloading/installing the latest iOS simulator build
- `eas build:run -p android --latest` for downloading/installing the latest Android emulator build

That opens a possible future flow where `mobile-test` can:

1. trigger or expect an EAS build
2. install the produced artifact
3. continue with our existing simulator/emulator automation

This is attractive for CI and for teams that do not want to maintain native build scripts locally.

### 3. Monorepo compatibility is fine

Expo’s monorepo guidance is straightforward:

- run EAS CLI from the app directory root
- keep `eas.json` in that app directory

For this repo, that means any generated EAS config should live under `packages/example-app/`, not at the monorepo root.

---

## EAS Workflow Opportunities

EAS Workflows are defined as YAML files in `.eas/workflows/` and support:

- pre-packaged jobs like `build`, `update`, `maestro`, `deploy`
- custom jobs with shell `steps`
- manual runs via `eas workflow:run`
- scheduled triggers

This creates two realistic product options.

### Option A: Generate a basic EAS workflow for build artifacts

Example purpose:

- build iOS simulator artifact
- build Android APK
- publish artifacts to EAS

This is the safest EAS workflow integration because it complements our framework instead of competing with it.

### Option B: Generate a custom workflow that runs `mobile-test`

Because EAS Workflows support custom shell steps, a generated workflow could in theory:

- install dependencies
- build the app
- install required tooling
- run our test command

This is possible, but I would treat it as lower priority than artifact generation because:

- the workflow machine still needs all runtime prerequisites for our framework
- our iOS/Android orchestration story is still evolving
- EAS already has first-class Maestro jobs, so our value would come from running our own assertions and screenshot tooling, not from reproducing Expo’s existing CI features

---

## Things We Can Reuse Directly

### Reuse now

- `npx expo config --json` as the primary metadata resolution command
- Expo config field names directly:
  - `scheme`
  - `ios.bundleIdentifier`
  - `android.package`
- EAS profile fields directly:
  - `ios.simulator`
  - `android.buildType`
  - `distribution`
  - `developmentClient`

### Reuse later

- `@expo/config.getConfig()` if we decide a programmatic API is worth the dependency surface
- `@expo/config.modifyConfigAsync()` if we want to patch static Expo config files automatically
- `expo config --type introspect` if raw config values are not enough

### Probably avoid for the first iteration

- Writing config plugins for `mobile-test`

Reason:

- config plugins are mostly aimed at prebuild/native generation
- our framework requirement is that users should not need custom app builds or app code changes for the core path

An Expo plugin could still be useful later for optional build-time conveniences, but it should not be the main integration story.

---

## Recommended Roadmap

### Phase 1: Expo config reader

Add an internal resolver that:

- detects an Expo project root
- runs `npx expo config --json`
- extracts `scheme`, `ios.bundleIdentifier`, and `android.package`
- merges the result into our existing config model

Success criteria:

- the example app can omit duplicated `bundleId` / `scheme` config in `mobile-test`
- deep-link launch still works
- failures are clear when Expo config is missing or ambiguous

### Phase 2: `eas.json` scaffolding

Add a command that generates or patches app-local `eas.json` with test-oriented profiles:

- iOS simulator
- Android APK / emulator
- optional internal-distribution profile

This should be opt-in and app-local.

### Phase 3: pre-made EAS workflows

Add a generator for `.eas/workflows/mobile-test-builds.yml` that:

- builds simulator / emulator artifacts
- optionally runs a `mobile-test` command in custom steps

This should probably start as a simple artifact workflow, not a full test runner workflow.

---

## Recommended Defaults for This Repo

For `packages/example-app/`, the highest-value next step appears to be:

1. Add Expo config resolution to `mobile-test`
2. Teach the example app tests to rely on Expo-derived `scheme` and identifiers
3. Only then consider generating `packages/example-app/eas.json`

That gives us immediate user-facing value without pushing the framework toward an EAS-only or custom-build-dependent architecture.

---

## Sources

- Expo app config reference: https://docs.expo.dev/versions/latest/config/app/
- Expo configuration guide: https://docs.expo.dev/workflow/configuration/
- Expo CLI config command: https://docs.expo.dev/more/expo-cli/
- EAS Build config with `eas.json`: https://docs.expo.dev/build/eas-json/
- EAS local builds: https://docs.expo.dev/build-reference/local-builds/
- EAS Android APK builds: https://docs.expo.dev/build-reference/apk/
- EAS iOS simulator builds: https://docs.expo.dev/build-reference/simulators/
- EAS monorepo setup: https://docs.expo.dev/build-reference/build-with-monorepos/
- EAS Workflows introduction: https://docs.expo.dev/eas/workflows/introduction/
- Expo config source (`getConfig`, `modifyConfigAsync`): https://github.com/expo/expo/blob/main/packages/@expo/config/src/Config.ts
- Expo config source exports: https://raw.githubusercontent.com/expo/expo/main/packages/@expo/config/src/index.ts
- Expo config evaluation source: https://raw.githubusercontent.com/expo/expo/main/packages/@expo/config/src/evalConfig.ts
