import { by, device, element } from "mobile-test";
import { describe, expect, it } from "vitest";

describe("List", () => {
  it("navigates to list tab and interacts with items", async () => {
    await device.launch("com.dannyhw.exampleapp");
    await device.waitForAnimationToEnd();

    // Navigate to list tab
    await element(by.text("List")).tap();
    await device.waitForAnimationToEnd();

    // Verify header visible
    await expect(element(by.id("list-header"))).toBeVisible();
    await expect(element(by.id("list-header"))).toHaveText("Items");

    // Verify first item by label
    await expect(element(by.label("Item 0"))).toBeVisible();

    // Access first item by id and atIndex
    await expect(element(by.id("list-item-0")).atIndex(0)).toBeVisible();

    // Scroll to the last item
    await element(by.id("list-scroll")).scrollTo(
      element(by.id("list-item-29")),
      "down"
    );
    await expect(element(by.id("list-item-29"))).toBeVisible();

    // Verify item by regex label
    await expect(element(by.label(/Item 2\d/))).toBeVisible();

    // Screenshot after scrolling
    await expect(device).toMatchScreenshot("list-scrolled-to-bottom");
  });
});
