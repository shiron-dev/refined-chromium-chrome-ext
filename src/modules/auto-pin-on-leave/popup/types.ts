export interface AutoPinTabEntry {
  tabId: number
  url: string
  title: string
  registeredAt: number
}

export interface AutoPinStateResponse {
  entries: AutoPinTabEntry[]
}

export interface RegisterCurrentResponse {
  ok: boolean
  reason?: "no_active_tab" | "unsupported_url" | "already_registered" | "module_disabled"
  entry?: AutoPinTabEntry
}

export interface UnregisterResponse {
  ok: boolean
  reason?: "not_found"
}
