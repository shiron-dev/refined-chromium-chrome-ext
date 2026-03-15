/**
 * Namespaced storage utilities for modules
 * All keys are prefixed with "modules.<moduleId>."
 */

export interface NamespacedStorage {
  get: <T>(key: string) => Promise<T | null>
  set: <T>(key: string, value: T) => Promise<void>
  getNamespacedKey: (key: string) => string
}

export function createModuleStorage(moduleId: string): NamespacedStorage {
  const prefix = `modules.${moduleId}.`;

  return {
    getNamespacedKey: key => `${prefix}${key}`,
    get: async <T>(key: string): Promise<T | null> => {
      const fullKey = `${prefix}${key}`;
      const data = await chrome.storage.local.get(fullKey);
      return (data[fullKey] as T) ?? null;
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      const fullKey = `${prefix}${key}`;
      await chrome.storage.local.set({ [fullKey]: value });
    },
  };
}
