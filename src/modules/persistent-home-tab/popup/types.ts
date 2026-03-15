export interface PersistentHomeTabItem {
  id: string
  homeUrl: string
  windowId: number
  index: number
  tabId: number
  groupId?: number
  createdAt: number
  updatedAt: number
}

export interface HomeTabStateResponse {
  items: PersistentHomeTabItem[]
}

export interface RegisterCurrentHomeTabResponse {
  ok: boolean
  reason?: "module_disabled" | "no_active_tab" | "unsupported_url" | "already_registered"
  item?: PersistentHomeTabItem
}

export interface UnregisterHomeTabResponse {
  ok: boolean
  reason?: "not_found"
}
