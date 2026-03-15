export interface TabGroupInfo {
  id: number
  title: string
  color: string
  tabCount: number
  windowId: number
}

export interface TabGroupCounterState {
  groups: TabGroupInfo[]
}

export interface TabGroupCounterSettings {
  format: string
}
