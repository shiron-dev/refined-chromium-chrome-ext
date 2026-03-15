import type { TabActivatedHandler, TabRemovedHandler } from "../../core/types";
import { getModuleSettings } from "../../core/settings";
import { extensionApi } from "../../utils/extension-api";

const MODULE_ID = "autoPipOnLeave";

// In-memory: windowId -> previously active tabId (resets when service worker restarts)
const previousActiveTabByWindow = new Map<number, number>();

// Tabs that had PiP activated by this module
const pipActivatedTabs = new Set<number>();

export const tabActivatedHandlers: TabActivatedHandler[] = [
  {
    handler: async ({ tabId, windowId }) => {
      const prevTabId = previousActiveTabByWindow.get(windowId);
      previousActiveTabByWindow.set(windowId, tabId);

      if (prevTabId === undefined || prevTabId === tabId) {
        return;
      }

      const settings = await getModuleSettings();
      const enabled = settings[MODULE_ID]?.enabled ?? true;
      if (!enabled) {
        return;
      }

      if (!extensionApi?.scripting) {
        return;
      }

      // Returning to a tab that had PiP activated — exit PiP and stop here
      if (pipActivatedTabs.has(tabId)) {
        pipActivatedTabs.delete(tabId);
        try {
          await extensionApi.scripting.executeScript({
            target: { tabId },
            func: () => {
              if (document.pictureInPictureElement) {
                document.exitPictureInPicture().catch(() => {});
              }
            },
          });
        }
        catch {
          // Tab may be closed, or scripting is blocked
        }
        return;
      }

      // Leaving prevTab — start PiP if a video is playing
      try {
        const results = await extensionApi.scripting.executeScript({
          target: { tabId: prevTabId },
          func: () => {
            if (!document.pictureInPictureEnabled) {
              return false;
            }

            if (document.pictureInPictureElement) {
              return false;
            }

            const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video"));
            const playing = videos.find(v => !v.paused && !v.ended && v.readyState > 2);
            if (!playing) {
              return false;
            }

            playing.requestPictureInPicture().catch(() => {});
            return true;
          },
        });

        if (results[0]?.result === true) {
          pipActivatedTabs.add(prevTabId);
        }
      }
      catch {
        // Tab may be closed, or scripting is blocked (e.g. chrome:// pages)
      }
    },
  },
];

export const tabRemovedHandlers: TabRemovedHandler[] = [
  {
    handler: (tabId: number) => {
      pipActivatedTabs.delete(tabId);
    },
  },
];
