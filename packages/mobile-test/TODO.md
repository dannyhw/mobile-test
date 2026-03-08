# Phase 3 Step 3: Android View Hierarchy Normalization

## Goal

Continue Phase 3 from `../../plan/phase-3-android.md`: add Android `/viewHierarchy` support and normalize the dumped accessibility tree into the existing `ElementHandle` shape so element APIs and matchers can run on Android.

## Next Focus

- [ ] Scope the Android hierarchy dump format and normalization mapping from Phase 3 M5 before changing the runtime surface.
- [ ] Implement Android `/viewHierarchy` in the instrumentation driver.
- [ ] Normalize Android XML attributes into the shared `ElementHandle` model.
- [ ] Prove at least one Android element-driven flow against the normalized tree.
