import { test, expect } from "./fixtures";

test("popup should load", async ({ context, extensionId }) => {
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

  const heading = popupPage.locator("h1");
  await expect(heading).toContainText("拡張機能モジュール");
});
