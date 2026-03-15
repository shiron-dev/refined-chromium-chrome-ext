import type { BackgroundMessageHandler, CommandHandler } from "../../core/types";

interface BrowserTab {
  id?: number
  url?: string
  windowId?: number
}

const extensionApi = (globalThis as unknown as { chrome?: any }).chrome;

async function getCurrentActiveTab(): Promise<BrowserTab | null> {
  if (!extensionApi?.tabs) {
    return null;
  }

  const tabs = await extensionApi.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

export const backgroundHandlers: Record<string, BackgroundMessageHandler> = {
  copy: async () => {
    if (!extensionApi?.tabs || !extensionApi?.scripting) {
      return { ok: false, reason: "no_active_tab" };
    }

    const tab = await getCurrentActiveTab();
    if (!tab?.url || tab.id === undefined) {
      return { ok: false, reason: "no_active_tab" };
    }

    try {
      const results = await extensionApi.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (url: string) => {
          const toastId = "refined-chromium-copy-toast";

          const fallbackCopyTextToClipboard = (value: string): boolean => {
            const textarea = document.createElement("textarea");
            textarea.value = value;
            textarea.setAttribute("readonly", "true");
            textarea.style.position = "fixed";
            textarea.style.top = "0";
            textarea.style.left = "0";
            textarea.style.opacity = "0";

            const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

            document.body.append(textarea);
            textarea.focus();
            textarea.select();
            textarea.setSelectionRange(0, value.length);

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
          };

          const showToast = (message: string, tone: "success" | "warn"): void => {
            const existing = document.getElementById(toastId);
            existing?.remove();

            const toast = document.createElement("div");
            toast.id = toastId;
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
            toast.style.color = "#ffffff";
            toast.style.background = tone === "success" ? "#111827" : "#b45309";
            toast.style.boxShadow = "0 12px 30px rgba(15, 23, 42, 0.18)";
            toast.style.opacity = "0";
            toast.style.transform = "translateY(-6px)";
            toast.style.transition = "opacity 160ms ease, transform 160ms ease";

            (document.body ?? document.documentElement).append(toast);

            requestAnimationFrame(() => {
              toast.style.opacity = "1";
              toast.style.transform = "translateY(0)";
            });

            window.setTimeout(() => {
              toast.style.opacity = "0";
              toast.style.transform = "translateY(-6px)";
              window.setTimeout(() => toast.remove(), 180);
            }, 1600);
          };

          let ok = false;

          if (navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(url);
              ok = true;
            }
            catch {
              ok = fallbackCopyTextToClipboard(url);
            }
          }
          else {
            ok = fallbackCopyTextToClipboard(url);
          }

          showToast(ok ? "URLをコピーしました" : "URLのコピーに失敗しました", ok ? "success" : "warn");
          return ok;
        },
        args: [tab.url],
      });

      return { ok: Boolean(results[0]?.result), reason: results[0]?.result ? undefined : "copy_failed" };
    }
    catch (error: unknown) {
      console.warn("Failed to copy current URL from shortcut:", error);
      return { ok: false, reason: "unsupported_tab" };
    }
  },
};

export const commandHandlers: CommandHandler[] = [
  {
    command: "copy-current-url",
    handler: async () => {
      await backgroundHandlers.copy({}, {}, () => {});
    },
  },
];
