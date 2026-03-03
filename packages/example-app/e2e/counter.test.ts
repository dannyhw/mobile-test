import { by, device, element } from "mobile-test";
import { describe, expect, it } from "vitest";

describe("Counter App", () => {
  it("shows the initial screen", async () => {
    await device.launch("com.dannyhw.exampleapp");

    // TODO figure this out???
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for the app to stabilize

    // Verify the button and counter are visible
    await expect(element(by.id("click-button"))).toBeVisible();
    await expect(element(by.id("counter"))).toBeVisible();

    // Screenshot the initial state
    await expect(device).toMatchScreenshot("counter-initial");
  });

  it("increments the counter on tap", async () => {
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
