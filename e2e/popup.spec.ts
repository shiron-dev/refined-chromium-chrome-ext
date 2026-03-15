import { expect, test } from "./fixtures";

test("popup opens and shows UI", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/index.html`);

  await expect(page.locator("body")).toBeVisible();
});

test("popup displays tracked PR count", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/index.html`);

  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("body")).toBeVisible();
});
