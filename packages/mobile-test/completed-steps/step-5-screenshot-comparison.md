# Step 5: Screenshot Comparison (M5)

> Goal: Implement odiff integration, baseline file management, and status bar normalization so `toMatchScreenshot('name')` can create baselines and compare against them.

## References

- `src/screenshot/compare.ts` — existing stub
- `src/screenshot/baselines.ts` — existing stub
- `src/screenshot/normalize.ts` — existing stub
- `../research/odiff-research.md` — odiff API and usage patterns
- `../research/phase-1-plan.md` — Step 6 section
- `node_modules/odiff-bin/odiff.d.ts` — odiff API types

## Checklist

### 5.1 Screenshot comparison with odiff
- [x] Implement `compareScreenshots()` using `compare()` from `odiff-bin`
- [x] Pass through threshold, antialiasing, ignoreRegions options
- [x] Return `ComparisonResult` with match, diffPercentage, diffPath, reason
- [x] Handle layout-diff (different dimensions) with clear message

### 5.2 Baseline file management
- [x] `resolveBaselinePath(name, device)` → `screenshots/baseline/<device-name>/<name>.png`
- [x] `resolveLatestPath(name, device)` → `screenshots/latest/<device-name>/<name>.png`
- [x] `resolveDiffPath(name, device)` → `screenshots/diff/<device-name>/<name>.png`
- [x] `saveLatest(name, device, buffer)` — write PNG to latest/, create dirs as needed
- [x] `updateBaseline(name, device)` — copy latest → baseline
- [x] Use config `screenshots.dir` as the root directory

### 5.3 Status bar normalization
- [x] `normalizeStatusBar(udid)` — `xcrun simctl status_bar override` with fixed time/battery/signal
- [x] `resetStatusBar(udid)` — `xcrun simctl status_bar clear`
- [x] Call normalize in vitest setup, reset in teardown

### 5.4 Screenshot workflow function
- [x] Create `takeAndCompare(name, device, options)` — the core function that:
  1. Takes screenshot via driver
  2. Saves to latest/
  3. If no baseline exists → save as baseline, return pass
  4. If UPDATE_SCREENSHOTS env var is set → update baseline, return pass
  5. Compare against baseline with odiff
  6. Return comparison result with diff path

### 5.5 Tests
- [x] Unit test for baseline path resolution
- [x] Integration test: take screenshot, create baseline, take again, compare
- [x] All existing tests still pass

## Done when

- `compareScreenshots()` works with odiff
- Baselines are saved/loaded from the correct directory structure
- Status bar is normalized before screenshots
- `takeAndCompare()` creates baseline on first run, compares on subsequent runs
- UPDATE_SCREENSHOTS=true updates baselines
