Bun monorepo with two packages:

packages/mobile-test/ - our mobile test framework
packages/example-app/ - Expo React Native app used for testing
research/ - research on existing tools and approaches

Maestro/ and Detox/ are reference repos (gitignored, not part of the project).

store all useful information and findings in research/ as you go, so we can refer back to it when building our new tool.

requirements:

- Typescript api
- Written with typescript, uses swift/kotlin where required for native integration
- doesn't require custom build of the app
- doesn't require changing app code other than a11y or test ids
- focus on screenshot testing workflow
- supports iOS and Android
- relies on native tooling, provides a thin wrapper around it
- provides an api similar to existing ts testing tools like playwright/vitest to make it familiar
- react native first, but can be used with native apps as well

problems with maestro we want to solve:

- not typescript api, requires learning a new language and tool
- slow
- way too many layers of abstraction and built with java which is unfamiliar to our target users
- doesnt have a built in way to compaire screenshots
- not extensible, hard for users to extend and customize for their needs

good things about maestro:

- works automatically with most projects without custom builds
- supports both iOS and Android
- has the commands we need like press, swipe, etc

other references to look at:

- detox - testing tool for react native, but requires custom build and has a lot of setup and maintenance overhead
- appium and webdriverio - popular testing tools for native apps, but not focused on react native and can be complex to set up and use
- owl - screenshot testing tool for react native
