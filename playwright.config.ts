import { defineConfig } from "@playwright/test";
import path from "path";

const pathToExtension = path.join(import.meta.dirname, ".output/chrome-mv3");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    headless: false,
  },
  projects: [
    {
      name: "chromium",
      use: {
        launchOptions: {
          args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
          ],
        },
      },
    },
  ],
});
