import type { AutoPinStateResponse, AutoPinTabEntry, RegisterCurrentResponse, UnregisterResponse } from "./popup/types";
import type { BackgroundMessageHandler, TabActivatedHandler, TabRemovedHandler } from "../../core/types";
import { createModuleStorage } from "../../core/storage";
import { extensionApi, getCurrentActiveTab } from "../../utils/extension-api";

const storage = createModuleStorage("autoPinOnLeave");

// In-memory: windowId -> previously active tabId (resets when service worker restarts)
const previousActiveTabByWindow = new Map<number, number>();

async function getEntries(): Promise<Record<number, AutoPinTabEntry>> {
  const data = await storage.get<Record<number, AutoPinTabEntry>>("tabs");
  if (!data || typeof data !== "object") {
    return {};
  }

  return Object.entries(data).reduce<Record<number, AutoPinTabEntry>>((acc, [key, value]) => {
    const v = value as Partial<AutoPinTabEntry>;
    if (
      typeof v.tabId === "number"
      && typeof v.url === "string"
      && typeof v.title === "string"
      && typeof v.registeredAt === "number"
    ) {
      acc[Number(key)] = { tabId: v.tabId, url: v.url, title: v.title, registeredAt: v.registeredAt };
    }
    return acc;
  }, {});
}

async function setEntries(entries: Record<number, AutoPinTabEntry>): Promise<void> {
  await storage.set("tabs", entries);
}

export const backgroundHandlers: Record<string, BackgroundMessageHandler> = {
  getState: async (): Promise<AutoPinStateResponse> => {
    const entries = await getEntries();
    const sorted = Object.values(entries).sort((a, b) => b.registeredAt - a.registeredAt);
    return { entries: sorted };
  },

  registerCurrent: async (): Promise<RegisterCurrentResponse> => {
    const tab = await getCurrentActiveTab();
    const tabId = tab?.id;
    const url = tab?.url;

    if (tabId === undefined) {
      return { ok: false, reason: "no_active_tab" };
    }

    if (!url || !["http:", "https:"].includes(new URL(url).protocol)) {
      return { ok: false, reason: "unsupported_url" };
    }

    const entries = await getEntries();
    if (entries[tabId]) {
      return { ok: false, reason: "already_registered", entry: entries[tabId] };
    }

    const entry: AutoPinTabEntry = {
      tabId,
      url,
      title: tab?.title ?? url,
      registeredAt: Date.now(),
    };

    entries[tabId] = entry;
    await setEntries(entries);

    return { ok: true, entry };
  },

  unregister: async (_payload: unknown): Promise<UnregisterResponse> => {
    const payload = _payload as { tabId: number } | undefined;
    if (payload?.tabId === undefined) {
      return { ok: false, reason: "not_found" };
    }

    const entries = await getEntries();
    if (!entries[payload.tabId]) {
      return { ok: false, reason: "not_found" };
    }

    delete entries[payload.tabId];
    await setEntries(entries);

    // Unpin the tab if it is currently pinned
    try {
      await extensionApi.tabs.update(payload.tabId, { pinned: false });
    }
    catch {
      // Tab may have been closed or already unpinned
    }

    return { ok: true };
  },
};

export const tabActivatedHandlers: TabActivatedHandler[] = [
  {
    handler: async ({ tabId, windowId }) => {
      const prevTabId = previousActiveTabByWindow.get(windowId);
      previousActiveTabByWindow.set(windowId, tabId);

      if (prevTabId === undefined || prevTabId === tabId) {
        return;
      }

      const entries = await getEntries();
      if (!entries[prevTabId]) {
        return;
      }

      try {
        await extensionApi.tabs.update(prevTabId, { pinned: true });
      }
      catch {
        // Tab may have been closed
      }
    },
  },
];

export const tabRemovedHandlers: TabRemovedHandler[] = [
  {
    handler: async (tabId: number) => {
      const entries = await getEntries();
      if (!entries[tabId]) {
        return;
      }

      delete entries[tabId];
      await setEntries(entries);
    },
  },
];
