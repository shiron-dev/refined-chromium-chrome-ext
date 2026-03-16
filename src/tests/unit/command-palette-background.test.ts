import { beforeEach, describe, expect, it, vi } from "vitest";
import { backgroundHandlers, commandHandlers } from "../../modules/command-palette/background";

const chromeMock = {
  tabs: {
    query: vi.fn(),
    update: vi.fn(),
    sendMessage: vi.fn(),
  },
  windows: {
    update: vi.fn(),
  },
};
vi.stubGlobal("chrome", chromeMock);

const sender = {} as chrome.runtime.MessageSender;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("backgroundHandlers.getTabs", () => {
  it("全タブをTabInfo形式で返す", async () => {
    chromeMock.tabs.query.mockResolvedValue([
      { id: 1, title: "GitHub", url: "https://github.com", favIconUrl: "https://github.com/favicon.ico", windowId: 1 },
      { id: 2, title: "Google", url: "https://google.com", windowId: 2 },
    ]);
    const sendResponse = vi.fn();

    await backgroundHandlers.getTabs(undefined, sender, sendResponse);

    expect(chromeMock.tabs.query).toHaveBeenCalledWith({});
    expect(sendResponse).toHaveBeenCalledWith([
      { id: 1, title: "GitHub", url: "https://github.com", favIconUrl: "https://github.com/favicon.ico", windowId: 1 },
      { id: 2, title: "Google", url: "https://google.com", favIconUrl: undefined, windowId: 2 },
    ]);
  });

  it("id が null のタブを除外する", async () => {
    chromeMock.tabs.query.mockResolvedValue([
      { id: null, title: "No ID", url: "https://example.com", windowId: 1 },
      { id: 3, title: "Valid", url: "https://valid.com", windowId: 1 },
    ]);
    const sendResponse = vi.fn();

    await backgroundHandlers.getTabs(undefined, sender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith([
      { id: 3, title: "Valid", url: "https://valid.com", favIconUrl: undefined, windowId: 1 },
    ]);
  });

  it("title / url が undefined のタブは空文字に変換する", async () => {
    chromeMock.tabs.query.mockResolvedValue([
      { id: 4, title: undefined, url: undefined, windowId: 1 },
    ]);
    const sendResponse = vi.fn();

    await backgroundHandlers.getTabs(undefined, sender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith([
      { id: 4, title: "", url: "", favIconUrl: undefined, windowId: 1 },
    ]);
  });

  it("タブが0件のとき空配列を返す", async () => {
    chromeMock.tabs.query.mockResolvedValue([]);
    const sendResponse = vi.fn();

    await backgroundHandlers.getTabs(undefined, sender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith([]);
  });
});

describe("backgroundHandlers.switchTab", () => {
  it("指定タブをアクティブにしてウィンドウをフォーカスする", async () => {
    chromeMock.tabs.update.mockResolvedValue({});
    chromeMock.windows.update.mockResolvedValue({});
    const sendResponse = vi.fn();

    await backgroundHandlers.switchTab({ tabId: 5, windowId: 2 }, sender, sendResponse);

    expect(chromeMock.tabs.update).toHaveBeenCalledWith(5, { active: true });
    expect(chromeMock.windows.update).toHaveBeenCalledWith(2, { focused: true });
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });
});

describe("commandHandlers (open-command-palette)", () => {
  const handler = commandHandlers.find(h => h.command === "open-command-palette")!;

  it("アクティブタブにopenメッセージを送信する", async () => {
    chromeMock.tabs.query.mockResolvedValue([{ id: 10 }]);
    chromeMock.tabs.sendMessage.mockResolvedValue({});

    await handler.handler();

    expect(chromeMock.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(10, {
      moduleId: "commandPalette",
      action: "open",
    });
  });

  it("アクティブタブが存在しない場合は何もしない", async () => {
    chromeMock.tabs.query.mockResolvedValue([]);

    await handler.handler();

    expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("アクティブタブの id が null の場合は何もしない", async () => {
    chromeMock.tabs.query.mockResolvedValue([{ id: null }]);

    await handler.handler();

    expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
  });
});
