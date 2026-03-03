## IMPORTANT: Build When Changes Require It

Never tell the user to build. For changes that affect built artifacts or runtime behavior, run the relevant build yourself before stopping. The user should never have to build manually.

For docs-only or non-build-impacting changes, a build is not required. Always verify your own changes before ending.

---

Bun monorepo with two packages:

packages/mobile-test/ - our mobile test framework
packages/example-app/ - Expo React Native app used for testing

## Project Structure

- ROADMAP.md — overall architecture, API design, and phased plan
- plan/ — detailed implementation plans per phase
- research/ — deep dives on existing tools (Maestro, Detox, Appium, Owl, Playwright)

Maestro/ and Detox/ are reference repos (gitignored, not part of the project).

## When Researching

Store useful findings in research/ so we can refer back when building.

## When Building

Follow the plan for the current phase in plan/. Use TODO.md in the mobile-test package to track progress on the current milestone. When done, move it to completed-steps/<phase>/.

## Simulator One-Off Interactions

Use `agent-device` for one-off simulator interactions and app-state investigation.

Start with `agent-device --help` for full command usage.

Useful commands:
- `agent-device open [appOrUrl]`
- `agent-device snapshot -i`
- `agent-device appstate`
- `agent-device click <x y|@ref|selector>`
- `agent-device type <text>`
- `agent-device screenshot [path]`

## Shared Project Requirements & Context

See `PROJECT_REQUIREMENTS_AND_CONTEXT.md`.
