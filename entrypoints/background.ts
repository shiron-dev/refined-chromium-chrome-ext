type PrState = "working" | "reviewing" | "merge_waiting" | "merged";
type PrEvent = "review_requested" | "approved" | "commented" | "merged";
type ReviewerStatus = "has_reviewers" | "no_reviewers" | "unknown";
type ApprovalStatus = "approved" | "not_approved" | "unknown";
type CommentStatus = "has_comments" | "no_comments" | "unknown";

interface TrackedPrEntry {
  state: PrState
  updatedAt: number
  title: string | null
}

interface ModuleSettings {
  githubPrManager: { enabled: boolean }
  urlCopyShortcut: { enabled: boolean }
  persistentHomeTab: { enabled: boolean }
}

interface PersistentHomeTabEntry {
  id: string
  homeUrl: string
  windowId: number
  index: number
  tabId: number
  groupId?: number
  createdAt: number
  updatedAt: number
}

interface PersistentHomeTabItem {
  id: string
  homeUrl: string
  windowId: number
  index: number
  tabId: number
  groupId?: number
  createdAt: number
  updatedAt: number
}

const DEFAULT_MODULE_SETTINGS: ModuleSettings = {
  githubPrManager: { enabled: true },
  urlCopyShortcut: { enabled: true },
  persistentHomeTab: { enabled: true },
};

interface TrackedPrItem {
  prUrl: string
  state: PrState
  updatedAt: number
  title: string | null
  conversationTabCount: number
  otherViewTabCount: number
  isConversationOpen: boolean
}

interface RegisterCurrentPrMessage {
  type: "REGISTER_CURRENT_PR"
}

interface UntrackCurrentPrMessage {
  type: "UNTRACK_CURRENT_PR"
}

interface ReloadTrackedPrsMessage {
  type: "RELOAD_TRACKED_PRS"
}

interface ActivatePrTabMessage {
  type: "ACTIVATE_PR_TAB"
  prUrl: string
}

interface GetPopupStateMessage {
  type: "GET_POPUP_STATE"
}

interface ScanPrTimelineMessage {
  type: "SCAN_PR_TIMELINE"
  prUrl: string
}

interface PrTimelineScannedMessage {
  type: "PR_TIMELINE_SCANNED"
  prUrl: string
  events: PrEvent[]
  reviewerStatus: ReviewerStatus
  approvalStatus: ApprovalStatus
  commentStatus: CommentStatus
  prTitle: string | null
}

interface GetModuleSettingsMessage {
  type: "GET_MODULE_SETTINGS"
}

interface SetModuleSettingsMessage {
  type: "SET_MODULE_SETTINGS"
  settings: ModuleSettings
}

interface CopyCurrentUrlToClipboardMessage {
  type: "COPY_CURRENT_URL_TO_CLIPBOARD"
  url: string
}

interface RegisterCurrentHomeTabMessage {
  type: "REGISTER_CURRENT_HOME_TAB"
}

interface UnregisterHomeTabMessage {
  type: "UNREGISTER_HOME_TAB"
  id: string
}

interface GetHomeTabStateMessage {
  type: "GET_HOME_TAB_STATE"
}

type RuntimeMessage = RegisterCurrentPrMessage
  | UntrackCurrentPrMessage
  | ReloadTrackedPrsMessage
  | ActivatePrTabMessage
  | GetPopupStateMessage
  | ScanPrTimelineMessage
  | PrTimelineScannedMessage
  | GetModuleSettingsMessage
  | SetModuleSettingsMessage
  | CopyCurrentUrlToClipboardMessage
  | RegisterCurrentHomeTabMessage
  | UnregisterHomeTabMessage
  | GetHomeTabStateMessage;

interface BrowserTab {
  id?: number
  url?: string
  windowId?: number
  title?: string
  index?: number
  groupId?: number
  active?: boolean
  lastAccessed?: number
}

interface MessageSenderLike {
  tab?: BrowserTab
}

interface InstalledDetailsLike {
  reason?: string
}

interface WebNavigationDetailsLike {
  frameId: number
  tabId: number
  url: string
}

interface TabRemovedInfoLike {
  windowId: number
  isWindowClosing: boolean
}

type TabGroupColor = "grey" | "blue" | "green" | "purple";

