import { by, device, element } from "mobile-test";
import { describe, expect, it } from "vitest";

describe("Counter App", () => {
  it("shows the initial screen", async () => {
    await device.launch("com.dannyhw.exampleapp");

    await device.waitForAnimationToEnd();

    // Ensure we are on the counter tab even if tab state persisted from a prior run.
    await element(by.text("Counter")).tap();
    await device.waitForAnimationToEnd();

    // Verify the counter screen is visible.
    await expect(element(by.id("counter"))).toBeVisible();

    // Screenshot the initial state
    await expect(device).toMatchScreenshot("counter-initial");
  });

  it("increments the counter on tap", async () => {
    await element(by.text("Counter")).tap();
    await device.waitForAnimationToEnd();

    await element(by.id("counter-scroll")).scrollTo(element(by.id("click-button")));
    await expect(element(by.id("click-button"))).toBeVisible();

    // Tap the button
    await element(by.id("click-button")).tap();

    // Verify counter updated
    await expect(element(by.id("counter"))).toHaveText("1");

    // Tap a few more times
    await element(by.id("click-button")).tap();
    await element(by.id("click-button")).tap();

    await expect(element(by.id("counter"))).toHaveText("3");

    // Screenshot after tapping
    await expect(device).toMatchScreenshot("counter-after-taps");
  });
});
