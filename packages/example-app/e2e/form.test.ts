import { by, device, element } from "mobile-test";
import { describe, expect, it } from "vitest";

describe("Form", () => {
  it("navigates to form tab and fills the form", async () => {
    await device.launch("com.dannyhw.exampleapp");
    await device.waitForAnimationToEnd();

    // Navigate to form tab
    await element(by.text("Form")).tap();
    await device.waitForAnimationToEnd();

    // Verify submit is disabled initially
    await expect(element(by.id("form-submit"))).not.toBeEnabled();
    await expect(element(by.id("form-status"))).toHaveText("Ready");

    // Type name
    await element(by.id("form-name")).type("Alice");
    await expect(element(by.id("form-name"))).toHaveValue("Alice");

    // Still disabled — email and terms missing
    await expect(element(by.id("form-submit"))).not.toBeEnabled();

    // Type email
    await element(by.id("form-email")).type("alice@test.com");

    // Still disabled — terms not accepted
    await expect(element(by.id("form-submit"))).not.toBeEnabled();

    // Toggle terms switch
    await element(by.id("form-terms")).tap();

    // Now submit should be enabled
    await expect(element(by.id("form-submit"))).toBeEnabled();

    // Replace name
    await element(by.id("form-name")).replaceText("Bob");
    await expect(element(by.id("form-name"))).toHaveValue("Bob");

    // Tap submit
    await element(by.id("form-submit")).tap();
    await expect(element(by.id("form-status"))).toHaveText("Submitted: Bob");

    // Dismiss keyboard before screenshots to avoid cursor blink diffs
    await device.hideKeyboard();

    // Element screenshot of form-status
    await expect(element(by.id("form-status"))).toMatchScreenshot(
      "form-status",
    );

    // Full screenshot with timestamp masked
    await expect(device).toMatchScreenshot("form-submitted", {
      mask: [element(by.id("form-timestamp"))],
    });
  });
});
