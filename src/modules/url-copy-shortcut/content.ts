import type { ContentMessageHandler } from "../../core/types";

const COPY_TOAST_ID = "refined-chromium-copy-toast";
const COPY_TOAST_DURATION_MS = 1600;

function fallbackCopyTextToClipboard(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  }
  catch {
    return false;
  }
  finally {
    textarea.remove();
    activeElement?.focus();
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    }
    catch {
      // Fall back to execCommand to handle pages where Clipboard API is blocked.
    }
  }

  return fallbackCopyTextToClipboard(text);
}

function showCopyToast(message: string, tone: "success" | "warn"): void {
  const existing = document.getElementById(COPY_TOAST_ID);
  existing?.remove();

  const toast = document.createElement("div");
  toast.id = COPY_TOAST_ID;
  toast.textContent = message;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.style.position = "fixed";
  toast.style.top = "20px";
  toast.style.right = "20px";
  toast.style.zIndex = "2147483647";
  toast.style.padding = "10px 14px";
  toast.style.borderRadius = "10px";
  toast.style.fontSize = "13px";
  toast.style.fontWeight = "600";
  toast.style.lineHeight = "1.4";
  toast.style.boxShadow = "0 12px 30px rgba(15, 23, 42, 0.18)";
  toast.style.color = "#ffffff";
  toast.style.background = tone === "success" ? "#111827" : "#b45309";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(-6px)";
  toast.style.transition = "opacity 160ms ease, transform 160ms ease";

  document.body.append(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    window.setTimeout(() => toast.remove(), 180);
  }, COPY_TOAST_DURATION_MS);
}

export const contentHandlers: Record<string, ContentMessageHandler> = {
  copy: (_payload: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
    const payload = _payload as { url: string } | undefined;
    if (!payload?.url) {
      sendResponse({ ok: false, reason: "no_url" });
      return true;
    }

    copyTextToClipboard(payload.url)
      .then((ok) => {
        showCopyToast(ok ? "URLをコピーしました" : "URLのコピーに失敗しました", ok ? "success" : "warn");
        sendResponse({
          ok,
          reason: ok ? undefined : "copy_failed",
        });
      })
      .catch(() => {
        showCopyToast("URLのコピーに失敗しました", "warn");
        sendResponse({ ok: false, reason: "copy_failed" });
      });

    return true;
  },
};
