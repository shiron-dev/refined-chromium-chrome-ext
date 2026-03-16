import type { ContentMessageHandler } from "../../core/types";

let dirty = false;

export function contentInit(): void {
  document.addEventListener("input", () => {
    dirty = true;
  });
}

export const contentHandlers: Record<string, ContentMessageHandler> = {
  isHealthy: (_payload, _sender, sendResponse) => {
    sendResponse({ healthy: !dirty });
    return false;
  },
};
