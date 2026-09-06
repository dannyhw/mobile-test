import { buildIndex, createChannelServer } from "@storybook/react-native/node";
import { by, device, element } from "mobile-test";
import { afterAll, describe, expect, it } from "vitest";

const STORYBOOK_CONFIG_PATH = ".rnstorybook";
const STORYBOOK_CHANNEL_PORT = 7007;
const STORYBOOK_CHANNEL_URL = `http://localhost:${STORYBOOK_CHANNEL_PORT}/send-event`;
const CLIENT_CONNECT_TIMEOUT_MS = 3_000;

/**
 * Stories are switched through Storybook's channel server (a websocket the
 * app connects to on launch). When Metro is running its `withStorybook`
 * plugin already hosts that server on 7007; otherwise this test starts one
 * itself with `createChannelServer` from `@storybook/react-native/node`, so a
 * release build works too. If the app never connects (for example the bundle
 * was built with a different host IP baked in), stories are switched by
 * deep-linking `/storybook?STORYBOOK_STORY_ID=...` instead.
 */
type StorySwitcher = "channel" | "deeplink";

let ownServer: ReturnType<typeof createChannelServer> = null;

afterAll(() => {
  const server = ownServer;
  ownServer = null;
  if (server) {
    server.close();
    (server.options as { server?: { close(): void } }).server?.close();
  }
});

async function getStoryIds(): Promise<string[]> {
  const index = await buildIndex({ configPath: STORYBOOK_CONFIG_PATH });

  return Object.values(index.entries)
    .filter((entry) => entry.type === "story")
    .map((entry) => entry.id);
}

async function externalChannelReachable(): Promise<boolean> {
  try {
    const response = await fetch(STORYBOOK_CHANNEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ping", args: [] }),
      signal: AbortSignal.timeout(1_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Start our own channel server unless Metro already provides one. */
async function ensureChannelServer(): Promise<"external" | "own"> {
  if (await externalChannelReachable()) return "external";
  ownServer = createChannelServer({
    port: STORYBOOK_CHANNEL_PORT,
    configPath: STORYBOOK_CONFIG_PATH,
    websockets: true,
  });
  return "own";
}

/** With our own server we can tell whether the app actually connected. */
async function waitForClient(): Promise<boolean> {
  if (!ownServer) return true; // external server: assume Metro's app is connected
  const deadline = Date.now() + CLIENT_CONNECT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (ownServer.clients.size > 0) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function sendChannelEvent(storyId: string): Promise<void> {
  const response = await fetch(STORYBOOK_CHANNEL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "setCurrentStory",
      args: [{ viewMode: "story", storyId }],
    }),
  });

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

async function setCurrentStory(
  switcher: StorySwitcher,
  storyId: string,
): Promise<void> {
  if (switcher === "channel") {
    await sendChannelEvent(storyId);
  } else {
    await device.openUrl({ path: `/storybook?STORYBOOK_STORY_ID=${storyId}` });
  }
}

describe("Storybook", () => {
  it("visits every story and captures screenshots", async () => {
    const storyIds = await getStoryIds();
    expect(storyIds.length).toBeGreaterThan(0);

    const channel = await ensureChannelServer();
    const firstStoryId = storyIds.at(0)!;

    await device.launch({
      path: `/storybook?STORYBOOK_STORY_ID=${firstStoryId}`,
    });

    await expect(element(by.id(firstStoryId))).toBeVisible();

    const switcher: StorySwitcher = (await waitForClient())
      ? "channel"
      : "deeplink";
    console.log(
      `[storybook-e2e] Channel server: ${channel}; switching stories via ${switcher}`,
    );

    for (const [index, storyId] of storyIds.entries()) {
      console.log(
        `[storybook-e2e] Capturing story ${index + 1}/${storyIds.length}: ${storyId}`,
      );

      await setCurrentStory(switcher, storyId);

      await expect(element(by.id(storyId))).toBeVisible();

      await expect(device).toMatchScreenshot(`storybook-${storyId}`);
    }
  });
});
