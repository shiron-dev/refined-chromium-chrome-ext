import type { BackgroundMessageHandler, TabRemovedHandler } from "../../core/types";
import type { BrowserTab } from "../../utils/extension-api";
import type { HomeTabStateResponse, PersistentHomeTabItem, RegisterCurrentHomeTabResponse, UnregisterHomeTabResponse } from "./popup/types";
import { createModuleStorage } from "../../core/storage";
import { extensionApi, getCurrentActiveTab } from "../../utils/extension-api";

interface PersistentHomeTabEntry {
  id: string
  homeUrl: string
  windowId: number
  index: number
  tabId: number
  groupId?: number
  createdAt: number
  updatedAt: number
}

const storage = createModuleStorage("persistentHomeTab");

function createPersistentHomeTabId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizePersistentHomeUrl(rawUrl?: string): string | null {
  if (!rawUrl) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  }
  catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return null;
  }

  return parsed.toString();
}

function asPersistentHomeTabEntry(value: unknown): PersistentHomeTabEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PersistentHomeTabEntry>;

  if (
    typeof candidate.id !== "string"
    || typeof candidate.homeUrl !== "string"
    || typeof candidate.windowId !== "number"
    || typeof candidate.index !== "number"
    || typeof candidate.tabId !== "number"
    || typeof candidate.createdAt !== "number"
    || typeof candidate.updatedAt !== "number"
  ) {
    return null;
  }

  if (candidate.groupId !== undefined && typeof candidate.groupId !== "number") {
    return null;
  }

  return {
    id: candidate.id,
    homeUrl: candidate.homeUrl,
    windowId: candidate.windowId,
    index: candidate.index,
    tabId: candidate.tabId,
    groupId: candidate.groupId,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

async function getPersistentHomeTabs(): Promise<Record<string, PersistentHomeTabEntry>> {
  const data = await storage.get<Record<string, PersistentHomeTabEntry>>("tabs");
  if (!data || typeof data !== "object") {
    return {};
  }

  const parsedEntries = Object.entries(data).reduce<Record<string, PersistentHomeTabEntry>>((acc, [key, value]) => {
    const entry = asPersistentHomeTabEntry(value);
    if (entry) {
      acc[key] = entry;
    }
    return acc;
  }, {});

  return parsedEntries;
}

async function setPersistentHomeTabs(tabs: Record<string, PersistentHomeTabEntry>): Promise<void> {
  await storage.set("tabs", tabs);
}

async function resyncPersistentHomeTabIndexes(
  persistentHomeTabs: Record<string, PersistentHomeTabEntry>,
): Promise<Record<string, PersistentHomeTabEntry>> {
  if (!extensionApi?.tabs) {
    return persistentHomeTabs;
  }

  const allTabs = await extensionApi.tabs.query({});
  const tabById = (allTabs as any[]).reduce<Record<number, BrowserTab>>((acc: Record<number, BrowserTab>, tab: any) => {
    if (tab.id !== undefined) {
      acc[tab.id] = tab;
    }
    return acc;
  }, {});

  let changed = false;
  const nextEntries = Object.entries(persistentHomeTabs).reduce<Record<string, PersistentHomeTabEntry>>((acc: Record<string, PersistentHomeTabEntry>, [id, entry]) => {
    const currentTab = tabById[entry.tabId];
    if (!currentTab || currentTab.windowId === undefined || currentTab.index === undefined) {
      acc[id] = entry;
      return acc;
    }

    const nextEntry: PersistentHomeTabEntry = {
      ...entry,
      windowId: currentTab.windowId,
      index: currentTab.index,
      groupId: currentTab.groupId !== undefined && currentTab.groupId >= 0
        ? currentTab.groupId
        : undefined,
    };

    if (
      nextEntry.windowId !== entry.windowId
      || nextEntry.index !== entry.index
      || nextEntry.groupId !== entry.groupId
    ) {
      changed = true;
    }

    acc[id] = nextEntry;
    return acc;
  }, {});

  if (changed) {
    await setPersistentHomeTabs(nextEntries);
  }

  return nextEntries;
}

function toPersistentHomeTabItem(entry: PersistentHomeTabEntry): PersistentHomeTabItem {
  return {
    id: entry.id,
    homeUrl: entry.homeUrl,
    windowId: entry.windowId,
    index: entry.index,
    tabId: entry.tabId,
    groupId: entry.groupId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

async function getLastNormalWindowId(): Promise<number | null> {
  if (!extensionApi?.tabs) {
    return null;
  }

  const tabs = await extensionApi.tabs.query({ windowType: "normal" });
  if (tabs.length === 0) {
    return null;
  }

  const latestTab = (tabs as any[]).reduce<any>((latest: any, current: any) => {
    if ((current.lastAccessed ?? 0) >= (latest.lastAccessed ?? 0)) {
      return current;
    }
    return latest;
  }, tabs[0]);

  return latestTab.windowId ?? null;
}

async function getResolvedWindowId(preferredWindowId: number): Promise<number | null> {
  if (!extensionApi?.tabs) {
    return null;
  }

  try {
    const tabsInPreferredWindow = await extensionApi.tabs.query({ windowId: preferredWindowId });
    if (tabsInPreferredWindow.length > 0) {
      return preferredWindowId;
    }
  }
  catch {
    // Window was likely closed.
  }

  return getLastNormalWindowId();
}

async function restorePersistentHomeTab(entry: PersistentHomeTabEntry): Promise<void> {
  if (!extensionApi?.tabs) {
    return;
  }

  const resolvedWindowId = await getResolvedWindowId(entry.windowId);
  if (resolvedWindowId === null) {
    return;
  }

  let createdTab: BrowserTab | null = null;
  try {
    createdTab = await extensionApi.tabs.create({
      url: entry.homeUrl,
      windowId: resolvedWindowId,
      index: entry.index,
      active: false,
    });
  }
  catch {
    createdTab = await extensionApi.tabs.create({
      url: entry.homeUrl,
      windowId: resolvedWindowId,
      active: false,
    });
  }

  if (!createdTab) {
    return;
  }

  const createdTabId = createdTab.id;
  if (createdTabId === undefined) {
    return;
  }

  if (entry.groupId !== undefined) {
    try {
      await extensionApi.tabs.group({ groupId: entry.groupId, tabIds: [createdTabId] });
    }
    catch {
      // Ignore group restore failures and keep tab restored.
    }
  }

  const persistentHomeTabs = await getPersistentHomeTabs();
  const latestEntry = persistentHomeTabs[entry.id];
  if (!latestEntry) {
    return;
  }

  persistentHomeTabs[entry.id] = {
    ...latestEntry,
    tabId: createdTabId,
    windowId: createdTab.windowId ?? resolvedWindowId,
    index: createdTab.index ?? latestEntry.index,
    groupId: createdTab.groupId !== undefined && createdTab.groupId >= 0
      ? createdTab.groupId
      : latestEntry.groupId,
    updatedAt: Date.now(),
  };
  await setPersistentHomeTabs(persistentHomeTabs);
}

export const backgroundHandlers: Record<string, BackgroundMessageHandler> = {
  getState: async (): Promise<HomeTabStateResponse> => {
    const persistentHomeTabs = await getPersistentHomeTabs();
    const items = Object.values(persistentHomeTabs)
      .map(toPersistentHomeTabItem)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    return { items };
  },

  registerCurrent: async (): Promise<RegisterCurrentHomeTabResponse> => {
    const tab = await getCurrentActiveTab();
    const tabId = tab?.id;
    const windowId = tab?.windowId;
    const index = tab?.index;
    const homeUrl = normalizePersistentHomeUrl(tab?.url);

    if (tabId === undefined || windowId === undefined || index === undefined) {
      return { ok: false, reason: "no_active_tab" };
    }

    if (!homeUrl) {
      return { ok: false, reason: "unsupported_url" };
    }

    let persistentHomeTabs = await getPersistentHomeTabs();
    persistentHomeTabs = await resyncPersistentHomeTabIndexes(persistentHomeTabs);
    const duplicatedEntry = Object.values(persistentHomeTabs).find(entry => entry.tabId === tabId);
    if (duplicatedEntry) {
      return {
        ok: false,
        reason: "already_registered",
        item: toPersistentHomeTabItem(duplicatedEntry),
      };
    }

    const id = createPersistentHomeTabId();
    const now = Date.now();
    const initialGroupId = tab?.groupId;
    const entry: PersistentHomeTabEntry = {
      id,
      homeUrl,
      windowId,
      index,
      tabId,
      groupId: initialGroupId !== undefined && initialGroupId >= 0 ? initialGroupId : undefined,
      createdAt: now,
      updatedAt: now,
    };

    persistentHomeTabs[id] = entry;
    const hasEarlierOrSameIndexInWindow = Object.values(persistentHomeTabs).some(currentEntry =>
      currentEntry.id !== id
      && currentEntry.windowId === entry.windowId
      && currentEntry.index >= entry.index,
    );

    await setPersistentHomeTabs(persistentHomeTabs);
    let responseEntry = persistentHomeTabs[id];

    if (hasEarlierOrSameIndexInWindow) {
      const syncedEntries = await resyncPersistentHomeTabIndexes(persistentHomeTabs);
      responseEntry = syncedEntries[id] ?? responseEntry;
    }

    return {
      ok: true,
      item: toPersistentHomeTabItem(responseEntry),
    };
  },

  unregister: async (_payload: unknown): Promise<UnregisterHomeTabResponse> => {
    const payload = _payload as { id: string } | undefined;
    if (!payload?.id) {
      return { ok: false, reason: "not_found" };
    }

    const persistentHomeTabs = await getPersistentHomeTabs();

    if (!persistentHomeTabs[payload.id]) {
      return { ok: false, reason: "not_found" };
    }

    delete persistentHomeTabs[payload.id];
    await setPersistentHomeTabs(persistentHomeTabs);

    return { ok: true };
  },

  handleTabRemoved: async (_payload: unknown, _sender: unknown) => {
    const tabId = typeof _payload === "number" ? _payload : undefined;
    if (!tabId) {
      return;
    }

    const persistentHomeTabs = await getPersistentHomeTabs();
    const targetEntry = Object.values(persistentHomeTabs).find(entry => entry.tabId === tabId);

    if (!targetEntry) {
      return;
    }

    await restorePersistentHomeTab(targetEntry);
  },
};

export const tabRemovedHandlers: TabRemovedHandler[] = [
  {
    handler: async (tabId: number) => {
      await backgroundHandlers.handleTabRemoved(tabId, {}, () => {});
    },
  },
];
