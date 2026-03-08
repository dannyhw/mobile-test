# Phase 3 Step 4: Cross-Platform Test Config

## Goal

Continue Phase 3 from `../../plan/phase-3-android.md`: make the shared config and Vitest setup feel first-class for iOS and Android so the same suite can be selected and run across multiple projects/devices without platform-specific setup hacks.

## Next Focus

- [x] Scope the minimal config changes needed from Phase 3 M4 without breaking the current iOS default path.
- [x] Add cross-platform app config support for per-platform bundle IDs/app IDs.
- [ ] Support project-style runtime selection so shared suites can target both iOS and Android devices cleanly.
- [ ] Prove at least one shared test configuration path that can select Android without relying on ad hoc env wiring.
