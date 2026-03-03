# Fix: Vitest Custom Matcher Types

The custom matchers (`toBeVisible`, `toHaveText`, `toMatchScreenshot`) work at runtime but don't resolve in the IDE/tsc. The `matchers.d.ts` augmentation of vitest's `Assertion` interface isn't being picked up.

**When done**: `bunx tsc --project e2e/tsconfig.json --noEmit` in the example-app passes with no errors on the matcher methods, and the IDE shows no red squiggles in `e2e/counter.test.ts`.

---

## Current State

- `mobile-test/matchers.d.ts` exists with `declare module 'vitest'` augmenting `Assertion`
- `mobile-test/package.json` has `"files": ["dist", "matchers.d.ts"]` and a `"./matchers"` export
- `example-app/e2e/tsconfig.json` includes `../node_modules/mobile-test/matchers.d.ts`
- The matchers.d.ts file IS being symlinked into node_modules (verified)
- But the augmentation doesn't take effect — `tsc` still reports `toBeVisible` does not exist on `Assertion<Element>`

Two separate issues were found:
1. `tsc` can't resolve `describe`/`it`/`expect` from `import { describe } from 'vitest'` (vitest re-exports through `@vitest/runner` which confuses tsc)
2. Even when vitest types load, the `Assertion` augmentation from `matchers.d.ts` isn't applied

---

## Debugging Steps

- [x] Research how other vitest matcher libraries ship their types
  - `@testing-library/jest-dom` and `vitest-dom` both use `import 'vitest'` + `declare module 'vitest'`
  - The `import 'vitest'` side-effect import is **required** — without it, `declare module` creates a standalone ambient module instead of augmenting the real one
  - Use `declare module 'vitest'` (not `@vitest/expect`) — works on both vitest 3.x and 4.x
  - Both `Assertion` and `AsymmetricMatchersContaining` should be augmented

- [x] Test the augmentation in isolation
  - Root cause confirmed: the original `matchers.d.ts` was missing `import 'vitest'`

- [x] Fix `matchers.d.ts` based on findings
  - Added `import 'vitest'` at the top
  - Augments both `Assertion<T>` and `AsymmetricMatchersContaining`

- [x] Fix the consumer setup
  - `example-app/e2e/tsconfig.json` includes `../node_modules/mobile-test/matchers.d.ts`
  - Removed stale `e2e/setup.d.ts`

- [x] Verify the fix
  - `cd example-app && bunx tsc --project e2e/tsconfig.json --noEmit` — zero errors
  - `bun run test` in mobile-test — 11 tests passing

## Files Involved

- `mobile-test/matchers.d.ts` — the type augmentation file
- `mobile-test/package.json` — exports and files field
- `example-app/e2e/tsconfig.json` — consumer tsconfig
- `example-app/e2e/counter.test.ts` — the test with matcher usage
- `example-app/e2e/setup.d.ts` — stale file from earlier attempt, may need cleanup
