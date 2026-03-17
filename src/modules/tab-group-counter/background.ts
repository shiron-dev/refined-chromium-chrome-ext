import type { BackgroundMessageHandler } from "../../core/types";
import type { TabGroupCounterSettings, TabGroupCounterState } from "./popup/types";
import { getModuleSettings } from "../../core/settings";
import { createModuleStorage } from "../../core/storage";
import { extensionApi } from "../../utils/extension-api";

export const DEFAULT_FORMAT = "{name} ({count})";

const storage = createModuleStorage("tabGroupCounter");

const NAME_REGEX = /\{name\}/g;
const COUNT_REGEX = /\{count\}/g;
const FORMAT_TOKEN_REGEX = /(\{name\}|\{count\})/;
const REGEX_ESCAPE_REGEX = /[.+?^${}()|[\]\\]/g;

// Groups currently being updated by us (to ignore our own onUpdated events)
const applyingGroups = new Set<number>();

// Debounce timer for tab-count refresh
let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

function applyFormat(format: string, name: string, count: number): string {
  return format.replace(NAME_REGEX, name).replace(COUNT_REGEX, String(count));
}

/**
 * Try to reverse a formatted title back to the original name using the format string.
 * e.g. format="{name} ({count})", title="Work (5)" → "Work"
 */
function extractOriginalName(title: string, format: string): string | null {
  const parts = format.split(FORMAT_TOKEN_REGEX);
  let nameGroupIndex = 0;
  let groupIdx = 1;
  let regexStr = "^";

  for (const part of parts) {
    if (part === "{name}") {
      nameGroupIndex = groupIdx++;
      regexStr += "(.+)";
    }
    else if (part === "{count}") {
      groupIdx++;
      regexStr += "(\\d+)";
    }
    else if (part) {
      regexStr += part.replace(REGEX_ESCAPE_REGEX, "\\$&");
    }
  }
  regexStr += "$";

  if (nameGroupIndex === 0)
    return null;

  try {
    const match = new RegExp(regexStr).exec(title);
    return match?.[nameGroupIndex] ?? null;
  }
  catch {
    return null;
  }
}

async function getStoredOriginalTitles(): Promise<Record<string, string>> {
  return (await storage.get<Record<string, string>>("originalTitles")) ?? {};
}

async function isModuleEnabled(): Promise<boolean> {
  const settings = await getModuleSettings();
  return settings.tabGroupCounter?.enabled ?? true;
}

async function applyFormatToAll(): Promise<void> {
  if (!extensionApi?.tabGroups || !extensionApi?.tabs)
    return;

  const format = (await storage.get<string>("format")) ?? DEFAULT_FORMAT;
  const groupQueryResult = await extensionApi.tabGroups.query({});
  const tabsQueryResult = await extensionApi.tabs.query({});
  const allGroups = (Array.isArray(groupQueryResult) ? groupQueryResult : []) as Array<{ id: number, title?: string }>;
  const allTabs = (Array.isArray(tabsQueryResult) ? tabsQueryResult : []) as Array<{ id?: number, groupId?: number, url?: string, title?: string }>;

  const tabsByGroup = allTabs.reduce<Record<number, Array<{ id?: number, url?: string, title?: string }>>>((acc, tab) => {
    if (tab.groupId !== undefined && tab.groupId >= 0) {
      acc[tab.groupId] ??= [];
      acc[tab.groupId].push({ id: tab.id, url: tab.url, title: tab.title });
    }
    return acc;
  }, {});

  const tabCountByGroup = Object.fromEntries(
    Object.entries(tabsByGroup).map(([gid, tabs]) => [gid, tabs.length]),
  );

  const storedOriginals = await getStoredOriginalTitles();
  const updatedOriginals: Record<string, string> = { ...storedOriginals };

  for (const group of allGroups) {
    const currentTitle = group.title ?? "";
    const key = String(group.id);

    let originalTitle: string;
    if (updatedOriginals[key] !== undefined) {
      // Use stored original title
      originalTitle = updatedOriginals[key];
    }
    else {
      // Try to reverse-extract from current title (e.g. on browser restart)
      const extracted = extractOriginalName(currentTitle, format);
      originalTitle = extracted ?? currentTitle;
      updatedOriginals[key] = originalTitle;
    }

    const tabCount = tabCountByGroup[String(group.id)] ?? 0;
    const newTitle = applyFormat(format, originalTitle, tabCount);

    if (newTitle !== currentTitle) {
      applyingGroups.add(group.id);
      try {
        await extensionApi.tabGroups.update(group.id, { title: newTitle });
      }
      catch (e) {
        console.warn("[tab-group-counter] applyFormatToAll: group %d update FAILED, will retry", group.id, e);
        scheduleRefresh();
      }
      finally {
        applyingGroups.delete(group.id);
      }
    }
  }

  await storage.set("originalTitles", updatedOriginals);
}

