import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// ─── Event listener callbacks (captured before vi.clearAllMocks() runs) ───────
// describe() body runs during test collection, before any beforeEach/afterEach hooks.
// Capturing here preserves the references even after vi.clearAllMocks() clears mock.calls.
type TabGroupUpdatedCb = (group: { id: number, title?: string }) => Promise<void>;
type TabGroupRemovedCb = (groupId: number) => Promise<void>;
type TabCreatedCb = (tab: { groupId?: number }) => void;
type TabRemovedCb = (tabId: number, removeInfo: { isWindowClosing: boolean }) => void;
type TabUpdatedCb = (tabId: number, changeInfo: Record<string, unknown>) => void;
type StorageChangedCb = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

// Helpers to flush floating promises (fire-and-forget async in event listeners)
const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe("tab-group-counter/background", () => {
  // Capture callbacks registered at module load time
  const tabGroupsOnUpdatedCb = mockExtensionApi.tabGroups.onUpdated.addListener.mock
    .calls[0]?.[0] as TabGroupUpdatedCb | undefined;
  const tabGroupsOnRemovedCb = mockExtensionApi.tabGroups.onRemoved.addListener.mock
    .calls[0]?.[0] as TabGroupRemovedCb | undefined;
  const tabsOnCreatedCb = mockExtensionApi.tabs.onCreated.addListener.mock
    .calls[0]?.[0] as TabCreatedCb | undefined;
  const tabsOnRemovedCb = mockExtensionApi.tabs.onRemoved.addListener.mock
    .calls[0]?.[0] as TabRemovedCb | undefined;
  const tabsOnUpdatedCb = mockExtensionApi.tabs.onUpdated.addListener.mock
    .calls[0]?.[0] as TabUpdatedCb | undefined;
  const storageOnChangedCb = mockExtensionApi.storage.onChanged.addListener.mock
    .calls[0]?.[0] as StorageChangedCb | undefined;

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

    it("should handle tabGroups.update throwing gracefully", async () => {
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([{ groupId: 1 }]);
      mockExtensionApi.tabGroups.update.mockRejectedValue(new Error("Group removed"));

      // saveSettings should not throw even if update fails
      await expect(handlers.saveSettings({ format: "{name} ({count})" })).resolves.toEqual({ ok: true });
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

    it("should return raw title when format contains no {name} token", async () => {
      await chrome.storage.local.set({ "modules.tabGroupCounter.format": "group ({count})" });
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work (2)", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([{ groupId: 1 }, { groupId: 1 }]);

      const result = await handlers.getGroups() as { groups: Array<{ title: string }> };

      // extractOriginalName returns null when format has no {name}, falls back to raw title
      expect(result.groups[0].title).toBe("Work (2)");
    });

    it("should ignore tabs with no group (groupId < 0)", async () => {
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([
        { groupId: -1 }, // ungrouped tab
        { groupId: 1 },
      ]);

      const result = await handlers.getGroups() as { groups: Array<{ id: number, tabCount: number }> };

      expect(result.groups[0].tabCount).toBe(1);
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

  // ─── tabGroups.onUpdated listener ────────────────────────────────────────────

  describe("tabGroups.onUpdated listener", () => {
    it("should store new original name when user renames a group", async () => {
      mockExtensionApi.tabs.query.mockResolvedValue([]);
      await tabGroupsOnUpdatedCb?.({ id: 1, title: "NewName" });

      const stored = await chrome.storage.local.get("modules.tabGroupCounter.originalTitles");
      const originals = stored["modules.tabGroupCounter.originalTitles"] as Record<string, string>;
      expect(originals["1"]).toBe("NewName");
    });

    it("should re-apply format with tab count after user renames", async () => {
      mockExtensionApi.tabs.query.mockResolvedValue([{ groupId: 1 }, { groupId: 1 }]);
      await tabGroupsOnUpdatedCb?.({ id: 1, title: "NewName" });

      expect(mockExtensionApi.tabGroups.update).toHaveBeenCalledWith(1, { title: "NewName (2)" });
    });

    it("should not call update when formatted title already matches new name", async () => {
      mockExtensionApi.tabs.query.mockResolvedValue([{ groupId: 1 }, { groupId: 1 }]);
      // "Work (2)" with 2 tabs → extracted name "Work", formatted "Work (2)" == current → no update
      await tabGroupsOnUpdatedCb?.({ id: 1, title: "Work (2)" });

      expect(mockExtensionApi.tabGroups.update).not.toHaveBeenCalled();
    });

    it("should do nothing when module is disabled", async () => {
      await chrome.storage.local.set({ "modules.tabGroupCounter.enabled": false });
      mockExtensionApi.tabs.query.mockResolvedValue([{ groupId: 1 }]);

      await tabGroupsOnUpdatedCb?.({ id: 1, title: "Renamed" });

      expect(mockExtensionApi.tabGroups.update).not.toHaveBeenCalled();
    });

    it("should handle tabGroups.update error in onUpdated gracefully", async () => {
      mockExtensionApi.tabs.query.mockResolvedValue([{ groupId: 1 }]);
      mockExtensionApi.tabGroups.update.mockRejectedValue(new Error("Group gone"));

      await expect(tabGroupsOnUpdatedCb?.({ id: 1, title: "Renamed" })).resolves.not.toThrow();
    });
  });

  // ─── tabGroups.onRemoved listener ────────────────────────────────────────────

  describe("tabGroups.onRemoved listener", () => {
    it("should remove the group from stored originalTitles", async () => {
      await chrome.storage.local.set({
        "modules.tabGroupCounter.originalTitles": { 1: "Work", 2: "Personal" },
      });

      await tabGroupsOnRemovedCb?.(1);

      const stored = await chrome.storage.local.get("modules.tabGroupCounter.originalTitles");
      const originals = stored["modules.tabGroupCounter.originalTitles"] as Record<string, string>;
      expect(originals["1"]).toBeUndefined();
      expect(originals["2"]).toBe("Personal");
    });

    it("should do nothing when the removed group has no stored original", async () => {
      // Should not throw
      await expect(tabGroupsOnRemovedCb?.(99)).resolves.not.toThrow();
    });
  });

  // ─── tabs event listeners (scheduleRefresh) ───────────────────────────────────

  describe("tabs.onCreated listener", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("should schedule refresh when tab joins a group", async () => {
      vi.useFakeTimers();
      tabsOnCreatedCb?.({ groupId: 1 });
      await vi.runAllTimersAsync();

      expect(mockExtensionApi.tabGroups.query).toHaveBeenCalled();
    });

    it("should not schedule refresh when tab has no group (groupId = -1)", () => {
      vi.useFakeTimers();
      tabsOnCreatedCb?.({ groupId: -1 });
      vi.advanceTimersByTime(300);

      expect(mockExtensionApi.tabGroups.query).not.toHaveBeenCalled();
    });

    it("should not schedule refresh when tab has no groupId", () => {
      vi.useFakeTimers();
      tabsOnCreatedCb?.({});
      vi.advanceTimersByTime(300);

      expect(mockExtensionApi.tabGroups.query).not.toHaveBeenCalled();
    });
  });

  describe("tabs.onRemoved listener", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("should schedule refresh when window is not closing", async () => {
      vi.useFakeTimers();
      tabsOnRemovedCb?.(1, { isWindowClosing: false });
      await vi.runAllTimersAsync();

      expect(mockExtensionApi.tabGroups.query).toHaveBeenCalled();
    });

    it("should not schedule refresh when window is closing", () => {
      vi.useFakeTimers();
      tabsOnRemovedCb?.(1, { isWindowClosing: true });
      vi.advanceTimersByTime(300);

      expect(mockExtensionApi.tabGroups.query).not.toHaveBeenCalled();
    });
  });

  describe("tabs.onUpdated listener", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("should schedule refresh when tab's groupId changes", async () => {
      vi.useFakeTimers();
      tabsOnUpdatedCb?.(1, { groupId: 2 });
      await vi.runAllTimersAsync();

      expect(mockExtensionApi.tabGroups.query).toHaveBeenCalled();
    });

    it("should not schedule refresh for unrelated tab updates", () => {
      vi.useFakeTimers();
      tabsOnUpdatedCb?.(1, { url: "https://example.com" });
      vi.advanceTimersByTime(300);

      expect(mockExtensionApi.tabGroups.query).not.toHaveBeenCalled();
    });
  });

  // ─── storage.onChanged listener ──────────────────────────────────────────────

  describe("storage.onChanged listener", () => {
    it("should apply format to all groups when module is enabled", async () => {
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabs.query.mockResolvedValue([{ groupId: 1 }]);

      storageOnChangedCb?.({ "modules.tabGroupCounter.enabled": { newValue: true } }, "local");
      await flushPromises();

      expect(mockExtensionApi.tabGroups.update).toHaveBeenCalledWith(1, { title: "Work (1)" });
    });

    it("should revert all groups to original titles when module is disabled", async () => {
      await chrome.storage.local.set({
        "modules.tabGroupCounter.originalTitles": { 1: "Work" },
      });
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work (3)", color: "blue", windowId: 1 },
      ]);

      storageOnChangedCb?.({ "modules.tabGroupCounter.enabled": { newValue: false } }, "local");
      await flushPromises();

      expect(mockExtensionApi.tabGroups.update).toHaveBeenCalledWith(1, { title: "Work" });
    });

    it("should not revert when group already shows original title", async () => {
      await chrome.storage.local.set({
        "modules.tabGroupCounter.originalTitles": { 1: "Work" },
      });
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work", color: "blue", windowId: 1 }, // already reverted
      ]);

      storageOnChangedCb?.({ "modules.tabGroupCounter.enabled": { newValue: false } }, "local");
      await flushPromises();

      expect(mockExtensionApi.tabGroups.update).not.toHaveBeenCalled();
    });

    it("should clear originalTitles from storage after reverting", async () => {
      await chrome.storage.local.set({
        "modules.tabGroupCounter.originalTitles": { 1: "Work" },
      });
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work (2)", color: "blue", windowId: 1 },
      ]);

      storageOnChangedCb?.({ "modules.tabGroupCounter.enabled": { newValue: false } }, "local");
      await flushPromises();

      const stored = await chrome.storage.local.get("modules.tabGroupCounter.originalTitles");
      expect(stored["modules.tabGroupCounter.originalTitles"]).toEqual({});
    });

    it("should do nothing when area is not local", async () => {
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work", color: "blue", windowId: 1 },
      ]);

      storageOnChangedCb?.({ "modules.tabGroupCounter.enabled": { newValue: true } }, "sync");
      await flushPromises();

      expect(mockExtensionApi.tabGroups.update).not.toHaveBeenCalled();
    });

    it("should do nothing when an unrelated key changes", async () => {
      storageOnChangedCb?.({ "some.other.key": { newValue: "value" } }, "local");
      await flushPromises();

      expect(mockExtensionApi.tabGroups.update).not.toHaveBeenCalled();
    });

    it("should handle revertAllGroups update error gracefully", async () => {
      await chrome.storage.local.set({
        "modules.tabGroupCounter.originalTitles": { 1: "Work" },
      });
      mockExtensionApi.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Work (1)", color: "blue", windowId: 1 },
      ]);
      mockExtensionApi.tabGroups.update.mockRejectedValue(new Error("Group gone"));

      storageOnChangedCb?.({ "modules.tabGroupCounter.enabled": { newValue: false } }, "local");
      // Should not throw — errors are caught inside revertAllGroups
      await expect(flushPromises()).resolves.not.toThrow();
    });
  });
});
