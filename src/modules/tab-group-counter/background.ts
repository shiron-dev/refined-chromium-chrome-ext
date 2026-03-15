import type { BackgroundMessageHandler } from "../../core/types";
import type { TabGroupCounterSettings, TabGroupCounterState } from "./popup/types";
import { createModuleStorage } from "../../core/storage";
import { extensionApi } from "../../utils/extension-api";

export const DEFAULT_FORMAT = "{name} ({count})";

const storage = createModuleStorage("tabGroupCounter");

export const backgroundHandlers: Record<string, BackgroundMessageHandler> = {
  getGroups: async (): Promise<TabGroupCounterState> => {
    if (!extensionApi?.tabGroups || !extensionApi?.tabs) {
      return { groups: [] };
    }

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

    const groups = (allGroups as Array<{ id: number; title?: string; color: string; windowId: number }>).map(
      group => ({
        id: group.id,
        title: group.title ?? "",
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
    return { ok: true };
  },
};
