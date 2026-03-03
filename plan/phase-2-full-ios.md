# Phase 2: Full iOS + Screenshot Workflow — Detailed Plan

> Goal: Complete the iOS experience with region masking, element-level screenshots, more locators, actions, and assertions. After this phase, the iOS side is production-ready.

---

## What's Already Done (from Phase 1)

- Swipe, longPress, scroll actions
- Auto-waiting on element resolution and assertions
- Status bar normalization (`xcrun simctl status_bar`)
- Baseline management with update workflow (`UPDATE_SCREENSHOTS=true`)
- `toBeVisible()`, `toHaveText()`, `toMatchScreenshot()` matchers

## What Remains

### M1: Region Masking for Screenshots

Allow masking dynamic content (clocks, timestamps, ads) so they don't cause false diffs.

**API:**
```typescript
await expect(device).toMatchScreenshot('home', {
  mask: [element(by.id('clock')), element(by.id('ad-banner'))],
})
```

**Implementation:**
- Resolve each mask element to get its frame (x, y, width, height)
- Pass frames to odiff as `ignoreRegions` option
- odiff natively supports `ignoreRegions: [{x1, y1, x2, y2}]`

**Files to modify:**
- `src/screenshot/workflow.ts` — accept `mask` option, resolve element frames before comparison
- `src/screenshot/compare.ts` — pass `ignoreRegions` to odiff
- `src/expect/matchers.ts` — update `TakeAndCompareOptions` type

### M2: Element-Level Screenshots

Crop a screenshot to just one element's bounds.

**API:**
```typescript
await expect(element(by.id('avatar'))).toMatchScreenshot('user-avatar')
```

**Implementation:**
- Add `toMatchScreenshot` matcher for `Element` (currently only works on `Device`)
- Resolve the element to get its frame
- Take a full device screenshot, then crop to the element's frame using sharp or canvas
- Pass the cropped image to the comparison workflow

**Files to modify:**
- `src/expect/matchers.ts` — add `toMatchScreenshot` for Element type
- `src/screenshot/workflow.ts` — accept optional crop region
- `src/screenshot/crop.ts` — new file for image cropping
- `matchers.d.ts` — update type declarations

### M3: Additional Locators

**New locators:**
```typescript
element(by.type('Button'))                           // element type/class
element(by.label('Submit'))                          // accessibility label
element(by.id('cell')).atIndex(2)                    // nth match
element(by.id('item').withAncestor(by.id('list')))   // scoped search
```

**Implementation:**
- Add `type` and `label` cases to `by.ts` and `match.ts`
- Add `atIndex()` method to `Element` class
- Add `withAncestor()` to `Locator` for scoped matching
- Update `findElement` to support compound locators

**Files to modify:**
- `src/element/by.ts` — new locator types
- `src/element/match.ts` — matching logic for new types
- `src/element/element.ts` — `atIndex()`, scoped resolution

### M4: Additional Actions

**New actions:**
```typescript
await element(by.id('button')).doubleTap()
await element(by.id('input')).replaceText('new text')
await element(by.id('list')).scrollTo(element(by.id('item-50')))
await device.pressHome()
await device.setLocation(37.7749, -122.4194)
```

**Implementation:**
- `doubleTap()` — two rapid taps via driver
- `replaceText()` — select all + type
- `scrollTo()` — scroll until target element is visible
- Device actions — `xcrun simctl` commands

**Files to modify:**
- `src/element/element.ts` — new action methods
- `src/device/ios-device.ts` — `pressHome()`, `setLocation()`
- `src/driver/client.ts` — new endpoints if needed
- iOS driver Swift code — `doubleTap` endpoint if needed

### M5: Additional Assertions

**New assertions:**
```typescript
await expect(element(by.id('button'))).toBeEnabled()
await expect(element(by.id('title'))).not.toBeVisible()
await expect(element(by.id('input'))).toHaveValue('hello')
```

**Implementation:**
- `toBeEnabled()` — check element's `enabled` property from view hierarchy
- `not.toBeVisible()` — already works via vitest's `.not` modifier, just needs timeout handling
- `toHaveValue()` — check element's `value` property

**Files to modify:**
- `src/expect/matchers.ts` — new matchers
- `src/element/types.ts` — ensure `enabled` field is in ElementHandle
- `matchers.d.ts` — type declarations

---

## Implementation Order

1. M1: Region masking (highest value — unblocks real-world screenshot testing)
2. M2: Element-level screenshots
3. M3: Additional locators
4. M4: Additional actions
5. M5: Additional assertions
