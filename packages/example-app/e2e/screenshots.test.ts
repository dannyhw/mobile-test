import { by, device, element } from "mobile-test";
import { describe, expect, it } from "vitest";

describe("Screenshots", () => {
  it("captures an element-level screenshot", async () => {
    await device.launch({ path: "/" });

    await element(by.id("click-button")).tap();
    await expect(element(by.id("counter"))).toHaveText("1");

    // Cropped to the element's frame (in device pixels).
    await expect(element(by.id("click-button"))).toMatchScreenshot(
      "increment-button",
    );
  });

  it("masks dynamic content", async () => {
    await device.launch({ path: "/form" });

    // The status card shows a clock that changes every second; masking it
    // keeps the comparison stable.
    await expect(device).toMatchScreenshot("form-initial", {
      mask: [element(by.id("form-status-card"))],
    });
  });
});
