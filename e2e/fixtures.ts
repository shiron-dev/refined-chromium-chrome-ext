import { type BrowserContext, chromium, test as base } from "@playwright/test";
import fs from "fs";
import path from "path";

const pathToExtension = path.join(import.meta.dirname, "../.output/chrome-mv3");
const nycOutputDir = path.join(process.cwd(), ".nyc_output");

async function saveCoverage(context: BrowserContext) {
  if (process.env.E2E_COVERAGE !== "true") return;
  fs.mkdirSync(nycOutputDir, { recursive: true });
  for (const page of context.pages()) {
    try {
      const coverage = await page.evaluate(
        () => (window as Window & { __coverage__?: unknown }).__coverage__,
      );
      if (coverage) {
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
        fs.writeFileSync(path.join(nycOutputDir, filename), JSON.stringify(coverage));
      }
    } catch {
      // Page may not have coverage data
    }
  }
}

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        ...(process.env.CI ? ["--headless=new"] : []),
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await saveCoverage(context);
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

export const expect = test.expect;
