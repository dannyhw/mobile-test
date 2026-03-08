# Phase 3 Step 3: Android View Hierarchy Normalization

## Goal

Continue Phase 3 from `../../plan/phase-3-android.md`: add Android `/viewHierarchy` support and normalize the dumped accessibility tree into the existing `ElementHandle` shape so element APIs and matchers can run on Android.

## Checklist

- [x] Scope the Android hierarchy dump format and normalization mapping from Phase 3 M5 before changing the runtime surface.
  References: `../../plan/phase-3-android.md`, `../../research/android-view-hierarchy-normalization.md`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-android/src/androidTest/java/dev/mobile/maestro/ViewHierarchy.kt`, `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-client/src/main/java/maestro/drivers/AndroidDriver.kt`
- [x] Implement Android `/viewHierarchy` in the instrumentation driver.
  References: `android-driver/app/src/androidTest/java/dev/mobiletest/driver/DriverServerInstrumentation.kt`, `android-driver/app/src/androidTest/java/dev/mobiletest/driver/AndroidViewHierarchy.kt`
- [x] Normalize Android XML attributes into the shared `ElementHandle` model.
  References: `src/driver/android-view-hierarchy.ts`, `src/driver/client.ts`, `src/element/types.ts`
- [x] Prove at least one Android element-driven flow against the normalized tree.
  References: `src/__tests__/android-view-hierarchy.test.ts`, `src/__tests__/android-element-flow.test.ts`

## Notes

- The Android driver now returns hierarchy XML over HTTP while the TypeScript runtime keeps the existing `viewHierarchy(): ElementHandle` surface by normalizing XML client-side.
- Package-qualified Android ids are stripped to their last segment so `element(by.id('click-button'))` can resolve the same way on iOS and Android.
- Multiple top-level Android window roots are filtered by the active app package before normalization so obvious system windows do not dominate the root element.
- The driver retries one failed hierarchy dump after a short pause to cover the intermittent UiAutomator dump failure called out in Maestro.

## Verification

- [x] `bun install`
- [x] `bun run test`
- [x] `bun run build`
- [x] `./android-driver/build.sh`
