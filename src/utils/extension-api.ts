/**
 * Shared Chrome extension API utilities
 */

export const extensionApi = (globalThis as unknown as { chrome?: any }).chrome;

export interface BrowserTab {
  id?: number
  url?: string
  windowId?: number
  title?: string
  index?: number
  groupId?: number
  active?: boolean
  lastAccessed?: number
}

export async function getCurrentActiveTab(): Promise<BrowserTab | null> {
  if (!extensionApi?.tabs) {
    return null;
  }

  const tabs = await extensionApi.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}
