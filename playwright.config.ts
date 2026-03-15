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
  reporter: [
    ["list"],
    [
      "monocart-reporter",
      {
        name: "E2E Test Report",
        outputFile: "./coverage/e2e/index.html",
      },
    ],
  ],
  projects: [
    {
      name: "chromium",
      use: {
        launchOptions: {
          args: [
            ...(process.env.CI ? ["--headless=new"] : []),
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
          ],
        },
      },
    },
  ],
});