interface ExtensionApiLike {
  storage?: {
    local?: {
      get: (key: string) => Promise<Record<string, unknown>>
      set: (data: Record<string, unknown>) => Promise<void>
    }
  }
  tabs?: {
    query: (queryInfo: Record<string, unknown>) => Promise<BrowserTab[]>
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>
    group: (options: Record<string, unknown>) => Promise<number>
    reload: (tabId: number) => Promise<void>
    create: (createProperties: Record<string, unknown>) => Promise<BrowserTab>
    onRemoved?: {
      addListener: (callback: (tabId: number, removeInfo: TabRemovedInfoLike) => void | Promise<void>) => void
    }
  }
  scripting?: {
    executeScript: (injection: {
      target: { tabId: number }
      func: (url: string) => boolean | Promise<boolean>
      args?: unknown[]
    }) => Promise<Array<{ result?: unknown }>>
  }
  tabGroups?: {
    query: (queryInfo: Record<string, unknown>) => Promise<Array<{ id?: number }>>
    update: (groupId: number, properties: Record<string, unknown>) => Promise<void>
  }
  runtime?: {
    onInstalled?: {
      addListener: (callback: (details: InstalledDetailsLike) => void) => void
    }
    onMessage?: {
      addListener: (
        callback: (
          message: RuntimeMessage,
          sender: MessageSenderLike,
          sendResponse: (payload: unknown) => void,
        ) => boolean,
      ) => void
    }
  }
  commands?: {
    onCommand?: {
      addListener: (callback: (command: string) => void | Promise<void>) => void
    }
  }
  webNavigation?: {
    onCompleted?: {
      addListener: (callback: (details: WebNavigationDetailsLike) => void | Promise<void>) => void
    }
  }
}

const STORAGE_KEY = "trackedPrs";
const MODULE_SETTINGS_KEY = "moduleSettings";
const PERSISTENT_HOME_TABS_KEY = "persistentHomeTabs";
const GITHUB_PR_URL_PATTERN = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/.*)?$/;

const GROUP_TITLE_BY_STATE: Record<PrState, string> = {
  working: "PR作業/確認中",
  reviewing: "PRレビュー中",
  merge_waiting: "PRマージ待ち",
  merged: "PRマージ済み",
};

const GROUP_COLOR_BY_STATE: Record<PrState, TabGroupColor> = {
  working: "grey",
  reviewing: "blue",
  merge_waiting: "green",
  merged: "purple",
};
const PR_STATE_ORDER: Record<PrState, number> = {
  working: 0,
  reviewing: 1,
  merge_waiting: 2,
  merged: 3,
};

const extensionApi = (globalThis as unknown as { chrome?: ExtensionApiLike }).chrome;
const REGISTER_CURRENT_PR_COMMAND = "register-current-pr";
const UNTRACK_CURRENT_PR_COMMAND = "untrack-current-pr";
const COPY_CURRENT_URL_COMMAND = "copy-current-url";

function normalizePrUrl(rawUrl?: string): string | null {
  if (!rawUrl) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  }
  catch {
    return null;
  }

  if (parsed.hostname !== "github.com") {
    return null;
  }

  const match = parsed.pathname.match(GITHUB_PR_URL_PATTERN);
  if (!match) {
    return null;
  }

  const [, owner, repo, number] = match;
  return `https://github.com/${owner}/${repo}/pull/${number}`;
}

function isConversationView(rawUrl?: string): boolean {
  if (!rawUrl) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  }
  catch {
    return false;
  }

  if (parsed.hostname !== "github.com") {
    return false;
  }

  // Conversation view has no /files, /commits, or other suffix
  // Pattern: /owner/repo/pull/number (and optionally nothing or just ?)
  const match = parsed.pathname.match(GITHUB_PR_URL_PATTERN);
  if (!match) {
    return false;
  }

  // Check if the path ends at the pull number (no /files, /commits, etc.)
  const pathAfterNumber = parsed.pathname.replace(match[0], "");
  return pathAfterNumber === "";
}

async function getTrackedPrs(): Promise<Record<string, TrackedPrEntry>> {
  if (!extensionApi?.storage?.local) {
    return {};
  }

  const data = await extensionApi.storage.local.get(STORAGE_KEY);
  const trackedPrs = data?.[STORAGE_KEY];

  if (!trackedPrs || typeof trackedPrs !== "object") {
    return {};
  }

  return trackedPrs as Record<string, TrackedPrEntry>;
}

async function setTrackedPrs(trackedPrs: Record<string, TrackedPrEntry>): Promise<void> {
  await extensionApi?.storage?.local?.set({ [STORAGE_KEY]: trackedPrs });
}

async function getModuleSettings(): Promise<ModuleSettings> {
  if (!extensionApi?.storage?.local) {
    return DEFAULT_MODULE_SETTINGS;
  }

  const data = await extensionApi.storage.local.get(MODULE_SETTINGS_KEY);
  const raw = data?.[MODULE_SETTINGS_KEY];

  if (!raw || typeof raw !== "object") {
    return DEFAULT_MODULE_SETTINGS;
  }

  const stored = raw as Partial<ModuleSettings>;
  return {
    githubPrManager: {
      enabled: typeof stored.githubPrManager?.enabled === "boolean"
        ? stored.githubPrManager.enabled
        : DEFAULT_MODULE_SETTINGS.githubPrManager.enabled,
    },
    urlCopyShortcut: {
      enabled: typeof stored.urlCopyShortcut?.enabled === "boolean"
        ? stored.urlCopyShortcut.enabled
        : DEFAULT_MODULE_SETTINGS.urlCopyShortcut.enabled,
    },
    persistentHomeTab: {
      enabled: typeof stored.persistentHomeTab?.enabled === "boolean"
        ? stored.persistentHomeTab.enabled
        : DEFAULT_MODULE_SETTINGS.persistentHomeTab.enabled,
    },
  };
}

