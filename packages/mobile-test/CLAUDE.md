# mobile-test

TypeScript-first mobile testing framework. Screenshot testing focused. React Native first, works with native apps.

## Working on This Project

Follow the checklist in `TODO.md`. Work top to bottom — items are ordered by dependency. Check off items (`- [x]`) as you complete them. When all items are done, move the file to `completed-steps/` with a descriptive name.

To start a new step: look at the next milestone in `phase-1-plan.md`, create a `TODO.md` with a detailed checklist broken into sub-tasks, including references to relevant source files. Get user approval on the TODO before starting implementation.

Full plan, architecture, and detailed references are in `../../research/`:

- `phase-1-plan.md` — implementation steps, code examples, milestones, and reference file paths per milestone
- `synthesis-and-approach.md` — overall architecture and API design

## Conventions

- TypeScript, ESM, Node.js 18+
- Use `bun` as the package manager
- `execa` for shell commands, `odiff-bin` for screenshots, `vitest` as peer dep
- HTTP/JSON protocol between TS client and Swift driver
- Minimal dependencies
