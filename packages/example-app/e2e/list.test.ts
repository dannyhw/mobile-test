import { by, device, element } from "mobile-test";
import { describe, expect, it } from "vitest";

describe("List", () => {
  it("navigates to list tab and scrolls through the current list overview", async () => {
    await device.launch("com.dannyhw.exampleapp");
    await device.waitForAnimationToEnd();

    // Navigate to list tab
    await element(by.text("List")).tap();
    await device.waitForAnimationToEnd();

    // Verify the current list summary and first item state
    await expect(element(by.id("list-summary"))).toBeVisible();
    await expect(element(by.id("list-header"))).toBeVisible();
    await expect(element(by.id("list-header"))).toHaveText("Items");
    await expect(element(by.id("list-description"))).toHaveText(
      "Search from the native header and scroll through a grouped list.",
    );
    await expect(element(by.id("list-scroll"))).toBeVisible();
    await expect(element(by.id("list-card"))).toBeVisible();

    // Verify first item by label
    await expect(element(by.label("Item 0"))).toBeVisible();

    // Access first item by id and atIndex
    await expect(element(by.id("list-item-0")).atIndex(0)).toBeVisible();

    // Scroll into the list and then take one more deterministic swipe so the
    // final screenshot is anchored to a stable scrolled state.
    await element(by.id("list-scroll")).scrollTo(
      element(by.id("list-item-18")),
      "down",
    );
    await expect(element(by.id("list-item-18"))).toBeVisible();
    await expect(element(by.label("Item 18"))).toBeVisible();
    await element(by.id("list-scroll")).swipe("up");
    await expect(element(by.id("list-item-22"))).toBeVisible();

    // Screenshot of the scrolled state
    await expect(device).toMatchScreenshot("list-scrolled");
  });
});