async function setModuleSettings(settings: ModuleSettings): Promise<void> {
  await extensionApi?.storage?.local?.set({ [MODULE_SETTINGS_KEY]: settings });
}

function createPersistentHomeTabId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizePersistentHomeUrl(rawUrl?: string): string | null {
  if (!rawUrl) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  }
  catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return null;
  }

  return parsed.toString();
}

function asPersistentHomeTabEntry(value: unknown): PersistentHomeTabEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PersistentHomeTabEntry>;

  if (
    typeof candidate.id !== "string"
    || typeof candidate.homeUrl !== "string"
    || typeof candidate.windowId !== "number"
    || typeof candidate.index !== "number"
    || typeof candidate.tabId !== "number"
    || typeof candidate.createdAt !== "number"
    || typeof candidate.updatedAt !== "number"
  ) {
    return null;
  }

  if (candidate.groupId !== undefined && typeof candidate.groupId !== "number") {
    return null;
  }

  return {
    id: candidate.id,
    homeUrl: candidate.homeUrl,
    windowId: candidate.windowId,
    index: candidate.index,
    tabId: candidate.tabId,
    groupId: candidate.groupId,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

async function getPersistentHomeTabs(): Promise<Record<string, PersistentHomeTabEntry>> {
  if (!extensionApi?.storage?.local) {
    return {};
  }

  const data = await extensionApi.storage.local.get(PERSISTENT_HOME_TABS_KEY);
  const stored = data?.[PERSISTENT_HOME_TABS_KEY];

  if (!stored || typeof stored !== "object") {
    return {};
  }

  const parsedEntries = Object.entries(stored).reduce<Record<string, PersistentHomeTabEntry>>((acc, [key, value]) => {
    const entry = asPersistentHomeTabEntry(value);
    if (entry) {
      acc[key] = entry;
    }
    return acc;
  }, {});

  return parsedEntries;
}

async function setPersistentHomeTabs(tabs: Record<string, PersistentHomeTabEntry>): Promise<void> {
  await extensionApi?.storage?.local?.set({ [PERSISTENT_HOME_TABS_KEY]: tabs });
}

async function resyncPersistentHomeTabIndexes(
  persistentHomeTabs: Record<string, PersistentHomeTabEntry>,
): Promise<Record<string, PersistentHomeTabEntry>> {
  if (!extensionApi?.tabs) {
    return persistentHomeTabs;
  }

  const allTabs = await extensionApi.tabs.query({});
  const tabById = allTabs.reduce<Record<number, BrowserTab>>((acc, tab) => {
    if (tab.id !== undefined) {
      acc[tab.id] = tab;
    }
    return acc;
  }, {});

  let changed = false;
  const nextEntries = Object.entries(persistentHomeTabs).reduce<Record<string, PersistentHomeTabEntry>>((acc, [id, entry]) => {
    const currentTab = tabById[entry.tabId];
    if (!currentTab || currentTab.windowId === undefined || currentTab.index === undefined) {
      acc[id] = entry;
      return acc;
    }

    const nextEntry: PersistentHomeTabEntry = {
      ...entry,
      windowId: currentTab.windowId,
      index: currentTab.index,
      groupId: currentTab.groupId !== undefined && currentTab.groupId >= 0
        ? currentTab.groupId
        : undefined,
    };

    if (
      nextEntry.windowId !== entry.windowId
      || nextEntry.index !== entry.index
      || nextEntry.groupId !== entry.groupId
    ) {
      changed = true;
    }

    acc[id] = nextEntry;
    return acc;
  }, {});

  if (changed) {
    await setPersistentHomeTabs(nextEntries);
  }

  return nextEntries;
}

function toPersistentHomeTabItem(entry: PersistentHomeTabEntry): PersistentHomeTabItem {
  return {
    id: entry.id,
    homeUrl: entry.homeUrl,
    windowId: entry.windowId,
    index: entry.index,
    tabId: entry.tabId,
    groupId: entry.groupId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

async function getLastNormalWindowId(): Promise<number | null> {
  if (!extensionApi?.tabs) {
    return null;
  }

  const tabs = await extensionApi.tabs.query({ windowType: "normal" });
  if (tabs.length === 0) {
    return null;
  }

  const latestTab = tabs.reduce((latest, current) => {
    if ((current.lastAccessed ?? 0) >= (latest.lastAccessed ?? 0)) {
      return current;
    }
    return latest;
  }, tabs[0]);

  return latestTab.windowId ?? null;
}

async function getResolvedWindowId(preferredWindowId: number): Promise<number | null> {
  if (!extensionApi?.tabs) {
    return null;
  }

  try {
    const tabsInPreferredWindow = await extensionApi.tabs.query({ windowId: preferredWindowId });
    if (tabsInPreferredWindow.length > 0) {
      return preferredWindowId;
    }
  }
  catch {
    // Window was likely closed.
  }

  return getLastNormalWindowId();
}

async function handleGetHomeTabState(): Promise<{ items: PersistentHomeTabItem[] }> {
  const persistentHomeTabs = await getPersistentHomeTabs();
  const items = Object.values(persistentHomeTabs)
    .map(toPersistentHomeTabItem)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return { items };
}

async function handleRegisterCurrentHomeTab(): Promise<{
  ok: boolean
  reason?: "module_disabled" | "no_active_tab" | "unsupported_url" | "already_registered"
  item?: PersistentHomeTabItem
}> {
  const moduleSettings = await getModuleSettings();
  if (!moduleSettings.persistentHomeTab.enabled) {
    return { ok: false, reason: "module_disabled" };
  }

  const tab = await getCurrentActiveTab();
  const tabId = tab?.id;
  const windowId = tab?.windowId;
  const index = tab?.index;
  const homeUrl = normalizePersistentHomeUrl(tab?.url);

  if (tabId === undefined || windowId === undefined || index === undefined) {
    return { ok: false, reason: "no_active_tab" };
  }

  if (!homeUrl) {
    return { ok: false, reason: "unsupported_url" };
  }

  let persistentHomeTabs = await getPersistentHomeTabs();
  persistentHomeTabs = await resyncPersistentHomeTabIndexes(persistentHomeTabs);
  const duplicatedEntry = Object.values(persistentHomeTabs).find(entry => entry.tabId === tabId);
  if (duplicatedEntry) {
    return {
      ok: false,
      reason: "already_registered",
      item: toPersistentHomeTabItem(duplicatedEntry),
    };
  }

  const id = createPersistentHomeTabId();
  const now = Date.now();
  const initialGroupId = tab?.groupId;
  const entry: PersistentHomeTabEntry = {
    id,
    homeUrl,
    windowId,
    index,
    tabId,
    groupId: initialGroupId !== undefined && initialGroupId >= 0 ? initialGroupId : undefined,
    createdAt: now,
    updatedAt: now,
  };

  persistentHomeTabs[id] = entry;
  const hasEarlierOrSameIndexInWindow = Object.values(persistentHomeTabs).some(currentEntry =>
    currentEntry.id !== id
    && currentEntry.windowId === entry.windowId
    && currentEntry.index >= entry.index,
  );

  await setPersistentHomeTabs(persistentHomeTabs);
  let responseEntry = persistentHomeTabs[id];

  if (hasEarlierOrSameIndexInWindow) {
    const syncedEntries = await resyncPersistentHomeTabIndexes(persistentHomeTabs);
    responseEntry = syncedEntries[id] ?? responseEntry;
  }

  return {
    ok: true,
    item: toPersistentHomeTabItem(responseEntry),
  };
}

async function handleUnregisterHomeTab(message: UnregisterHomeTabMessage): Promise<{
  ok: boolean
  reason?: "not_found"
}> {
  const persistentHomeTabs = await getPersistentHomeTabs();

  if (!persistentHomeTabs[message.id]) {
    return { ok: false, reason: "not_found" };
  }

  delete persistentHomeTabs[message.id];
  await setPersistentHomeTabs(persistentHomeTabs);

  return { ok: true };
}

async function restorePersistentHomeTab(entry: PersistentHomeTabEntry): Promise<void> {
  if (!extensionApi?.tabs) {
    return;
  }

  const resolvedWindowId = await getResolvedWindowId(entry.windowId);
  if (resolvedWindowId === null) {
    return;
  }

  let createdTab: BrowserTab | null = null;
  try {
    createdTab = await extensionApi.tabs.create({
      url: entry.homeUrl,
      windowId: resolvedWindowId,
      index: entry.index,
      active: false,
    });
  }
  catch {
    createdTab = await extensionApi.tabs.create({
      url: entry.homeUrl,
      windowId: resolvedWindowId,
      active: false,
    });
  }

  const createdTabId = createdTab.id;
  if (createdTabId === undefined) {
    return;
  }

  if (entry.groupId !== undefined) {
    try {
      await extensionApi.tabs.group({ groupId: entry.groupId, tabIds: [createdTabId] });
    }
    catch {
      // Ignore group restore failures and keep tab restored.
    }
  }

  const persistentHomeTabs = await getPersistentHomeTabs();
  const latestEntry = persistentHomeTabs[entry.id];
  if (!latestEntry) {
    return;
  }

  persistentHomeTabs[entry.id] = {
    ...latestEntry,
    tabId: createdTabId,
    windowId: createdTab.windowId ?? resolvedWindowId,
    index: createdTab.index ?? latestEntry.index,
    groupId: createdTab.groupId !== undefined && createdTab.groupId >= 0
      ? createdTab.groupId
      : latestEntry.groupId,
    updatedAt: Date.now(),
  };
  await setPersistentHomeTabs(persistentHomeTabs);
}

async function handlePersistentHomeTabRemoved(tabId: number): Promise<void> {
  const moduleSettings = await getModuleSettings();
  if (!moduleSettings.persistentHomeTab.enabled) {
    return;
  }

  const persistentHomeTabs = await getPersistentHomeTabs();
  const targetEntry = Object.values(persistentHomeTabs).find(entry => entry.tabId === tabId);

  if (!targetEntry) {
    return;
  }

  await restorePersistentHomeTab(targetEntry);
}

function applyPrEvents(events: PrEvent[]): PrState {
  let state: PrState = "working";

  for (const event of events) {
    if (event === "merged") {
      state = "merged";
      continue;
    }

    if (event === "review_requested") {
      state = "reviewing";
      continue;
    }

    if (event === "approved") {
      state = "merge_waiting";
      continue;
    }

    if (event === "commented" && state === "merge_waiting") {
      state = "working";
    }
  }

  return state;
}

async function moveTabToStateGroup(tabId: number, windowId: number, state: PrState): Promise<void> {
  if (!extensionApi?.tabs || !extensionApi?.tabGroups) {
    return;
  }

  const title = GROUP_TITLE_BY_STATE[state];
  const color = GROUP_COLOR_BY_STATE[state];
  let groupId: number | undefined;

  try {
    const groups = await extensionApi.tabGroups.query({ title, windowId, shared: false });
    groupId = groups[0]?.id;
  }
  catch {
    const groups = await extensionApi.tabGroups.query({ title, windowId });
    groupId = groups[0]?.id;
  }

  if (groupId !== undefined) {
    await extensionApi.tabs.group({ groupId, tabIds: [tabId] });
    return;
  }

  const createdGroupId = await extensionApi.tabs.group({ tabIds: [tabId] });

  try {
    await extensionApi.tabGroups.update(createdGroupId, { color, title, shared: false });
  }
  catch {
    await extensionApi.tabGroups.update(createdGroupId, { color, title });
  }
}

async function getCurrentActiveTab(): Promise<BrowserTab | null> {
  if (!extensionApi?.tabs) {
    return null;
  }

  const tabs = await extensionApi.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function sendScanRequestToTab(tabId: number, prUrl: string): Promise<void> {
  if (!extensionApi?.tabs) {
    return;
  }

  const message: ScanPrTimelineMessage = {
    type: "SCAN_PR_TIMELINE",
    prUrl,
  };

  try {
    await extensionApi.tabs.sendMessage(tabId, message);
  }
  catch (error: unknown) {
    console.warn("Failed to send scan request:", error);
  }
}

async function handleRegisterCurrentPr(): Promise<{
  ok: boolean
  reason?: "not_pr_page" | "already_tracked"
  trackedCount: number
  prUrl?: string
}> {
  const tab = await getCurrentActiveTab();
  const prUrl = normalizePrUrl(tab?.url);

  if (!prUrl) {
    const trackedPrs = await getTrackedPrs();
    return {
      ok: false,
      reason: "not_pr_page",
      trackedCount: Object.keys(trackedPrs).length,
    };
  }

  const trackedPrs = await getTrackedPrs();

  if (trackedPrs[prUrl]) {
    return {
      ok: false,
      reason: "already_tracked",
      trackedCount: Object.keys(trackedPrs).length,
      prUrl,
    };
  }

  trackedPrs[prUrl] = {
    state: "working",
    updatedAt: Date.now(),
    title: tab?.title ?? null,
  };

  await setTrackedPrs(trackedPrs);

  return {
    ok: true,
    trackedCount: Object.keys(trackedPrs).length,
    prUrl,
  };
}

async function handleGetPopupState(): Promise<{
  trackedCount: number
  isCurrentTabPr: boolean
  isCurrentTabTracked: boolean
  currentPrUrl: string | null
  trackedPrItems: TrackedPrItem[]
}> {
  const trackedPrs = await getTrackedPrs();
  const tab = await getCurrentActiveTab();
  const currentPrUrl = normalizePrUrl(tab?.url);
  const allTabs = await extensionApi?.tabs?.query({}) ?? [];

  // Count conversation tabs and other view tabs separately
  const conversationTabCounts = allTabs.reduce<Record<string, number>>((acc, currentTab) => {
    const prUrl = normalizePrUrl(currentTab.url);
    if (!prUrl) {
      return acc;
    }

    if (isConversationView(currentTab.url)) {
      acc[prUrl] = (acc[prUrl] ?? 0) + 1;
    }
    return acc;
  }, {});

  const otherViewTabCounts = allTabs.reduce<Record<string, number>>((acc, currentTab) => {
    const prUrl = normalizePrUrl(currentTab.url);
    if (!prUrl) {
      return acc;
    }

    if (!isConversationView(currentTab.url)) {
      acc[prUrl] = (acc[prUrl] ?? 0) + 1;
    }
    return acc;
  }, {});

  const openTabTitles = allTabs.reduce<Record<string, string | null>>((acc, currentTab) => {
    const prUrl = normalizePrUrl(currentTab.url);
    if (!prUrl) {
      return acc;
    }

    if (!acc[prUrl] && currentTab.title) {
      acc[prUrl] = currentTab.title;
    }

    return acc;
  }, {});

  const trackedPrItems = Object.entries(trackedPrs)
    .map(([prUrl, entry]) => ({
      prUrl,
      state: entry.state,
      updatedAt: entry.updatedAt,
      title: openTabTitles[prUrl] ?? entry.title ?? null,
      conversationTabCount: conversationTabCounts[prUrl] ?? 0,
      otherViewTabCount: otherViewTabCounts[prUrl] ?? 0,
      isConversationOpen: (conversationTabCounts[prUrl] ?? 0) > 0,
    }))
    .sort((a, b) => {
      const stateDiff = PR_STATE_ORDER[a.state] - PR_STATE_ORDER[b.state];
      if (stateDiff !== 0) {
        return stateDiff;
      }

      return b.updatedAt - a.updatedAt;
    });

  return {
    trackedCount: Object.keys(trackedPrs).length,
    isCurrentTabPr: Boolean(currentPrUrl),
    isCurrentTabTracked: currentPrUrl ? Boolean(trackedPrs[currentPrUrl]) : false,
    currentPrUrl,
    trackedPrItems,
  };
}

async function handleUntrackCurrentPr(): Promise<{
  ok: boolean
  reason?: "not_pr_page" | "not_tracked"
  trackedCount: number
  prUrl?: string
}> {
  const tab = await getCurrentActiveTab();
  const prUrl = normalizePrUrl(tab?.url);

  if (!prUrl) {
    const trackedPrs = await getTrackedPrs();
    return {
      ok: false,
      reason: "not_pr_page",
      trackedCount: Object.keys(trackedPrs).length,
    };
  }

  const trackedPrs = await getTrackedPrs();

  if (!trackedPrs[prUrl]) {
    return {
      ok: false,
      reason: "not_tracked",
      trackedCount: Object.keys(trackedPrs).length,
      prUrl,
    };
  }

  delete trackedPrs[prUrl];
  await setTrackedPrs(trackedPrs);

  return {
    ok: true,
    trackedCount: Object.keys(trackedPrs).length,
    prUrl,
  };
}

async function handleReloadTrackedPrs(): Promise<{
  ok: boolean
  reloadedTabCount: number
}> {
  if (!extensionApi?.tabs) {
    return { ok: false, reloadedTabCount: 0 };
  }

  const trackedPrs = await getTrackedPrs();
  const trackedPrUrls = new Set(Object.keys(trackedPrs));
  if (trackedPrUrls.size === 0) {
    return { ok: true, reloadedTabCount: 0 };
  }

  const tabs = await extensionApi.tabs.query({});
  const targetTabIds = tabs
    .filter((tab) => {
      const prUrl = normalizePrUrl(tab.url);
      return Boolean(prUrl && trackedPrUrls.has(prUrl));
    })
    .map(tab => tab.id)
    .filter((tabId): tabId is number => tabId !== undefined);

  await Promise.all(
    targetTabIds.map(async (tabId) => {
      try {
        await extensionApi.tabs?.reload(tabId);
      }
      catch (error: unknown) {
        console.warn(`Failed to reload tab ${tabId}:`, error);
      }
    }),
  );

  return {
    ok: true,
    reloadedTabCount: targetTabIds.length,
  };
}

async function handleActivatePrTab(message: ActivatePrTabMessage): Promise<{
  ok: boolean
}> {
  if (!extensionApi?.tabs) {
    return { ok: false };
  }

  const tabs = await extensionApi.tabs.query({});
  const prTabs = tabs.filter(tab => normalizePrUrl(tab.url) === message.prUrl);

  if (prTabs.length === 0) {
    return { ok: false };
  }

  // Prioritize conversation view tab
  let targetTab = prTabs.find(tab => isConversationView(tab.url));
  if (!targetTab) {
    // If no conversation view, use the first tab
    targetTab = prTabs[0];
  }

  if (targetTab?.id !== undefined) {
    try {
      await extensionApi.tabs.group({ tabIds: [targetTab.id] });
    }
    catch {
      // Ignore group error, just activate the tab
    }
  }

  return { ok: true };
}

async function handleGetModuleSettings(): Promise<{ settings: ModuleSettings }> {
  return { settings: await getModuleSettings() };
}

async function handleSetModuleSettings(message: SetModuleSettingsMessage): Promise<{ ok: boolean }> {
  await setModuleSettings(message.settings);
  return { ok: true };
}

async function handleCopyCurrentUrlShortcut(): Promise<{
  ok: boolean
  reason?: "no_active_tab" | "unsupported_tab" | "copy_failed"
}> {
  if (!extensionApi?.tabs || !extensionApi?.scripting) {
    return { ok: false, reason: "no_active_tab" };
  }

  const tab = await getCurrentActiveTab();
  if (!tab?.url || tab.id === undefined) {
    return { ok: false, reason: "no_active_tab" };
  }

  try {
    const results = await extensionApi.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (url: string) => {
        const toastId = "refined-chromium-copy-toast";

        const fallbackCopyTextToClipboard = (value: string): boolean => {
          const textarea = document.createElement("textarea");
          textarea.value = value;
          textarea.setAttribute("readonly", "true");
          textarea.style.position = "fixed";
          textarea.style.top = "0";
          textarea.style.left = "0";
          textarea.style.opacity = "0";

          const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

          document.body.append(textarea);
          textarea.focus();
          textarea.select();
          textarea.setSelectionRange(0, value.length);

          try {
            return document.execCommand("copy");
          }
          catch {
            return false;
          }
          finally {
            textarea.remove();
            activeElement?.focus();
          }
        };

        const showToast = (message: string, tone: "success" | "warn"): void => {
          const existing = document.getElementById(toastId);
          existing?.remove();

          const toast = document.createElement("div");
          toast.id = toastId;
          toast.textContent = message;
          toast.setAttribute("role", "status");
          toast.setAttribute("aria-live", "polite");
          toast.style.position = "fixed";
          toast.style.top = "20px";
          toast.style.right = "20px";
          toast.style.zIndex = "2147483647";
          toast.style.padding = "10px 14px";
          toast.style.borderRadius = "10px";
          toast.style.fontSize = "13px";
          toast.style.fontWeight = "600";
          toast.style.lineHeight = "1.4";
          toast.style.color = "#ffffff";
          toast.style.background = tone === "success" ? "#111827" : "#b45309";
          toast.style.boxShadow = "0 12px 30px rgba(15, 23, 42, 0.18)";
          toast.style.opacity = "0";
          toast.style.transform = "translateY(-6px)";
          toast.style.transition = "opacity 160ms ease, transform 160ms ease";

          (document.body ?? document.documentElement).append(toast);

          requestAnimationFrame(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateY(0)";
          });

          window.setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(-6px)";
            window.setTimeout(() => toast.remove(), 180);
          }, 1600);
        };

        let ok = false;

        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(url);
            ok = true;
          }
          catch {
            ok = fallbackCopyTextToClipboard(url);
          }
        }
        else {
          ok = fallbackCopyTextToClipboard(url);
        }

        showToast(ok ? "URLをコピーしました" : "URLのコピーに失敗しました", ok ? "success" : "warn");
        return ok;
      },
      args: [tab.url],
    });

    return { ok: Boolean(results[0]?.result), reason: results[0]?.result ? undefined : "copy_failed" };
  }
  catch (error: unknown) {
    console.warn("Failed to copy current URL from shortcut:", error);
    return { ok: false, reason: "unsupported_tab" };
  }
}

