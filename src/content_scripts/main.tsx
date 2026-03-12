export {};

interface ToggleMessage {
  type: "TEMPLATE_TOGGLE_HIGHLIGHT"
}

const extensionApi = (globalThis as any).chrome;
const BANNER_ID = "template-extension-banner";
let isHighlighted = false;

function upsertBanner(text: string): void {
  const existing = document.getElementById(BANNER_ID);

  if (existing) {
    existing.textContent = text;
    return;
  }

  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.textContent = text;
  banner.style.position = "fixed";
  banner.style.bottom = "16px";
  banner.style.right = "16px";
  banner.style.padding = "10px 14px";
  banner.style.borderRadius = "8px";
  banner.style.background = "#111827";
  banner.style.color = "#fff";
  banner.style.fontSize = "12px";
  banner.style.zIndex = "2147483647";
  banner.style.boxShadow = "0 6px 18px rgba(0,0,0,0.25)";
  document.body.append(banner);
}

function applyHighlight(): void {
  const root = document.documentElement;
  if (!root) {
    return;
  }

  isHighlighted = !isHighlighted;
  root.style.outline = isHighlighted ? "3px solid #f97316" : "";

  upsertBanner(
    isHighlighted
      ? "Template: page highlight ON (click extension icon to toggle)"
      : "Template: page highlight OFF",
  );
}

function init(): void {
  upsertBanner("Template content script loaded");

  extensionApi?.runtime?.onMessage?.addListener((message: ToggleMessage) => {
    if (message.type === "TEMPLATE_TOGGLE_HIGHLIGHT") {
      applyHighlight();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
}
else {
  init();
}
