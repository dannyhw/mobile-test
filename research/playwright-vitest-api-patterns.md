# Playwright & Vitest API Patterns Research

Research into the API design patterns of Playwright and Vitest, and how they should inform our mobile testing framework.

---

## 1. Playwright API Patterns

### 1.1 Locators

Locators are Playwright's core abstraction for finding and interacting with elements. A locator is a lazy reference -- it does not query the DOM when created. Instead, the element is located fresh before every action or assertion, which makes tests resilient to DOM changes.

**Sources**: [Locators docs](https://playwright.dev/docs/locators), [Locator class API](https://playwright.dev/docs/api/class-locator)

#### Built-in Locator Methods (recommended priority order)

```typescript
// 1. Role-based (preferred -- uses accessibility tree)
page.getByRole('button', { name: 'Sign in' })
page.getByRole('heading', { name: 'Welcome' })

// 2. Test ID (explicit contract, stable)
page.getByTestId('submit-button')

// 3. Text content
page.getByText('Welcome, John')
page.getByText('Welcome, John', { exact: true })
page.getByText(/welcome, [A-Za-z]+$/i)

// 4. Label (for form controls)
page.getByLabel('Username')

// 5. Placeholder
page.getByPlaceholder('name@example.com')

// 6. Alt text (images)
page.getByAltText('company logo')

// 7. Title attribute
page.getByTitle('Issues count')

// 8. CSS/XPath (discouraged -- fragile)
page.locator('.my-class')
page.locator('xpath=//button')
```

#### Key Design Decisions

- **Strict by default**: If a locator matches multiple elements, actions throw an error. You must narrow it down.
- **Lazy evaluation**: Locators are not resolved until an action or assertion is performed.
- **Re-evaluation**: The element is re-located before each action, so the test does not hold stale references.

#### Chaining and Filtering

```typescript
// Chaining narrows scope
const dialog = page.getByTestId('settings-dialog');
await dialog.getByRole('button', { name: 'Save' }).click();

// filter() narrows by text, child locators, or visibility
await page.getByRole('listitem')
  .filter({ hasText: 'Product 2' })
  .getByRole('button', { name: 'Add to cart' })
  .click();

// filter by child locator
await page.getByRole('listitem')
  .filter({ has: page.getByRole('heading', { name: 'Product 2' }) })
  .click();

// Combine with and() / or()
const button = page.getByRole('button').and(page.getByTitle('Subscribe'));
const action = newEmail.or(dialog).first();
```

#### List Operations

```typescript
// Count
await expect(page.getByRole('listitem')).toHaveCount(3);

// Get nth element
const second = page.getByRole('listitem').nth(1);

// Iterate
for (const row of await page.getByRole('listitem').all()) {
  console.log(await row.textContent());
}
```

### 1.2 Actions

Actions are methods on locators that simulate user interactions. They all auto-wait before executing.

```typescript
await locator.click();
await locator.dblclick();
await locator.fill('text');         // clears and types
await locator.type('text');         // types character by character
await locator.press('Enter');
await locator.hover();
await locator.check();              // checkbox
await locator.uncheck();
await locator.selectOption('value');
await locator.scrollIntoViewIfNeeded();
await locator.focus();
await locator.dragTo(target);
```

**Key pattern**: Actions are always `await`-ed and return promises. They are methods directly on the locator -- no separate "action" object.

### 1.3 Auto-Waiting

**Source**: [Actionability docs](https://playwright.dev/docs/actionability)

Before performing any action, Playwright automatically waits for the element to satisfy **actionability checks**:

| Check | Description |
|-------|-------------|
| **Visible** | Non-empty bounding box, no `visibility:hidden` |
| **Stable** | Bounding box consistent across two animation frames |
| **Receives Events** | Element is the actual hit target (not obscured) |
| **Enabled** | No `disabled` attribute |
| **Editable** | Enabled and not `readonly` (for fill/type) |

Different actions require different subsets of these checks. For example:
- `click()` requires: visible, stable, receives events, enabled
- `fill()` requires: visible, enabled, editable

**Timeouts**: Actions timeout after 30 seconds by default (configurable). Assertions timeout after 5 seconds by default.

**Force option**: `await locator.click({ force: true })` skips actionability checks.

### 1.4 Assertions

**Source**: [Assertions docs](https://playwright.dev/docs/test-assertions), [LocatorAssertions API](https://playwright.dev/docs/api/class-locatorassertions)

Assertions use the `expect()` function with **auto-retrying matchers**:

```typescript
// Locator assertions (auto-retry until timeout)
await expect(locator).toBeVisible();
await expect(locator).toBeHidden();
await expect(locator).toBeEnabled();
await expect(locator).toBeDisabled();
await expect(locator).toBeEditable();
await expect(locator).toBeFocused();
await expect(locator).toBeChecked();
await expect(locator).toBeEmpty();
await expect(locator).toBeInViewport();
await expect(locator).toHaveText('expected');
await expect(locator).toContainText('partial');
await expect(locator).toHaveAttribute('name', 'value');
await expect(locator).toHaveClass('my-class');
await expect(locator).toHaveCount(3);
await expect(locator).toHaveValue('input value');
await expect(locator).toHaveAccessibleName('Submit');
await expect(locator).toHaveRole('button');

// Negation
await expect(locator).not.toBeVisible();

// Soft assertions (don't stop test execution)
await expect.soft(locator).toHaveText('expected');
```

**Key pattern**: All locator assertions are `async` and auto-retry. They poll the DOM until the condition is met or the timeout (default 5s) expires.

### 1.5 Screenshot Comparison

**Sources**: [Visual comparisons](https://playwright.dev/docs/test-snapshots), [SnapshotAssertions](https://playwright.dev/docs/api/class-snapshotassertions)

```typescript
// Full page screenshot comparison
await expect(page).toHaveScreenshot();

// Named screenshot
await expect(page).toHaveScreenshot('landing-page.png');

// With options
await expect(page).toHaveScreenshot({
  maxDiffPixels: 100,           // absolute pixel diff threshold
  maxDiffPixelRatio: 0.01,      // ratio-based threshold (0-1)
  threshold: 0.2,               // per-pixel color diff threshold (YIQ, 0-1)
  fullPage: true,
  animations: 'disabled',       // freeze CSS animations
  mask: [page.locator('.dynamic-ad')],  // mask dynamic elements
});

// Element-level screenshot
await expect(locator).toHaveScreenshot('button.png');

// Low-level: capture and compare manually
const screenshot = await page.screenshot();
expect(screenshot).toMatchSnapshot('landing-page.png', {
  maxDiffPixels: 27,
  threshold: 0.3,
});
```

**Baseline management**:
- First run generates reference snapshots in `[testfile]-snapshots/` directory
- File naming: `[name]-[browser]-[platform].png` (platform-specific by default)
- Update baselines: `npx playwright test --update-snapshots`
- Uses **pixelmatch** library under the hood for pixel comparison

**Global configuration** in `playwright.config.ts`:
```typescript
export default defineConfig({
  expect: {
    toHaveScreenshot: { maxDiffPixels: 10 },
    toMatchSnapshot: { maxDiffPixelRatio: 0.1 },
  },
});
```

### 1.6 Test Configuration and Fixtures

**Source**: [Test configuration](https://playwright.dev/docs/test-configuration), [Fixtures](https://playwright.dev/docs/test-fixtures)

#### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30_000,

  expect: {
    timeout: 5_000,
    toHaveScreenshot: { maxDiffPixels: 10 },
  },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
```

#### Fixtures (Dependency Injection)

Fixtures are Playwright's alternative to beforeEach/afterEach. They use a setup-use-teardown pattern:

```typescript
import { test as base } from '@playwright/test';

type MyFixtures = {
  todoPage: TodoPage;
};

export const test = base.extend<MyFixtures>({
  todoPage: async ({ page }, use) => {
    // Setup
    const todoPage = new TodoPage(page);
    await todoPage.goto();

    // Provide fixture to test
    await use(todoPage);

    // Teardown
    await todoPage.removeAll();
  },
});

// Usage in tests
test('add todo', async ({ todoPage }) => {
  await todoPage.addItem('Buy milk');
  await expect(todoPage.items).toHaveCount(1);
});
```

**Built-in fixtures**: `page`, `context`, `browser`, `browserName`, `request`

**Scopes**:
- **Test-scoped** (default): Created/destroyed per test
- **Worker-scoped**: Created once per worker, shared across tests

**Automatic fixtures**: Run for every test without being explicitly requested:
```typescript
saveLogs: [async ({}, use, testInfo) => {
  const logs = [];
  await use();
  if (testInfo.status !== testInfo.expectedStatus) {
    // save logs on failure
  }
}, { auto: true }]
```

### 1.7 Test Runner

Playwright has its own test runner (`@playwright/test`) that provides:
- Parallel execution across workers
- Project-based configuration (run same tests in different environments)
- Automatic retries
- HTML reporter with traces and screenshots
- Test filtering with `--grep`, `--project`, tags
- `test.describe()`, `test()`, `test.beforeAll()`, etc.
- `test.step()` for grouping actions within a test

---

## 2. Vitest API Patterns

**Source**: [Vitest API](https://vitest.dev/api/), [Snapshot guide](https://vitest.dev/guide/snapshot)

### 2.1 Test Organization

```typescript
import { describe, it, test, expect } from 'vitest';

describe('Calculator', () => {
  it('adds numbers', () => {
    expect(1 + 1).toBe(2);
  });

  test('subtracts numbers', () => {
    expect(5 - 3).toBe(2);
  });

  describe('edge cases', () => {
    it('handles zero', () => {
      expect(0 + 0).toBe(0);
    });
  });
});
```

### 2.2 Test Modifiers

```typescript
test.skip('not ready yet', () => { /* skipped */ });
test.only('debug this one', () => { /* only this runs */ });
test.todo('implement later');

// Parameterized tests
test.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 2, 4],
])('add(%i, %i) -> %i', (a, b, expected) => {
  expect(a + b).toBe(expected);
});

// Concurrent tests
test.concurrent('fast test', async () => { /* runs in parallel */ });

// Timeout
test('slow test', { timeout: 10_000 }, () => { /* ... */ });
```

### 2.3 Lifecycle Hooks

```typescript
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
  // Run once before all tests in this file/describe
  await setupDatabase();
});

