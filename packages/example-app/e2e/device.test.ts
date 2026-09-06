import { by, device, element } from "mobile-test";
import { describe, expect, it } from "vitest";

describe("Device", () => {
  it("opens a deep link on the already running app", async () => {
    await device.launch({ path: "/" });
    await device.waitForAnimationToEnd();
    await expect(element(by.id("counter"))).toBeVisible();

    // Opening a URL onto a running app (iOS shows an "Open in app?" alert
    // that the framework accepts).
    await device.openUrl({ path: "/form" });
    await device.waitForAnimationToEnd();

    await expect(element(by.id("form-name"))).toBeVisible();
  });

  it("hides the keyboard after typing", async () => {
    await device.launch({ path: "/form" });
    await device.waitForAnimationToEnd();

    await element(by.id("form-name")).type("Alice");
    await device.hideKeyboard();
    await device.waitForAnimationToEnd();

    // The submit button sits below the fields; with the keyboard gone it is on screen.
    await expect(element(by.id("form-submit"))).toBeVisible();
    await expect(element(by.id("form-name"))).toHaveValue("Alice");
  });

  it("goes home and relaunches", async () => {
    await device.launch({ path: "/" });
    await device.waitForAnimationToEnd();
    await element(by.id("click-button")).tap();
    await expect(element(by.id("counter"))).toHaveText("1");

    await device.pressHome();

    // Relaunch restarts the app, so the in-memory count resets.
    await device.launch({ path: "/" });
    await device.waitForAnimationToEnd();
    await expect(element(by.id("counter"))).toHaveText("0");
  });

  it("sets a simulated location without failing", async () => {
    await device.launch({ path: "/" });
    await device.setLocation(37.7749, -122.4194);
  });
});
