import type { ModuleManifest } from "../src/core/types";

import { createMessageRouter } from "../src/core/messaging";
import { registry } from "../src/core/registry";
import { getModuleSettings, migrateStorageIfNeeded } from "../src/core/settings";

// Auto-collect all module manifests
const moduleFiles = import.meta.glob<{ default: ModuleManifest }>(
  "../src/modules/*/index.ts",
  { eager: true },
);

for (const mod of Object.values(moduleFiles)) {
  registry.register(mod.default);
}

const routeMessage = createMessageRouter(registry.getAll());

export default defineBackground(() => {
  chrome.runtime.onInstalled?.addListener(async (details) => {
    if (details.reason === "install") {
      console.warn("GitHub PR Tab Group Manager installed");
    }
    await migrateStorageIfNeeded();
  });

  chrome.runtime.onMessage?.addListener((message, sender, sendResponse) => {
    return routeMessage(message, sender, sendResponse);
  });

  chrome.commands.onCommand?.addListener(async (command) => {
    const settings = await getModuleSettings();

    for (const manifest of registry.getAll()) {
      for (const { command: cmd, handler } of manifest.commandHandlers ?? []) {
        if (cmd === command) {
          if (settings[manifest.id]?.enabled) {
            try {
              await handler();
            }
            catch (error: unknown) {
              console.error(`Failed to execute command ${command}:`, error);
            }
          }
        }
      }
    }
  });

  chrome.webNavigation.onCompleted?.addListener(async (details) => {
    if (details.frameId !== 0 || details.tabId < 0) {
      return;
    }

    for (const manifest of registry.getAll()) {
      for (const { handler } of manifest.navigationHandlers ?? []) {
        try {
          await handler(details);
        }
        catch (error: unknown) {
          console.error("Failed to handle navigation:", error);
        }
      }
    }
  });

  chrome.tabs.onRemoved?.addListener((tabId: number, removeInfo) => {
    for (const manifest of registry.getAll()) {
      for (const { handler } of manifest.tabRemovedHandlers ?? []) {
        const result = handler(tabId, removeInfo);
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            console.error("Failed to handle tab removed:", error);
          });
        }
      }
    }
  });
});
