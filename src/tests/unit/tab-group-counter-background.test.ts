import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { backgroundHandlers, DEFAULT_FORMAT } from "../../modules/tab-group-counter/background";

// vi.hoisted で mock オブジェクトを定義して vi.mock 内で参照できるようにする
const { mockExtensionApi } = vi.hoisted(() => {
  const mockExtensionApi = {
    tabGroups: {
      query: vi.fn<() => Promise<unknown[]>>(),
      update: vi.fn<() => Promise<void>>(),
      onUpdated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
    },
    tabs: {
      query: vi.fn<() => Promise<unknown[]>>(),
      onCreated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
    },
    storage: {
      onChanged: { addListener: vi.fn() },
    },
  };
  return { mockExtensionApi };
});

// vi.mock は vitest によって自動的にホイストされるため、
// background.ts のイベントリスナー登録・IIFE 実行より前に適用される
vi.mock("../../utils/extension-api", () => ({
  extensionApi: mockExtensionApi,
  getCurrentActiveTab: vi.fn(),
}));

// テストで使いやすい型付きアクセス
const handlers = backgroundHandlers as Record<string, (payload?: unknown) => Promise<unknown>>;

describe("tab-group-counter/background", () => {
  beforeEach(() => {
    // chrome.storage.local を初期化
    fakeBrowser.reset();

    // Chrome API モックのデフォルト実装
    mockExtensionApi.tabGroups.query.mockResolvedValue([]);
    mockExtensionApi.tabGroups.update.mockResolvedValue(undefined);
    mockExtensionApi.tabs.query.mockResolvedValue([]);

    // 呼び出し履歴をリセット
    vi.clearAllMocks();
    mockExtensionApi.tabGroups.query.mockResolvedValue([]);
    mockExtensionApi.tabGroups.update.mockResolvedValue(undefined);
    mockExtensionApi.tabs.query.mockResolvedValue([]);
  });

  // ─── DEFAULT_FORMAT ──────────────────────────────────────────────────────────

  describe("default format constant", () => {
    it("should be \"{name} ({count})\"", () => {
      expect(DEFAULT_FORMAT).toBe("{name} ({count})");
    });
  });

  // ─── getSettings ─────────────────────────────────────────────────────────────

  describe("getSettings", () => {
    it("should return default format when nothing is stored", async () => {
      const result = await handlers.getSettings();
      expect(result).toEqual({ format: "{name} ({count})" });
    });

    it("should return the stored format", async () => {
      await chrome.storage.local.set({ "modules.tabGroupCounter.format": "{name} [{count}]" });
      const result = await handlers.getSettings();
      expect(result).toEqual({ format: "{name} [{count}]" });
    });
  });

  // ─── saveSettings ────────────────────────────────────────────────────────────

  describe("saveSettings", () => {
    it("should persist the new format", async () => {
      await handlers.saveSettings({ format: "{name} [{count}]" });
      const stored = await chrome.storage.local.get("modules.tabGroupCounter.format");
      expect(stored["modules.tabGroupCounter.format"]).toBe("{name} [{count}]");
    });

    it("should return { ok: true } on success", async () => {
      const result = await handlers.saveSettings({ format: "{name} ({count})" });
      expect(result).toEqual({ ok: true });
    });

    it("should return { ok: false } for null payload", async () => {
      expect(await handlers.saveSettings(null)).toEqual({ ok: false });
    });

    it("should return { ok: false } when format is not a string", async () => {
      expect(await handlers.saveSettings({ format: 123 })).toEqual({ ok: false });
      expect(await handlers.saveSettings({})).toEqual({ ok: false });
    });

    it("should apply the new format to all groups immediately (module enabled)", async () => {
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([
        { groupId: 1 },
        { groupId: 1 },
        { groupId: 1 },
      ]);

      await handlers.saveSettings({ format: "{name} ({count})" });

      expect(mockExtensionApi.tabGroups.update).toHaveBeenCalledWith(1, { title: "Work (3)" });
    });

    it("should not apply format when module is disabled", async () => {
      await chrome.storage.local.set({ "modules.tabGroupCounter.enabled": false });

      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([{ groupId: 1 }]);

      await handlers.saveSettings({ format: "{name} ({count})" });

      expect(mockExtensionApi.tabGroups.update).not.toHaveBeenCalled();
    });

    it("should not call update when formatted title is already correct", async () => {
      // originalTitles already stored, formatted title matches
      await chrome.storage.local.set({
        "modules.tabGroupCounter.originalTitles": { 1: "Work" },
      });
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work (2)", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([{ groupId: 1 }, { groupId: 1 }]);

      await handlers.saveSettings({ format: "{name} ({count})" });

      expect(mockExtensionApi.tabGroups.update).not.toHaveBeenCalled();
    });
  });

  // ─── getGroups ───────────────────────────────────────────────────────────────

  describe("getGroups", () => {
    it("should return { groups: [] } when no groups exist", async () => {
      const result = await handlers.getGroups();
      expect(result).toEqual({ groups: [] });
    });

    it("should return correct tab counts per group", async () => {
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work", color: "blue", windowId: 1 },
        { id: 2, title: "Personal", color: "red", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([
        { groupId: 1 },
        { groupId: 1 },
        { groupId: 2 },
      ]);

      const result = await handlers.getGroups() as { groups: Array<{ id: number, tabCount: number }> };

      expect(result.groups).toHaveLength(2);
      expect(result.groups.find(g => g.id === 1)?.tabCount).toBe(2);
      expect(result.groups.find(g => g.id === 2)?.tabCount).toBe(1);
    });

    it("should return original title (not formatted) for popup preview", async () => {
      // No stored original → extract from formatted title
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work (5)", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue(Array.from({ length: 5 }).fill({ groupId: 1 }));

      const result = await handlers.getGroups() as { groups: Array<{ title: string }> };

      expect(result.groups[0].title).toBe("Work");
    });

    it("should prefer stored original title over extraction", async () => {
      await chrome.storage.local.set({
        "modules.tabGroupCounter.originalTitles": { 1: "My Work" },
      });
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "My Work (3)", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([
        { groupId: 1 },
        { groupId: 1 },
        { groupId: 1 },
      ]);

      const result = await handlers.getGroups() as { groups: Array<{ title: string }> };

      expect(result.groups[0].title).toBe("My Work");
    });

    it("should fall back to raw title when format does not match", async () => {
      // Group title is plain (not formatted) and no stored original
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Dev", color: "green", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([]);

      const result = await handlers.getGroups() as { groups: Array<{ title: string }> };

      expect(result.groups[0].title).toBe("Dev");
    });
  });

  // ─── applyFormat logic (via saveSettings) ────────────────────────────────────

  describe("format application logic", () => {
    it("should substitute {name} and {count} in custom format", async () => {
      await chrome.storage.local.set({ "modules.tabGroupCounter.format": "🗂 {name} ({count} tabs)" });

      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([{ groupId: 1 }, { groupId: 1 }]);

      // saveSettings re-saves the same format but triggers applyFormatToAll
      await handlers.saveSettings({ format: "🗂 {name} ({count} tabs)" });

      expect(mockExtensionApi.tabGroups.update).toHaveBeenCalledWith(1, {
        title: "🗂 Work (2 tabs)",
      });
    });

    it("should reverse-extract original from already-formatted title on startup", async () => {
      // Simulate browser restart: group already has formatted title, no stored original
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work (4)", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue(Array.from({ length: 4 }).fill({ groupId: 1 }));

      await handlers.saveSettings({ format: "{name} ({count})" });

      // Title is already correct, so update should NOT be called
      expect(mockExtensionApi.tabGroups.update).not.toHaveBeenCalled();

      // But original should have been stored as "Work"
      const stored = await chrome.storage.local.get("modules.tabGroupCounter.originalTitles");
      const originals = stored["modules.tabGroupCounter.originalTitles"] as Record<string, string>;
      expect(originals[1]).toBe("Work");
    });

    it("should update title when tab count changes", async () => {
      await chrome.storage.local.set({
        "modules.tabGroupCounter.originalTitles": { 1: "Work" },
      });
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work (3)", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([
        { groupId: 1 },
        { groupId: 1 },
        { groupId: 1 },
        { groupId: 1 }, // now 4 tabs
      ]);

      await handlers.saveSettings({ format: "{name} ({count})" });

      expect(mockExtensionApi.tabGroups.update).toHaveBeenCalledWith(1, { title: "Work (4)" });
    });
  });
});
