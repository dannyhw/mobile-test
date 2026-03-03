# M6: Vitest Integration

Wire up the vitest plugin, custom matchers, and setup so a developer can write standard vitest tests with `device`, `element`, `by`, and custom `expect` matchers — then run with `bunx vitest`.

## Tasks

- [x] Implement custom matchers in `src/expect/matchers.ts`
  - `toBeVisible()` — auto-retry element visibility check
  - `toHaveText(expected)` — auto-retry text assertion
  - `toMatchScreenshot(name, options?)` — take screenshot, compare against baseline
  - Call `expect.extend()` to register them with vitest
- [x] Implement vitest plugin in `src/vitest/plugin.ts`
  - Return proper vitest plugin config pointing to `setup.ts` for globalSetup
  - Add `setupFiles` pointing to matcher registration
- [x] Create `src/vitest/matchers-setup.ts` — setupFile that calls `registerMatchers()`
  - Runs in every test worker: connects to driver, sets up device singleton, registers matchers
- [x] Update `tsup.config.ts` to include vitest setup/matchers as separate entry points
  - Added `splitting: false` so plugin resolves sibling files correctly
- [x] Update `package.json` exports for vitest entry points
- [x] Write e2e integration test: `e2e/example-app.test.ts`
  - vitest config uses our plugin
  - Tests `device.launch`, `element(by.id()).tap()`, `toBeVisible`, `toHaveText`, `toMatchScreenshot`
  - All 3 tests pass on both first run (baseline creation) and second run (comparison)
- [x] Verify the full flow end-to-end with the example app

## Key decisions

- `globalSetup` starts the driver and passes port/device info to workers via `process.env`
- `setupFiles` (matchers-setup.ts) connects to the running driver and sets up singletons in each worker
- Plugin resolves `.ts` or `.js` sibling files dynamically so it works both in dev and published
