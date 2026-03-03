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

## Requirements

- Typescript api
- Written with typescript, uses swift/kotlin where required for native integration
- doesn't require custom build of the app
- doesn't require changing app code other than a11y or test ids
- focus on screenshot testing workflow
- supports iOS and Android
- relies on native tooling, provides a thin wrapper around it
- provides an api similar to existing ts testing tools like playwright/vitest to make it familiar
- react native first, but can be used with native apps as well

## Context: Problems with Maestro We Want to Solve

- not typescript api, requires learning a new language and tool
- slow
- way too many layers of abstraction and built with java which is unfamiliar to our target users
- doesnt have a built in way to compare screenshots
- not extensible, hard for users to extend and customize for their needs