afterAll(async () => {
  // Run once after all tests
  await teardownDatabase();
});

beforeEach(async () => {
  // Run before each test
  await seedData();
});

afterEach(async () => {
  // Run after each test
  await clearData();
});
```

### 2.4 Expect Assertions

```typescript
// Equality
expect(value).toBe(exact);
expect(value).toEqual(deepEqual);
expect(value).toStrictEqual(strict);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeDefined();
expect(value).toBeUndefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThanOrEqual(10);
expect(value).toBeCloseTo(0.3, 5);

// Strings
expect(value).toMatch(/regex/);
expect(value).toContain('substring');

// Arrays/Objects
expect(array).toContain(item);
expect(object).toHaveProperty('key', 'value');
expect(array).toHaveLength(3);

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrowError('message');

// Negation
expect(value).not.toBe(other);
```

### 2.5 Snapshot Testing

```typescript
// File-based snapshots (stored in __snapshots__/)
expect(result).toMatchSnapshot();

// Inline snapshots (stored in the test file itself)
expect(result).toMatchInlineSnapshot(`
  {
    "name": "John",
    "age": 30,
  }
`);

// Named snapshots
expect(result).toMatchSnapshot('user object');

// Update snapshots: vitest --update or vitest -u
```

### 2.6 Fixtures (test.extend)

```typescript
import { test } from 'vitest';

