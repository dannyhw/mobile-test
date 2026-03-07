import { by, device, element } from "mobile-test";
import { describe, expect, it } from "vitest";

describe("Animations", () => {
  it("launches directly to animations and runs animation", async () => {
    await device.launch({ path: "/animations" });
    await device.waitForAnimationToEnd();

    // Verify initial state
    await expect(element(by.id("anim-status"))).toHaveText("idle");

    // Trigger animation
    await element(by.id("anim-trigger")).tap();

    // Wait for animation to complete
    await device.waitForAnimationToEnd();

    // Verify animation completed
    await expect(element(by.id("anim-status"))).toHaveText("done");
    await expect(element(by.id("anim-box"))).toBeVisible();

    // Screenshot after animation
    await expect(device).toMatchScreenshot("animation-completed");
  });
});
