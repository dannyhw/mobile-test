# mobile-test

TypeScript-first mobile testing framework. Screenshot testing focused. React Native first, works with native apps.

## Working on This Project

Follow the checklist in `TODO.md`. Work top to bottom — items are ordered by dependency. Check off items (`- [x]`) as you complete them. When all items are done, move the file to `completed-steps/<phase>/` with a descriptive name.

To start a new milestone: look at the current phase plan in `../../plan/`, create a `TODO.md` with a detailed checklist broken into sub-tasks, including references to relevant source files. Get user approval on the TODO before starting implementation.

Key references:
- `../../ROADMAP.md` — overall architecture, API design, phased plan
- `../../plan/` — detailed implementation plans per phase
- `../../research/` — deep dives on existing tools and approaches
- `completed-steps/` — records of completed work (organized by phase)

## Building & Testing

- `bun run build` (or `npx tsup`) — build to dist/
- `bun run test` — unit tests
- From example-app: `bun run test:e2e` — e2e tests against a booted simulator
- **Important**: after source changes, rebuild before running example-app tests (they load from dist/)

## Conventions

- TypeScript, ESM, Node.js 18+
- Use `bun` as the package manager
- `execa` for shell commands, `odiff-bin` for screenshots, `vitest` as peer dep
- HTTP/JSON protocol between TS client and Swift driver
- Minimal dependencies
