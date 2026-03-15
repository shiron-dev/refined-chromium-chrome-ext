interface ClipboardCopyMessage {
  type: "url-copy-shortcut/copy"
  text?: string
}

console.log("[Offscreen] Script loaded, registering message listener");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const payload = message as ClipboardCopyMessage;

  if (payload?.type !== "url-copy-shortcut/copy" || !payload.text) {
    console.log("[Offscreen] Message not handled:", { type: payload?.type, hasText: !!payload?.text });
    return false;
  }

  console.log("[Offscreen] Handling copy request for URL");

  navigator.clipboard.writeText(payload.text)
    .then(() => {
      console.log("[Offscreen] Successfully copied to clipboard");
      sendResponse({ ok: true });
    })
    .catch((error) => {
      console.error("[Offscreen] Failed to copy to clipboard:", error);
      sendResponse({ ok: false, reason: "copy_failed" });
    });

  return true;
});

console.log("[Offscreen] Message listener registered");
