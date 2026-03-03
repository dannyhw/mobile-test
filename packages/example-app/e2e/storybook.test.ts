import { buildIndex } from "@storybook/react-native/node";
import { device } from "mobile-test";
import { describe, expect, it } from "vitest";

const APP_BUNDLE_ID = "com.dannyhw.exampleapp";
const STORYBOOK_CONFIG_PATH = ".rnstorybook";
const STORYBOOK_CHANNEL_URL = "http://localhost:7007/send-event";
const STORY_SETTLE_DELAY_MS = 250;

async function getStoryIds(): Promise<string[]> {
  const index = await buildIndex({ configPath: STORYBOOK_CONFIG_PATH });

  console.log("index:", index);
  return Object.values(index.entries)
    .filter((entry) => entry.type === "story")
    .map((entry) => entry.id);
}

async function setCurrentStory(storyId: string): Promise<void> {
  let response: Response;

  try {
    response = await fetch(STORYBOOK_CHANNEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "setCurrentStory",
        args: [{ viewMode: "story", storyId }],
      }),
    });
  } catch (error) {
    throw new Error(
      `Failed to send Storybook event to ${STORYBOOK_CHANNEL_URL}. ` +
        "Ensure Storybook is running and exposing the channel server on port 7007.",
      { cause: error },
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Storybook channel server returned ${response.status} ${response.statusText}.` +
        (body ? ` Response: ${body}` : ""),
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
  } | null;

  if (payload?.success === false) {
    throw new Error(
      `Storybook channel server failed to send setCurrentStory: ${
        payload.error ?? "unknown error"
      }`,
    );
  }
}

describe("Storybook", () => {
  it("visits every story and captures screenshots", async () => {
    const storyIds = await getStoryIds();
    expect(storyIds.length).toBeGreaterThan(0);

    await device.launch(APP_BUNDLE_ID);
    await device.waitForAnimationToEnd();

    for (const [index, storyId] of storyIds.entries()) {
      console.log(
        `[storybook-e2e] Capturing story ${index + 1}/${storyIds.length}: ${storyId}`,
      );

      await setCurrentStory(storyId);
      await new Promise((resolve) =>
        setTimeout(resolve, STORY_SETTLE_DELAY_MS),
      );
      await device.waitForAnimationToEnd({ timeout: 2_500, interval: 200 });

      await expect(device).toMatchScreenshot(`storybook-${storyId}`);
    }
  });
});
