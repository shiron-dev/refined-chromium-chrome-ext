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
  try {
    const response = await extensionApi.tabs.sendMessage(tabId, {
      moduleId: "bulkTabReload",
      action: "isHealthy",
    });
    return (response as { healthy?: boolean } | undefined)?.healthy === true;
  }
  catch {
    // Content script not reachable (tab still loading, restricted URL, etc.) – skip
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
