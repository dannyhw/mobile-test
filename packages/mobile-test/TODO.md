# Phase 2 Closeout

> Goal: finish the small remaining iOS gaps and do the final verification needed to call Phase 2 complete.

## M1: Add a Native Clear-Text Operation

- [ ] Add a dedicated driver endpoint for clearing text instead of relying on client-side character counting
- [ ] Decide whether the driver API should target the focused element or a resolved element at coordinates, then keep the TS API simple as `element.clear()`
- [ ] Implement the iOS driver clear flow in `ios-driver/DriverUITests/` with a fallback chain:
- [ ] Try the native clear affordance when available
- [ ] Fall back to select-all then delete when possible
- [ ] Fall back to repeated delete until the field is empty or stops changing
- [ ] Verify the field is empty before returning success
- [ ] Return a clear failure when the target is not editable or the driver cannot prove the field was cleared

## M2: Wire `element.clear()` to the Driver

- [ ] Add the new request/response shape to `src/driver/protocol.ts`
- [ ] Add the new client method to `src/driver/client.ts`
- [ ] Implement `element.clear()` in `src/element/element.ts` on top of the dedicated driver endpoint
- [ ] Keep the public TS API as `await element(by.id('input')).clear()`
- [ ] Ensure the implementation focuses the target element before invoking the native clear path if needed

## M3: Add Coverage for Clear

- [ ] Add unit tests for `element.clear()` in `src/__tests__/element.test.ts` or the nearest existing element API test file
- [ ] Cover the happy path for a populated field
- [ ] Cover clearing an already-empty field
- [ ] Cover the non-editable-element error path
- [ ] Cover driver-level failure when the field does not become empty after the fallback chain

## M4: Example App Validation

- [ ] Add or update one example-app e2e test that proves `element.clear()` against a real input in `packages/example-app/e2e/`
- [ ] Prefer an existing route like `/form` instead of adding new demo UI unless the current screens are insufficient
- [ ] Assert both that text entry works before clear and that the field is empty after clear

## M5: Phase 2 Closeout

- [ ] Run `bun run build` in `packages/mobile-test`
- [ ] Run `bun run test` in `packages/mobile-test`
- [ ] Run the relevant example-app e2e coverage for text entry and screenshots
- [ ] Update `plan/phase-2-full-ios.md` so it reflects the implemented state instead of listing completed work as remaining
- [ ] Move this file to `completed-steps/phase-2/` once the checklist is fully done