async function handleTimelineScanned(
  message: PrTimelineScannedMessage,
  sender: MessageSenderLike,
): Promise<void> {
  const moduleSettings = await getModuleSettings();
  if (!moduleSettings.githubPrManager.enabled) {
    return;
  }

  const prUrl = normalizePrUrl(message.prUrl);
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;

  if (!prUrl || tabId === undefined || windowId === undefined) {
    return;
  }

  const trackedPrs = await getTrackedPrs();
  const tracked = trackedPrs[prUrl];

  if (!tracked) {
    return;
  }

  const eventsForState = message.reviewerStatus === "no_reviewers"
    ? message.events.filter(event => event !== "review_requested")
    : message.events;
  const eventsForApproval = message.approvalStatus === "not_approved"
    ? eventsForState.filter(event => event !== "approved")
    : eventsForState;
  const eventsForComment = message.commentStatus === "no_comments"
    ? eventsForApproval.filter(event => event !== "commented")
    : eventsForApproval;
  const approvedEvent: PrEvent = "approved";
  const eventsForResolvedState: PrEvent[] = message.approvalStatus === "approved"
    ? [...eventsForComment, approvedEvent]
    : eventsForComment;
  let nextState = applyPrEvents(eventsForResolvedState);

  // Current sidebar statuses should win over historical timeline signals.
  if (message.commentStatus === "has_comments" && nextState !== "merged") {
    nextState = "working";
  }
  else if (message.approvalStatus === "approved" && nextState !== "merged") {
    nextState = "merge_waiting";
  }
  else if (message.reviewerStatus === "has_reviewers" && nextState !== "merged") {
    nextState = "reviewing";
  }
  else if (message.reviewerStatus === "no_reviewers" && nextState === "reviewing") {
    nextState = "working";
  }

  trackedPrs[prUrl] = {
    state: nextState,
    updatedAt: Date.now(),
    title: message.prTitle ?? tracked.title ?? null,
  };

  await setTrackedPrs(trackedPrs);
  await moveTabToStateGroup(tabId, windowId, nextState);
}

