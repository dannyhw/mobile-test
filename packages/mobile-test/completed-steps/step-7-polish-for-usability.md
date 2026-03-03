# M7: Polish for Usability

Good error messages, configurable timeouts, proper UPDATE_SCREENSHOTS workflow, and type fixes.

## Tasks

- [x] Improve error messages in `src/driver/client.ts` — include what was attempted + recovery hints
- [x] Make element resolve timeout and matcher timeout use `config.actionTimeout` instead of hardcoded 5s
  - Created `src/config-context.ts` for runtime config state
  - Pass config through env vars from globalSetup, read in matchers-setup.ts
- [x] Wire `config.screenshots.updateBaselines` to control UPDATE_SCREENSHOTS behavior
  - Plugin passes `config.screenshots.updateBaselines` as `UPDATE_SCREENSHOTS=true` env var
  - Tightened env var check to `=== 'true'` (was truthy check)
- [x] Fix `matchers.d.ts` — added missing `screenshotsDir` to ScreenshotOptions
- [x] Make `element.clear()` throw a clear "not implemented" error instead of silently doing nothing
- [x] Improve matcher messages — show baseline-created/updated messages with file paths, show baseline+latest paths on failure
- [x] Plugin now accepts optional `MobileTestConfig` argument for actionTimeout, screenshot config
- [x] Added `vitest.config.ts` to exclude e2e tests from default `vitest run`
- [x] All unit tests (23) and e2e tests (3) pass
