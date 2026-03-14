import type { ModuleManifest, ModuleMessage } from "../src/core/types";

import { registry } from "../src/core/registry";

// Auto-collect all module manifests
const moduleFiles = import.meta.glob<{ default: ModuleManifest }>(
  "../src/modules/*/index.ts",
  { eager: true },
);

for (const mod of Object.values(moduleFiles)) {
  registry.register(mod.default);
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_end",
  main() {
    chrome.runtime.onMessage?.addListener((message, _sender, sendResponse) => {
      const msg = message as Partial<ModuleMessage>;
      if (!msg.moduleId || !msg.action) {
        return false;
      }

      for (const manifest of registry.getAll()) {
        if (manifest.id !== msg.moduleId) {
          continue;
        }
        const handler = manifest.contentHandlers?.[msg.action];
        if (handler) {
          try {
            return handler(msg.payload, _sender, sendResponse) ?? false;
          }
          catch (error: unknown) {
            console.error("Failed to handle content message:", error);
            return false;
          }
        }
      }
      return false;
    });
  },
});