const myTest = test.extend({
  todos: async ({ task }, use) => {
    // Setup
    const todos = await fetchTodos();

    // Provide to test
    await use(todos);

    // Cleanup
    await cleanupTodos();
  },
});

myTest('has items', ({ todos }) => {
  expect(todos.length).toBeGreaterThan(0);
});
```

### 2.7 Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,           // allow describe/it/expect without imports
    environment: 'node',
    include: ['**/*.test.ts'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    retry: 0,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

---

## 3. Proposed Mobile Testing API

Based on the patterns above, here is a proposed API design for our mobile testing framework that should feel instantly familiar to TypeScript developers who have used Playwright or Vitest.

### 3.1 Design Principles

1. **Vitest for test structure** -- use `describe`, `it`, `expect`, hooks, and config from Vitest (or compatible runner). Do not reinvent the test runner.
2. **Playwright-style locators and assertions** -- provide `device.getByTestId()`, `device.getByText()`, etc. with auto-waiting built in.
3. **Async-first** -- every action and assertion returns a promise.
4. **Screenshot-first workflow** -- make `toHaveScreenshot()` a first-class assertion.
5. **Fixtures for device lifecycle** -- use `test.extend()` to provide a `device` fixture, similar to Playwright's `page`.

### 3.2 Locator Mapping to Mobile

| Playwright (Web) | Mobile Equivalent | Notes |
|---|---|---|
| `page.getByTestId('id')` | `device.getByTestId('id')` | Maps to `accessibilityIdentifier` (iOS) / `resource-id` or `content-description` (Android) |
| `page.getByText('text')` | `device.getByText('text')` | Finds element by visible text |
| `page.getByRole('button')` | `device.getByRole('button')` | Maps to accessibility role/trait |
| `page.getByLabel('name')` | `device.getByLabel('name')` | Maps to accessibility label |
| `page.locator('.css')` | `device.locator({ type: 'XCUIElementTypeButton' })` | Native element type query (escape hatch) |
| `locator.nth(0)` | `locator.nth(0)` | Same pattern |
| `locator.filter({ hasText: 'x' })` | `locator.filter({ hasText: 'x' })` | Same pattern |

### 3.3 Actions Mapping

| Playwright | Mobile Equivalent | Notes |
|---|---|---|
| `locator.click()` | `locator.tap()` | Primary interaction on mobile |
| `locator.fill('text')` | `locator.fill('text')` | Clear and type into text field |
| `locator.type('text')` | `locator.type('text')` | Type character by character |
| `locator.press('Enter')` | `locator.press('Enter')` | Key press |
| N/A | `locator.longPress()` | Mobile-specific |
| N/A | `device.swipe('up')` | Mobile-specific gesture |
| N/A | `device.swipe('left', { from: locator })` | Swipe from element |
| `locator.scrollIntoViewIfNeeded()` | `locator.scrollTo()` | Scroll until element is visible |
| N/A | `device.shake()` | Device-specific |
| N/A | `device.openNotifications()` | Platform-specific |

### 3.4 Example Test Code

```typescript
// login.test.ts
import { test, expect, device } from 'mobile-test';

