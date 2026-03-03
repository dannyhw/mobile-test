# Phase 4: Polish — Detailed Plan

> Goal: Make the framework ready for public release with CLI tooling, reporting, CI guidance, and documentation.

---

## Milestones

### M1: CLI Tool

```bash
bunx mobile-test init          # scaffold config + first test
bunx mobile-test run           # alias for vitest run with plugin
bunx mobile-test update        # update screenshot baselines
bunx mobile-test devices       # list available simulators/emulators
```

**Implementation:**
- `src/cli/index.ts` — entry point with subcommands
- `init` — generates `vitest.config.ts` with plugin, sample test file
- `run` — spawns `vitest run` with correct config
- `update` — sets `UPDATE_SCREENSHOTS=true` and runs
- `devices` — calls detect and prints table
- Add `"bin"` field to package.json

### M2: HTML Report with Screenshot Diffs

Visual report showing baseline vs latest vs diff for each screenshot test.

**Implementation:**
- Generate JSON results during test run (pass/fail, paths, diff percentages)
- Build static HTML report from results (inline images or relative paths)
- Open in browser after run (optional flag)
- Could use a simple template or a lightweight framework

### M3: CI/CD Guidance

- GitHub Actions workflow examples (macOS runner for iOS, Linux for Android)
- Screenshot baseline management in CI (commit baselines, detect drift)
- Caching strategies for driver builds
- Example PR workflow: run tests, upload diff report as artifact

### M4: Documentation

- README with quick start, installation, API reference
- Examples for common patterns (login flow, navigation, screenshot testing)
- Migration guide from Maestro
- Contributing guide

---

## Implementation Order

1. M1: CLI tool (immediate usability win)
2. M4: Documentation (needed for any public release)
3. M2: HTML report
4. M3: CI/CD guidance