export default defineBackground(() => {
  extensionApi?.runtime?.onInstalled?.addListener((details: InstalledDetailsLike) => {
    if (details.reason === "install") {
      console.warn("GitHub PR Tab Group Manager installed");
    }
  });

  extensionApi?.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
    if (message.type === "REGISTER_CURRENT_PR") {
      handleRegisterCurrentPr()
        .then(sendResponse)
        .catch((error: unknown) => {
          console.error(error);
          sendResponse({ ok: false, reason: "not_pr_page", trackedCount: 0 });
        });

      return true;
    }

    if (message.type === "UNTRACK_CURRENT_PR") {
      handleUntrackCurrentPr()
        .then(sendResponse)
        .catch((error: unknown) => {
          console.error(error);
          sendResponse({ ok: false, reason: "not_pr_page", trackedCount: 0 });
        });

      return true;
    }

    if (message.type === "RELOAD_TRACKED_PRS") {
      handleReloadTrackedPrs()
        .then(sendResponse)
        .catch((error: unknown) => {
          console.error(error);
          sendResponse({ ok: false, reloadedTabCount: 0 });
        });

      return true;
    }

    if (message.type === "ACTIVATE_PR_TAB") {
      handleActivatePrTab(message)
        .then(sendResponse)
        .catch((error: unknown) => {
          console.error(error);
          sendResponse({ ok: false });
        });

      return true;
    }

    if (message.type === "GET_POPUP_STATE") {
      handleGetPopupState()
        .then(sendResponse)
        .catch((error: unknown) => {
          console.error(error);
          sendResponse({
            trackedCount: 0,
            isCurrentTabPr: false,
            isCurrentTabTracked: false,
            currentPrUrl: null,
            trackedPrItems: [],
          });
        });

      return true;
    }

    if (message.type === "REGISTER_CURRENT_HOME_TAB") {
      handleRegisterCurrentHomeTab()
        .then(sendResponse)
        .catch((error: unknown) => {
          console.error(error);
          sendResponse({ ok: false, reason: "no_active_tab" });
        });

      return true;
    }

    if (message.type === "UNREGISTER_HOME_TAB") {
      handleUnregisterHomeTab(message)
        .then(sendResponse)
        .catch((error: unknown) => {
          console.error(error);
          sendResponse({ ok: false, reason: "not_found" });
        });

      return true;
    }

    if (message.type === "GET_HOME_TAB_STATE") {
      handleGetHomeTabState()
        .then(sendResponse)
        .catch((error: unknown) => {
          console.error(error);
          sendResponse({ items: [] });
        });

      return true;
    }

    if (message.type === "PR_TIMELINE_SCANNED") {
      handleTimelineScanned(message, sender).catch((error: unknown) => console.error(error));
    }

    if (message.type === "GET_MODULE_SETTINGS") {
      handleGetModuleSettings()
        .then(sendResponse)
        .catch((error: unknown) => {
          console.error(error);
          sendResponse({ settings: DEFAULT_MODULE_SETTINGS });
        });

      return true;
    }

    if (message.type === "SET_MODULE_SETTINGS") {
      handleSetModuleSettings(message)
        .then(sendResponse)
        .catch((error: unknown) => {
          console.error(error);
          sendResponse({ ok: false });
        });

      return true;
    }

    return false;
  });

  extensionApi?.commands?.onCommand?.addListener(async (command: string) => {
    const cmdModuleSettings = await getModuleSettings();

    if (command === REGISTER_CURRENT_PR_COMMAND && cmdModuleSettings.githubPrManager.enabled) {
      try {
        await handleRegisterCurrentPr();
      }
      catch (error: unknown) {
        console.error("Failed to register current PR from shortcut:", error);
      }

      return;
    }

    if (command === UNTRACK_CURRENT_PR_COMMAND && cmdModuleSettings.githubPrManager.enabled) {
      try {
        await handleUntrackCurrentPr();
      }
      catch (error: unknown) {
        console.error("Failed to untrack current PR from shortcut:", error);
      }

      return;
    }

    if (command === COPY_CURRENT_URL_COMMAND && cmdModuleSettings.urlCopyShortcut.enabled) {
      try {
        await handleCopyCurrentUrlShortcut();
      }
      catch (error: unknown) {
        console.error("Failed to copy current URL from shortcut:", error);
      }
    }
  });

  extensionApi?.webNavigation?.onCompleted?.addListener(async (details: WebNavigationDetailsLike) => {
    if (details.frameId !== 0 || details.tabId < 0) {
      return;
    }

    const navModuleSettings = await getModuleSettings();
    if (!navModuleSettings.githubPrManager.enabled) {
      return;
    }

    const prUrl = normalizePrUrl(details.url);
    if (!prUrl) {
      return;
    }

    const trackedPrs = await getTrackedPrs();
    if (!trackedPrs[prUrl]) {
      return;
    }

    await sendScanRequestToTab(details.tabId, prUrl);
  });

  extensionApi?.tabs?.onRemoved?.addListener((tabId: number) => {
    handlePersistentHomeTabRemoved(tabId).catch((error: unknown) => {
      console.error("Failed to restore persistent home tab:", error);
    });
  });
});
