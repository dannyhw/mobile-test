import { by, device, element } from "mobile-test";
import { describe, expect, it } from "vitest";

describe("Form", () => {
  it("launches directly to the form tab", async () => {
    await device.launch({ path: "/form" });
    await device.waitForAnimationToEnd();

    // Verify the deep link landed on the form route.
    await expect(element(by.id("form-submit"))).not.toBeEnabled();
  });

  it("clears a text input through the native driver flow", async () => {
    await device.launch({ path: "/form" });
    await device.waitForAnimationToEnd();

    await element(by.id("form-name")).type("Alice");
    await element(by.id("form-email")).type("alice@example.com");
    await element(by.id("form-terms")).tap();

    await expect(element(by.id("form-submit"))).toBeEnabled();
    await expect(element(by.id("form-name"))).toHaveValue("Alice");

    await element(by.id("form-name")).clear();

    await expect(element(by.id("form-submit"))).not.toBeEnabled();
    await expect(element(by.id("form-name"))).toHaveValue("");
  });
});
