import type { BackgroundMessageHandler, ModuleManifest, ModuleMessage } from "./types";

export function createMessageRouter(
  manifests: ReadonlyArray<ModuleManifest>,
): (
  raw: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean {
  // Build handler map: "moduleId/action" -> handler
  const handlerMap = new Map<string, BackgroundMessageHandler>();

  for (const manifest of manifests) {
    for (const [action, handler] of Object.entries(
      manifest.backgroundHandlers ?? {},
    )) {
      const key = `${manifest.id}/${action}`;
      handlerMap.set(key, handler);
    }
  }

  return function routeMessage(
    raw: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean {
    const message = raw as Partial<ModuleMessage>;
    if (!message.moduleId || !message.action) {
      return false;
    }

    const key = `${message.moduleId}/${message.action}`;
    const handler = handlerMap.get(key);
    if (!handler) {
      return false;
    }

    const result = handler(message.payload, sender, sendResponse);
    if (result instanceof Promise) {
      result
        .then((response) => {
          sendResponse(response);
        })
        .catch((error) => {
          console.error(`Failed to handle message for ${key}:`, error);
        });
      return true;
    }
    return result ?? false;
  };
}