async function revertAllGroups(): Promise<void> {
  if (!extensionApi?.tabGroups)
    return;

  const storedOriginals = await getStoredOriginalTitles();
  const allGroups = (await extensionApi.tabGroups.query({})) as Array<{ id: number, title?: string }>;

  for (const group of allGroups) {
    const key = String(group.id);
    const originalTitle = storedOriginals[key];
    if (originalTitle !== undefined && originalTitle !== group.title) {
      applyingGroups.add(group.id);
      try {
        await extensionApi.tabGroups.update(group.id, { title: originalTitle });
      }
      catch {
        // ignore
      }
      finally {
        applyingGroups.delete(group.id);
      }
    }
  }

  await storage.set("originalTitles", {});
}

function scheduleRefresh(): void {
  if (refreshTimeout !== null)
    clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(() => {
    refreshTimeout = null;
    isModuleEnabled()
      .then((enabled) => {
        if (!enabled) {
          return;
        }
        return applyFormatToAll();
      })
      .catch((e: unknown) => console.error("Tab group counter refresh error:", e));
  }, 150);
}

// ─── Event listeners ─────────────────────────────────────────────────────────

// Detect user renames and re-apply format preserving the user's intended name
if (extensionApi?.tabGroups?.onUpdated) {
  extensionApi.tabGroups.onUpdated.addListener(
    async (group: { id: number, title?: string }) => {
      if (applyingGroups.has(group.id))
        return; // Our own update — ignore

      const enabled = await isModuleEnabled();
      if (!enabled)
        return;

      const format = (await storage.get<string>("format")) ?? DEFAULT_FORMAT;
      const newTitle = group.title ?? "";

      // Try to extract base name from user's new title in case they kept part of the format
      const extracted = extractOriginalName(newTitle, format);
      const newOriginalName = extracted ?? newTitle;

      // Persist the new original name
      const storedOriginals = await getStoredOriginalTitles();
      storedOriginals[String(group.id)] = newOriginalName;
      await storage.set("originalTitles", storedOriginals);

      const tabsQueryResult = extensionApi?.tabs ? await extensionApi.tabs.query({}) : [];
      const allTabs = (Array.isArray(tabsQueryResult) ? tabsQueryResult : []) as Array<{ groupId?: number }>;
      const tabCount = allTabs.reduce((count, tab) => count + (tab.groupId === group.id ? 1 : 0), 0);
      const formattedTitle = applyFormat(format, newOriginalName, tabCount);

      if (formattedTitle === newTitle)
        return;

      applyingGroups.add(group.id);
      try {
        await extensionApi.tabGroups.update(group.id, { title: formattedTitle });
      }
      catch (e) {
        console.warn("[tab-group-counter] tabGroups.onUpdated: group %d update FAILED, will retry", group.id, e);
        scheduleRefresh();
      }
      finally {
        applyingGroups.delete(group.id);
      }
    },
  );
}

// Clean up stored originals when a group is removed
if (extensionApi?.tabGroups?.onRemoved) {
  extensionApi.tabGroups.onRemoved.addListener(async (groupId: number) => {
    const storedOriginals = await getStoredOriginalTitles();
    const key = String(groupId);
    if (key in storedOriginals) {
      delete storedOriginals[key];
      await storage.set("originalTitles", storedOriginals);
    }
  });
}

