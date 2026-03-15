/**
 * Module settings management (enabled/disabled state)
 */

const MODULE_SETTINGS_PATTERN = /^modules\.(.+)\.enabled$/;

export interface ModuleSettings {
  [moduleId: string]: {
    enabled: boolean
  }
}

/** Read all module settings at once */
export async function getModuleSettings(): Promise<ModuleSettings> {
  // Get all items from storage - pass null to get everything
  const data = await chrome.storage.local.get(null);
  const settings: ModuleSettings = {};

  for (const [fullKey, value] of Object.entries(data)) {
    // Extract moduleId from "modules.<moduleId>.enabled"
    const match = fullKey.match(MODULE_SETTINGS_PATTERN);
    if (match) {
      settings[match[1]] = { enabled: Boolean(value) };
    }
  }

  return settings;
}

/** Set enabled state for a module */
export async function setModuleEnabled(moduleId: string, enabled: boolean): Promise<void> {
  const key = `modules.${moduleId}.enabled`;
  await chrome.storage.local.set({ [key]: enabled });
}

/** Initialize default settings for modules not yet in storage */
export async function initializeDefaultSettings(defaults: Record<string, { enabled: boolean }>): Promise<void> {
  const existing = await getModuleSettings();
  const writes: Record<string, boolean> = {};

  for (const [moduleId, { enabled }] of Object.entries(defaults)) {
    if (!(moduleId in existing)) {
      writes[`modules.${moduleId}.enabled`] = enabled;
    }
  }

  if (Object.keys(writes).length > 0) {
    await chrome.storage.local.set(writes);
  }
}

/** Perform one-time storage migration from old to new key format */
export async function migrateStorageIfNeeded(): Promise<void> {
  const data = await chrome.storage.local.get([
    "trackedPrs",
    "moduleSettings",
    "persistentHomeTabs",
  ]);

  const writes: Record<string, unknown> = {};
  const deletes: string[] = [];

  // Migrate tracked PRs
  if (data.trackedPrs) {
    writes["modules.githubPr.trackedPrs"] = data.trackedPrs;
    deletes.push("trackedPrs");
  }

  // Migrate module settings
  if (data.moduleSettings) {
    const s = data.moduleSettings as Record<string, { enabled: boolean }>;
    writes["modules.githubPr.enabled"] = s.githubPrManager?.enabled ?? true;
    writes["modules.urlCopyShortcut.enabled"] = s.urlCopyShortcut?.enabled ?? true;
    writes["modules.persistentHomeTab.enabled"] = s.persistentHomeTab?.enabled ?? true;
    deletes.push("moduleSettings");
  }

  // Migrate persistent home tabs
  if (data.persistentHomeTabs) {
    writes["modules.persistentHomeTab.tabs"] = data.persistentHomeTabs;
    deletes.push("persistentHomeTabs");
  }

  if (Object.keys(writes).length > 0) {
    await chrome.storage.local.set(writes);
  }
  if (deletes.length > 0) {
    await chrome.storage.local.remove(deletes);
  }
}
