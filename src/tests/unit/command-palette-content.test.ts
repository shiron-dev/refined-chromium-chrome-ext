import { beforeEach, describe, expect, it, vi } from "vitest";

// CommandPalette コンポーネントのレンダリングはここでは不要なのでモック
vi.mock("../../modules/command-palette/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.stubGlobal("chrome", {
  runtime: { sendMessage: vi.fn() },
});

// モジュールレベルの状態をテスト間でリセットするため、各テストで再インポートする
beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = "";
});

async function loadContent() {
  const mod = await import("../../modules/command-palette/content");
  return mod.contentHandlers;
}

const sender = {} as chrome.runtime.MessageSender;

describe("contentHandlers.open - DOM", () => {
  it("初回openでshadow hostをbodyに追加する", async () => {
    const handlers = await loadContent();
    handlers.open(undefined, sender, vi.fn());

    const host = document.getElementById("refined-chromium-command-palette");
    expect(host).not.toBeNull();
    expect(host?.tagName).toBe("DIV");
  });

  it("shadow hostにshadow rootが付いている", async () => {
    const handlers = await loadContent();
    handlers.open(undefined, sender, vi.fn());

    const host = document.getElementById("refined-chromium-command-palette")!;
    expect(host.shadowRoot).not.toBeNull();
  });

  it("sendResponse に { ok: true } を返す", async () => {
    const handlers = await loadContent();
    const sendResponse = vi.fn();

    handlers.open(undefined, sender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("open済みの状態で再度openを呼ぶとshadow hostはそのまま残る (closeされる)", async () => {
    const handlers = await loadContent();
    handlers.open(undefined, sender, vi.fn()); // open
    handlers.open(undefined, sender, vi.fn()); // close (toggle)

    // shadow host 自体は DOM に残る (unmount するだけ)
    const host = document.getElementById("refined-chromium-command-palette");
    expect(host).not.toBeNull();
  });
});

describe("contentHandlers.open - キーイベントブロック", () => {
  it("shadow host からの keydown が document に伝播しない", async () => {
    const handlers = await loadContent();
    handlers.open(undefined, sender, vi.fn());

    const host = document.getElementById("refined-chromium-command-palette")!;
    const docHandler = vi.fn();
    document.addEventListener("keydown", docHandler);

    host.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));

    expect(docHandler).not.toHaveBeenCalled();
    document.removeEventListener("keydown", docHandler);
  });

  it("shadow host からの keyup が document に伝播しない", async () => {
    const handlers = await loadContent();
    handlers.open(undefined, sender, vi.fn());

    const host = document.getElementById("refined-chromium-command-palette")!;
    const docHandler = vi.fn();
    document.addEventListener("keyup", docHandler);

    host.dispatchEvent(new KeyboardEvent("keyup", { key: "k", bubbles: true }));

    expect(docHandler).not.toHaveBeenCalled();
    document.removeEventListener("keyup", docHandler);
  });

  it("shadow host からの keypress が document に伝播しない", async () => {
    const handlers = await loadContent();
    handlers.open(undefined, sender, vi.fn());

    const host = document.getElementById("refined-chromium-command-palette")!;
    const docHandler = vi.fn();
    document.addEventListener("keypress", docHandler);

    host.dispatchEvent(new KeyboardEvent("keypress", { key: "g", bubbles: true }));

    expect(docHandler).not.toHaveBeenCalled();
    document.removeEventListener("keypress", docHandler);
  });

  it("shadow host と無関係な要素の keydown は document に届く", async () => {
    const handlers = await loadContent();
    handlers.open(undefined, sender, vi.fn());

    const other = document.createElement("div");
    document.body.appendChild(other);
    const docHandler = vi.fn();
    document.addEventListener("keydown", docHandler);

    other.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));

    expect(docHandler).toHaveBeenCalledTimes(1);
    document.removeEventListener("keydown", docHandler);
  });
});