test.describe('Login flow', () => {
  test.beforeEach(async () => {
    await device.launchApp({ reset: true });
  });

  test.afterEach(async () => {
    await device.terminateApp();
  });

  test('successful login', async () => {
    // Locators (lazy, auto-waiting)
    const emailField = device.getByTestId('email-input');
    const passwordField = device.getByTestId('password-input');
    const loginButton = device.getByText('Log In');

    // Actions
    await emailField.tap();
    await emailField.fill('user@example.com');

    await passwordField.tap();
    await passwordField.fill('password123');

    await loginButton.tap();

    // Assertions (auto-retry)
    await expect(device.getByText('Welcome back')).toBeVisible();
    await expect(device.getByTestId('home-screen')).toBeVisible();

    // Screenshot comparison
    await expect(device).toHaveScreenshot('home-screen.png');
  });

  test('shows error on invalid credentials', async () => {
    await device.getByTestId('email-input').fill('bad@example.com');
    await device.getByTestId('password-input').fill('wrong');
    await device.getByText('Log In').tap();

    await expect(device.getByText('Invalid credentials')).toBeVisible();
    await expect(device).toHaveScreenshot('login-error.png', {
      maxDiffPixels: 50,
    });
  });
});
```

### 3.5 Screenshot Testing API

```typescript
// Full device screenshot comparison
await expect(device).toHaveScreenshot('screen-name.png');

// With options
await expect(device).toHaveScreenshot('screen-name.png', {
  maxDiffPixels: 100,
  maxDiffPixelRatio: 0.01,
  threshold: 0.2,
  mask: [device.getByTestId('timestamp')],  // mask dynamic elements
});

// Element-level screenshot
await expect(device.getByTestId('card')).toHaveScreenshot('card.png');

// Update baselines
// CLI: mobile-test --update-snapshots

