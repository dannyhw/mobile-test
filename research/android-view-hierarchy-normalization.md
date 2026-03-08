# Android View Hierarchy Normalization Notes

## Sources

- `plan/phase-3-android.md`
- `packages/mobile-test/android-driver/app/src/androidTest/...`
- `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-android/src/androidTest/java/dev/mobile/maestro/ViewHierarchy.kt`
- `/Users/danielwilliams/Developer/oss/test-framework/Maestro/maestro-client/src/main/java/maestro/drivers/AndroidDriver.kt`

## Useful Findings

- Maestro does not rely on `UiDevice.dumpWindowHierarchy()` directly. It serializes `AccessibilityNodeInfo` trees itself so it can dump multiple window roots, keep a WebView visibility workaround, and control the XML shape.
- Android hierarchy dumps can intermittently fail while UiAutomator is walking the tree. Maestro retries once after a short delay; we mirror that approach in the HTTP handler.
- `resource-id` commonly arrives as a fully qualified Android id such as `com.example:id/click-button`. For cross-platform locator parity, normalizing to the last path segment is the practical choice.
- `content-desc` is the closest match for accessibility label. `text` is the closest match for visible/value text. On Android those may differ, so preserving both matters for selectors and matchers.
- Multiple Android window roots are normal. Filtering roots by the active app package is enough to drop obvious system windows without changing the public `viewHierarchy()` API.

## Mapping Used In `mobile-test`

- `resource-id` -> `identifier` after stripping the package/id prefix
- `content-desc` -> `label` when present
- `text` -> `value`, and also `label` when there is no content description
- `hintText` -> `placeholderValue`
- `bounds` -> `{ X, Y, Width, Height }`
- `class` -> a small shared `elementType` mapping for the types we already use (`group`, `staticText`, `button`, `image`)
- `enabled`, `selected`, `focused` -> shared booleans

## Scope Limits

- We do not yet mirror every Android widget class into a distinct `elementType` number.
- We do not yet augment Android WebViews with Chrome DevTools nodes the way Maestro can.
- We do not yet add toast injection or keyboard pruning beyond package-root filtering.
