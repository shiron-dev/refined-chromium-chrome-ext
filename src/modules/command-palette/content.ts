import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ContentMessageHandler } from "../../core/types";
import { CommandPalette } from "./CommandPalette";

let shadowHost: HTMLDivElement | null = null;
let root: Root | null = null;
let isOpen = false;

function mount() {
  shadowHost = document.createElement("div");
  shadowHost.id = "refined-chromium-command-palette";
  shadowHost.style.cssText = "all: initial; position: fixed; z-index: 2147483647;";
  // Shadow DOM 内から上がってくるキーイベントをここで止め、
  // サイト側の document/window レベルのハンドラに届かないようにする
  shadowHost.addEventListener("keydown", (e) => e.stopPropagation());
  shadowHost.addEventListener("keyup", (e) => e.stopPropagation());
  shadowHost.addEventListener("keypress", (e) => e.stopPropagation());
  document.body.appendChild(shadowHost);

  const shadowRoot = shadowHost.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  shadowRoot.appendChild(container);
  root = createRoot(container);
}

function open() {
  if (isOpen) return;
  isOpen = true;
  if (!shadowHost) mount();
  root?.render(createElement(CommandPalette, { onClose: close }));
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  root?.render(null);
}

export const contentHandlers: Record<string, ContentMessageHandler> = {
  open: (_payload, _sender, sendResponse) => {
    if (isOpen) {
      close();
    } else {
      open();
    }
    sendResponse({ ok: true });
    return false;
  },
};
