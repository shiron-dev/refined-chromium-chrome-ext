import type { BackgroundMessageHandler } from "../../core/types";
import { extensionApi } from "../../utils/extension-api";

export interface BulkReloadResult {
  reloaded: number
  skipped: number
}

function isReloadableUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  }
  catch {
    return false;
  }
}

async function checkTabIsHealthy(tabId: number): Promise<boolean> {
  if (!extensionApi?.scripting) {
    return false;
  }

  try {
    const results = await extensionApi.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Detect property-based beforeunload handler
        if (window.onbeforeunload !== null && window.onbeforeunload !== undefined) {
          return false;
        }

        // Detect form fields with unsaved (dirty) values
        const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='checkbox']):not([type='radio']), textarea",
        );
        for (const input of Array.from(inputs)) {
          if (input.value !== input.defaultValue) {
            return false;
          }
        }

        return true;
      },
    });

    return results?.[0]?.result === true;
  }
  catch {
    // Tab is restricted (chrome://, chrome-extension://, etc.) – skip
    return false;
  }
}

export const backgroundHandlers: Record<string, BackgroundMessageHandler> = {
  bulkReloadHealthyTabs: async (): Promise<BulkReloadResult> => {
    if (!extensionApi?.tabs) {
      return { reloaded: 0, skipped: 0 };
    }

    const allTabs = await extensionApi.tabs.query({});
    let reloaded = 0;
    let skipped = 0;

    await Promise.all(
      allTabs.map(async (tab: any) => {
        const tabId: number | undefined = tab.id;
        if (tabId === undefined) {
          skipped++;
          return;
        }

        if (!isReloadableUrl(tab.url)) {
          skipped++;
          return;
        }

        const healthy = await checkTabIsHealthy(tabId);
        if (!healthy) {
          skipped++;
          return;
        }

        try {
          await extensionApi.tabs.reload(tabId);
          reloaded++;
        }
        catch {
          skipped++;
        }
      }),
    );

    return { reloaded, skipped };
  },
};
