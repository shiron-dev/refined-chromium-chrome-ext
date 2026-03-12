export {};

interface ToggleMessage {
  type: "TEMPLATE_TOGGLE_HIGHLIGHT"
}

const toggleHighlightMessage: ToggleMessage = {
  type: "TEMPLATE_TOGGLE_HIGHLIGHT",
};

const extensionApi = (globalThis as any).chrome;

extensionApi?.runtime?.onInstalled?.addListener((details: { reason?: string }) => {
  if (details.reason === "install") {
    console.warn("Template extension installed.");
  }
});

extensionApi?.action?.onClicked?.addListener(async (tab: { id?: number }) => {
  if (!tab.id) {
    return;
  }

  try {
    await extensionApi.tabs.sendMessage(tab.id, toggleHighlightMessage);
  }
  catch (error) {
    console.error("Failed to send message to content script:", error);
  }
});
