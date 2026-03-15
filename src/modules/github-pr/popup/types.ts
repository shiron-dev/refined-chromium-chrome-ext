export type PrState = "working" | "reviewing" | "merge_waiting" | "merged";

export interface TrackedPrItem {
  prUrl: string
  state: PrState
  updatedAt: number
  title: string | null
  conversationTabCount: number
  otherViewTabCount: number
  isConversationOpen: boolean
}

export interface PopupStateResponse {
  trackedCount: number
  isCurrentTabPr: boolean
  isCurrentTabTracked: boolean
  currentPrUrl: string | null
  trackedPrItems: TrackedPrItem[]
}

export interface RegisterResponse {
  ok: boolean
  reason?: "not_pr_page" | "already_tracked"
  trackedCount: number
  prUrl?: string
}

export interface UntrackResponse {
  ok: boolean
  reason?: "not_pr_page" | "not_tracked"
  trackedCount: number
  prUrl?: string
}

export interface ReloadTrackedPrsResponse {
  ok: boolean
  reloadedTabCount: number
}