// Snapshots stored in:
// tests/login.test.ts-snapshots/
//   home-screen-iphone-16-ios-18.png
//   home-screen-pixel-9-android-15.png
```

### 3.6 Configuration

```typescript
// mobile-test.config.ts
import { defineConfig } from 'mobile-test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,          // mobile tests are slower
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',

  expect: {
    timeout: 10_000,        // longer for mobile auto-wait
    toHaveScreenshot: {
      maxDiffPixels: 50,
      threshold: 0.2,
    },
  },

  projects: [
    {
      name: 'iphone-16',
      use: {
        platform: 'ios',
        device: 'iPhone 16',
        os: '18.0',
        app: './ios/build/MyApp.app',
      },
    },
    {
      name: 'pixel-9',
      use: {
        platform: 'android',
        device: 'Pixel 9',
        os: '15',
        app: './android/app/build/outputs/apk/debug/app-debug.apk',
      },
    },
  ],
});
```

### 3.7 Fixtures for Device Lifecycle

```typescript
import { test as base, Device } from 'mobile-test';

// Extend with custom fixtures
const test = base.extend<{ loggedInDevice: Device }>({
  loggedInDevice: async ({ device }, use) => {
    // Setup: launch and log in
    await device.launchApp();
    await device.getByTestId('email-input').fill('test@example.com');
    await device.getByTestId('password-input').fill('password');
    await device.getByText('Log In').tap();
    await expect(device.getByTestId('home-screen')).toBeVisible();

    // Provide to test
    await use(device);

    // Teardown
    await device.terminateApp();
  },
});

test('can view profile', async ({ loggedInDevice: device }) => {
  await device.getByTestId('profile-tab').tap();
  await expect(device.getByText('test@example.com')).toBeVisible();
  await expect(device).toHaveScreenshot('profile-screen.png');
});

export { test };
```

### 3.8 Auto-Waiting Behavior for Mobile

Mobile auto-waiting should check:

| Check | Description |
|---|---|
| **Exists** | Element exists in the view hierarchy |
| **Visible** | Element is visible (not hidden, not off-screen) |
| **Stable** | Element position is stable (no ongoing animation/transition) |
| **Enabled** | Element is enabled (not disabled) |
| **Hittable** | Element can receive tap events (iOS: `isHittable`, Android: `isClickable`) |

Default timeout: 10 seconds (mobile is slower than web).

Retry mechanism: Poll the element tree at regular intervals until conditions are met or timeout is reached.

---

## 4. Key Takeaways for Implementation

1. **Use Vitest as the test runner** rather than building our own. It gives us `describe`/`it`/`expect`/hooks/config/reporters for free. Extend it with custom matchers for `toHaveScreenshot()` and mobile-specific assertions like `toBeVisible()`.

2. **Locators should be lazy objects** that are re-evaluated before every action. This is the single most important pattern from Playwright -- it eliminates an entire class of flaky test bugs.

3. **Auto-waiting is non-negotiable**. Every action and assertion must auto-wait. This is what makes Playwright tests so much more reliable than raw Selenium/Appium.

4. **Screenshot comparison should be built-in**, not a plugin. Use pixelmatch (same as Playwright), store baselines per-device/per-platform, and provide `--update-snapshots` CLI flag.

5. **Fixtures (test.extend) for device lifecycle** keeps tests clean. The `device` fixture should handle launch/terminate/reset automatically.

6. **Configuration via defineConfig()** is the standard pattern. Support projects for running the same tests across multiple devices.

7. **The API surface should be small**. Playwright succeeds because `locator.click()`, `locator.fill()`, `expect(locator).toBeVisible()` covers 90% of use cases. For mobile: `tap()`, `fill()`, `swipe()`, `longPress()`, `scrollTo()` plus assertions covers the vast majority of cases.

---

## Sources

- [Playwright Locators](https://playwright.dev/docs/locators)
- [Playwright Locator API](https://playwright.dev/docs/api/class-locator)
- [Playwright Actionability / Auto-Waiting](https://playwright.dev/docs/actionability)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright LocatorAssertions](https://playwright.dev/docs/api/class-locatorassertions)
- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Playwright SnapshotAssertions](https://playwright.dev/docs/api/class-snapshotassertions)
- [Playwright Test Configuration](https://playwright.dev/docs/test-configuration)
- [Playwright Fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright Page Object Models](https://playwright.dev/docs/pom)
- [Vitest Test API](https://vitest.dev/api/)
- [Vitest Expect API](https://vitest.dev/api/expect.html)
- [Vitest Snapshot Guide](https://vitest.dev/guide/snapshot)
- [Vitest Features](https://vitest.dev/guide/features)
