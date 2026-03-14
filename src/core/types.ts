/**
 * Core types for the plugin-based extension architecture
 */

/** Runtime message sent to background service worker */
export interface ModuleMessage {
  moduleId: string
  action: string
  payload?: unknown
}

/** Handles a runtime message dispatched to background */
export type BackgroundMessageHandler = (
  payload: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | void | Promise<unknown>;

/** Handles a message dispatched to content script */
export type ContentMessageHandler = BackgroundMessageHandler;

/** Keyboard command handler */
export interface CommandHandler {
  command: string // must match wxt.config.ts manifest key
  handler: () => void | Promise<void>
}

/** Web navigation completed handler */
export interface NavigationHandler {
  handler: (
    details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
  ) => void | Promise<void>
}

/** Tab removed handler */
export interface TabRemovedHandler {
  handler: (
    tabId: number,
    removeInfo: chrome.tabs.TabRemoveInfo,
  ) => void | Promise<void>
}

/** Card displayed on Home screen */
export interface PopupCard {
  id: string
  title: string
  description: string
  settingKey?: string // corresponds to module id
  DetailScreen: React.ComponentType<{
    onBack: () => void
    enabled?: boolean
    onToggle?: (enabled: boolean) => void
  }>
}

/** Module manifest - contract each module must satisfy */
export interface ModuleManifest {
  id: string
  name: string
  defaultEnabled: boolean
  popupCards: PopupCard[]
  backgroundHandlers?: Record<string, BackgroundMessageHandler>
  contentHandlers?: Record<string, ContentMessageHandler>
  commandHandlers?: CommandHandler[]
  navigationHandlers?: NavigationHandler[]
  tabRemovedHandlers?: TabRemovedHandler[]
}
