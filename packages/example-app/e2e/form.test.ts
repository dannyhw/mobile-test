import { by, device, element } from "mobile-test";
import { describe, expect, it } from "vitest";

describe("Form", () => {
  it("launches directly to the form tab", async () => {
    await device.launch({ path: "/form" });
    await device.waitForAnimationToEnd();

    // Verify the deep link landed on the form route.
    await expect(element(by.id("form-submit"))).not.toBeEnabled();
  });
});
