# Step 4: TypeScript Element API (M4)

> Goal: Wire `element(by.id('button')).tap()` to query the driver's view hierarchy, resolve the matching element, and perform actions at its coordinates. Add auto-wait/retry so elements are found even if the UI hasn't settled yet.

## References

- `src/element/element.ts` — existing Element stub (needs implementation)
- `src/element/by.ts` — existing Locator class (already working)
- `src/element/types.ts` — ElementHandle, Frame types
- `src/driver/client.ts` — DriverClient with viewHierarchy(), tap(), typeText(), swipe()
- `../research/phase-1-plan.md` — Step 5 section (Element Locators & Actions)
- `../Detox/detox/detox.d.ts` — Detox element/expect API for design reference
- Playwright locator docs — auto-wait patterns

## Checklist

### 4.1 Element resolution — query view hierarchy and match locator
- [ ] Implement `Element.resolve()` — calls `driver.viewHierarchy(bundleId)` and walks the tree
- [ ] Match `by.id(id)` — find element where `identifier === id`
- [ ] Match `by.text(text)` — find element where `label === text` or `value === text`
- [ ] Return the matched AXElement node with its frame (x, y, width, height)
- [ ] Throw a clear error if element is not found (include locator description)

### 4.2 Auto-wait / retry logic
- [ ] `resolve()` should retry with polling until element is found or timeout
- [ ] Default timeout from config (`actionTimeout`, default 5s)
- [ ] Poll interval ~200ms
- [ ] On timeout, throw descriptive error: "Element not found: by.id('xyz') after 5s"

### 4.3 Element actions — tap, type, longPress, clear
- [ ] `tap()` — resolve element, compute center from frame, call `driver.tap(centerX, centerY)`
- [ ] `type(text)` — tap to focus, then call `driver.typeText(text)`
- [ ] `longPress(duration?)` — resolve, call `driver.tap(x, y, duration)` with duration
- [ ] `clear()` — focus the element, select all, delete (or use a driver-level approach)
- [ ] `swipe(direction)` — resolve element, compute start/end points, call `driver.swipe()`

### 4.4 Element queries — isVisible, getText, exists
- [ ] `isVisible()` — resolve element (single attempt, no throw), return boolean
- [ ] `getText()` — resolve, return `value` or `label` from the element
- [ ] `exists()` — like isVisible but doesn't require the element to have a frame

### 4.5 Wire Element to the driver client
- [ ] Element needs access to the DriverClient instance — use a module-level singleton or context
- [ ] The driver client should be set during vitest setup (after driver starts)
- [ ] Export a way to set/get the active driver client (e.g., `setDriverClient()` / `getDriverClient()`)

### 4.6 Update device singleton
- [ ] `device.launch()` should call `driver.launchApp()` and store the bundleId
- [ ] `device.terminate()` should call `driver.terminateApp()`
- [ ] `device.takeScreenshot()` should call `driver.screenshot()`
- [ ] Device should hold a reference to the DriverClient

### 4.7 Tests
- [ ] Unit tests for locator matching logic (mock view hierarchy, verify correct element found)
- [ ] Unit test for auto-wait (mock delayed element appearance)
- [ ] Update `scripts/test-driver.ts` to test element API end-to-end:
  - `element(by.id('click-button')).tap()` → counter updates
  - `element(by.id('counter')).getText()` → returns "1"
  - `element(by.id('click-button')).isVisible()` → returns true
  - `element(by.id('nonexistent')).isVisible()` → returns false

## Done when

- `element(by.id('click-button')).tap()` taps the correct button on the simulator
- `element(by.id('counter')).getText()` returns the counter value
- `element(by.id('...')).isVisible()` returns true/false correctly
- Auto-wait retries until element appears or timeout
- Clear error messages when elements aren't found
- Unit tests for matching and auto-wait logic
- Integration test passes end-to-end
