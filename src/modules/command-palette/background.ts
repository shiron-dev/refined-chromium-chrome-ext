import type { BackgroundMessageHandler, CommandHandler } from "../../core/types";

interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl?: string
  windowId: number
}

interface SwitchTabPayload {
  tabId: number
  windowId: number
}

export const backgroundHandlers: Record<string, BackgroundMessageHandler> = {
  getTabs: async (_payload, _sender, sendResponse) => {
    const tabs = await chrome.tabs.query({});
    const tabInfos: TabInfo[] = tabs
      .filter(tab => tab.id != null)
      .map(tab => ({
        id: tab.id as number,
        title: tab.title ?? "",
        url: tab.url ?? "",
        favIconUrl: tab.favIconUrl,
        windowId: tab.windowId,
      }));
    sendResponse(tabInfos);
    return true;
  },

  switchTab: async (payload, _sender, sendResponse) => {
    const { tabId, windowId } = payload as SwitchTabPayload;
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(windowId, { focused: true });
    sendResponse({ ok: true });
    return true;
  },
};

export const commandHandlers: CommandHandler[] = [
  {
    command: "open-command-palette",
    handler: async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id == null)
        return;
      await chrome.tabs.sendMessage(tab.id, {
        moduleId: "commandPalette",
        action: "open",
      });
    },
  },
];