// Trigger refresh when a new group is created
if (extensionApi?.tabGroups?.onCreated) {
  extensionApi.tabGroups.onCreated.addListener((_group: { id: number, title?: string }) => {
    scheduleRefresh();
  });
}

// Re-apply format when tab counts change
if (extensionApi?.tabs?.onCreated) {
  extensionApi.tabs.onCreated.addListener((tab: { id?: number, groupId?: number }) => {
    if (tab.groupId !== undefined && tab.groupId >= 0) {
      scheduleRefresh();
    }
  });
}

if (extensionApi?.tabs?.onRemoved) {
  extensionApi.tabs.onRemoved.addListener((tabId: number, removeInfo: { isWindowClosing: boolean }) => {
    if (!removeInfo.isWindowClosing) {
      scheduleRefresh();
    }
  });
}

if (extensionApi?.tabs?.onUpdated) {
  extensionApi.tabs.onUpdated.addListener(
    (tabId: number, changeInfo: Record<string, unknown>) => {
      if ("groupId" in changeInfo) {
        scheduleRefresh();
      }
    },
  );
}

// Detect module enable/disable from any UI (home screen toggle, detail screen toggle, etc.)
if (extensionApi?.storage?.onChanged) {
  extensionApi.storage.onChanged.addListener(
    (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== "local")
        return;
      const change = changes["modules.tabGroupCounter.enabled"];
      if (change === undefined)
        return;

      if (change.newValue === true) {
        applyFormatToAll().catch((e: unknown) => console.error("Tab group counter enable error:", e));
      }
      else if (change.newValue === false) {
        revertAllGroups().catch((e: unknown) => console.error("Tab group counter disable error:", e));
      }
    },
  );
}

// ─── Background message handlers ─────────────────────────────────────────────

export const backgroundHandlers: Record<string, BackgroundMessageHandler> = {
  getGroups: async (): Promise<TabGroupCounterState> => {
    if (!extensionApi?.tabGroups || !extensionApi?.tabs) {
      return { groups: [] };
    }

    const format = (await storage.get<string>("format")) ?? DEFAULT_FORMAT;
    const allGroups = await extensionApi.tabGroups.query({});
    const allTabs = await extensionApi.tabs.query({});

    const tabCountByGroup = (allTabs as Array<{ groupId?: number }>).reduce<Record<number, number>>(
      (acc, tab) => {
        if (tab.groupId !== undefined && tab.groupId >= 0) {
          acc[tab.groupId] = (acc[tab.groupId] ?? 0) + 1;
        }
        return acc;
      },
      {},
    );

    const storedOriginals = await getStoredOriginalTitles();

    const groups = (allGroups as Array<{ id: number, title?: string, color: string, windowId: number }>).map(
      group => ({
        id: group.id,
        // Return the original title so the popup can apply format for preview
        title: storedOriginals[String(group.id)]
          ?? extractOriginalName(group.title ?? "", format)
          ?? group.title
          ?? "",
        color: group.color,
        tabCount: tabCountByGroup[group.id] ?? 0,
        windowId: group.windowId,
      }),
    );

    return { groups };
  },

  getSettings: async (): Promise<TabGroupCounterSettings> => {
    const format = await storage.get<string>("format");
    return { format: format ?? DEFAULT_FORMAT };
  },

  saveSettings: async (payload: unknown): Promise<{ ok: boolean }> => {
    const data = payload as Partial<TabGroupCounterSettings> | undefined;
    if (!data || typeof data.format !== "string") {
      return { ok: false };
    }

    await storage.set("format", data.format);

    const enabled = await isModuleEnabled();
    if (enabled) {
      await applyFormatToAll();
    }

    return { ok: true };
  },
};

// Apply format on service worker startup if the module is enabled
(async () => {
  const enabled = await isModuleEnabled();
  if (enabled) {
    await applyFormatToAll();
  }
})().catch((e: unknown) => console.error("Tab group counter init error:", e));
