interface ClipboardCopyMessage {
  type: "url-copy-shortcut/copy"
  text?: string
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const payload = message as ClipboardCopyMessage;
  if (payload?.type !== "url-copy-shortcut/copy" || !payload.text) {
    return false;
  }

  navigator.clipboard.writeText(payload.text)
    .then(() => {
      sendResponse({ ok: true });
    })
    .catch(() => {
      sendResponse({ ok: false, reason: "copy_failed" });
    });

  return true;
});
