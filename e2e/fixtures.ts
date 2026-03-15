import { test as base, chromium, type BrowserContext } from "@playwright/test";

type TestOptions = {
  context: BrowserContext;
  extensionId: string;
};

export const test = base.extend<TestOptions>({
  context: async ({ }, use) => {
    const pathToExtension = process.env.EXTENSION_PATH || "dist";
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});

export { expect } from "@playwright/test";
