# Phase 2 Closeout

> Goal: finish the small remaining iOS gaps and do the final verification needed to call Phase 2 complete.

## M1: Add a Native Clear-Text Operation

- [x] Add a dedicated driver endpoint for clearing text instead of relying on client-side character counting
- [x] Decide whether the driver API should target the focused element or a resolved element at coordinates, then keep the TS API simple as `element.clear()`
- [x] Implement the iOS driver clear flow in `ios-driver/DriverUITests/` with a fallback chain:
- [x] Try the native clear affordance when available
- [x] Fall back to select-all then delete when possible
- [x] Fall back to repeated delete until the field is empty or stops changing
- [x] Verify the field is empty before returning success
- [x] Return a clear failure when the target is not editable or the driver cannot prove the field was cleared

## M2: Wire `element.clear()` to the Driver

- [x] Add the new request/response shape to `src/driver/protocol.ts`
- [x] Add the new client method to `src/driver/client.ts`
- [x] Implement `element.clear()` in `src/element/element.ts` on top of the dedicated driver endpoint
- [x] Keep the public TS API as `await element(by.id('input')).clear()`
- [x] Ensure the implementation focuses the target element before invoking the native clear path if needed

## M3: Add Coverage for Clear

- [x] Add unit tests for `element.clear()` in `src/__tests__/element.test.ts`
- [x] Cover the happy path for a populated field
- [x] Cover clearing an already-empty field
- [x] Cover the non-editable-element error path
- [x] Cover driver-level failure propagation when clear does not succeed

## M4: Example App Validation

- [x] Add or update one example-app e2e test that proves `element.clear()` against a real input in `packages/example-app/e2e/`
- [x] Prefer an existing route like `/form` instead of adding new demo UI unless the current screens are insufficient
- [x] Assert both that text entry works before clear and that the field is empty after clear

## M5: Phase 2 Closeout

- [x] Run `bun run build` in `packages/mobile-test`
- [x] Run `bun run test` in `packages/mobile-test`
- [x] Run the relevant example-app e2e coverage for text entry and screenshots
- [x] Update `plan/phase-2-full-ios.md` so it reflects the implemented state instead of listing completed work as remaining
- [x] Move this file to `completed-steps/phase-2/` once the checklist is fully done
