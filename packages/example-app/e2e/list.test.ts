import { by, device, element } from "mobile-test";
import { describe, expect, it } from "vitest";

describe("List", () => {
  it("launches directly to list and scrolls through the current list overview", async () => {
    await device.launch({ path: "/list" });
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

    // Scroll all the way to the bottom for a deterministic screenshot
    await element(by.id("list-scroll")).scrollToEnd("down");
    await device.waitForAnimationToEnd();
    await expect(element(by.label("Item 29"))).toBeVisible();

    // Screenshot of the scrolled state
    await expect(device).toMatchScreenshot("list-scrolled-to-bottom");
  });
});
