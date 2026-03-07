# mobile-test

`mobile-test` is an early-stage mobile testing framework aimed at React Native teams that want a TypeScript API, a practical screenshot testing workflow, and a Vitest-based test runner setup with less friction than the usual options.

The core idea is simple: use the native automation tools that already exist on iOS and Android, wrap them in a small TypeScript-first test API, and make screenshot assertions part of the normal test flow instead of an afterthought.

This repo is not trying to invent mobile automation from scratch, and it is not trying to claim that existing tools are wrong. It exists because the current tools tend to force a tradeoff:

- simple setup, but a non-TypeScript authoring model
- a good API, but custom app builds and extra integration work
- screenshot testing, but only with a separate workflow or extra tooling

The project is meant to explore whether we can get a better balance of those tradeoffs.

## What We Want To Achieve

The goals in this repo are:

- a TypeScript API that feels familiar to people using Vitest, Playwright, or Detox
- Vitest as the test runner, rather than a separate custom runner
- no custom build of the app under test
- no app changes beyond sensible accessibility labels or test IDs
- a first-class screenshot testing workflow with baselines, diffs, masking, and updates
- support for both iOS and Android
- a thin wrapper around native platform tooling rather than a large new runtime

In practice, that means tests should look more like this:

```ts
import { describe, it, expect } from 'vitest'
import { device, element, by } from 'mobile-test'

describe('Login flow', () => {
  it('shows the welcome screen', async () => {
    await device.launch('com.example.myapp')
    await expect(device).toMatchScreenshot('welcome')
  })

  it('logs in successfully', async () => {
    await element(by.id('email')).type('user@example.com')
    await element(by.id('password')).type('secret')
    await element(by.id('login-button')).tap()

    await expect(element(by.text('Welcome back'))).toBeVisible()
    await expect(device).toMatchScreenshot('home')
  })
})
```

## Why This Exists

The motivation in the repo docs is consistent:

- Maestro proves that zero-config style automation is possible, but its YAML workflow and screenshot story are not what this project wants.
- Detox has a strong JavaScript API, but it depends on a custom build/integration model that raises the setup cost.
- Appium and WebdriverIO are flexible and mature, but they bring more infrastructure and abstraction than this repo is aiming for.
- Owl is close in spirit on screenshot testing, especially for React Native, but it takes a different approach and does not cover the exact target here.

The project goal is not "beat all of them". It is narrower: learn from them and build a simpler tool for a specific shape of problem.

## Approach

The main architectural direction comes from the research into Maestro and Appium:

- install a small driver onto the simulator or emulator at runtime
- let that driver talk to native automation frameworks
- expose a simple host-side API over HTTP/JSON
- keep most framework logic in TypeScript

Planned platform approach:

- iOS: an XCTest-based driver that uses XCUITest accessibility APIs and native screenshot capture
- Android: a UIAutomator-based driver with the same host-side protocol

This is intended to preserve the "no app rebuild for testing" model while still giving test authors a normal TypeScript API on top of Vitest.

## Current Status

This repo is still in progress.

- `packages/mobile-test` contains the framework work
- `packages/example-app` is a small Expo app used for testing and examples
- the implementation today is centered on the iOS simulator path
- Android support, CLI polish, reporting, and broader docs are planned next

So the project should be read as active implementation work, not a finished public release.

## Prior Art And Inspiration

This project is directly informed by existing tools:

- Maestro: driver-app pattern, no-custom-build approach, practical device control
- Detox: TypeScript-friendly test API, locator and assertion style
- Appium / WebDriverIO: server-driver architecture and cross-platform lessons
- Owl: screenshot testing workflow for React Native
- Playwright / Vitest: test ergonomics, expectations, and familiar API shape

The research notes in [`research/`](./research/) go into more detail on what was borrowed, what was rejected, and why.

## Repository Guide

- [`PROJECT_REQUIREMENTS_AND_CONTEXT.md`](./PROJECT_REQUIREMENTS_AND_CONTEXT.md): project constraints and motivation
- [`ROADMAP.md`](./ROADMAP.md): architecture overview and phased plan
- [`plan/`](./plan/): detailed implementation phases
- [`research/`](./research/): notes on Maestro, Detox, Appium, Owl, Playwright patterns, and related tooling
- [`packages/mobile-test`](./packages/mobile-test): framework package
- [`packages/example-app`](./packages/example-app): example app used to exercise the framework

## Scope

This project is aiming for a practical middle ground:

- higher-level than raw simulator and adb commands
- lower-level and simpler than a very broad automation platform
- focused on app interaction plus screenshot confidence, not every possible testing feature

If that sounds narrower than a general-purpose E2E platform, that is intentional.
