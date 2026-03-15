import type { BackgroundMessageHandler, CommandHandler, NavigationHandler } from "../../core/types";
import type { PrState } from "../../utils/background-utils";
import type { PrEvent } from "../../utils/pr-detection";
import type { PopupStateResponse, ReloadTrackedPrsResponse, UntrackResponse } from "./popup/types";
import { createModuleStorage } from "../../core/storage";
import {
  applyPrEvents,
  isConversationView,
  normalizePrUrl,

} from "../../utils/background-utils";
import { extensionApi, getCurrentActiveTab } from "../../utils/extension-api";
import type { BrowserTab } from "../../utils/extension-api";

type ReviewerStatus = "has_reviewers" | "no_reviewers" | "unknown";
type ApprovalStatus = "approved" | "not_approved" | "unknown";
type CommentStatus = "has_comments" | "no_comments" | "unknown";

interface TrackedPrEntry {
  state: PrState
  updatedAt: number
  title: string | null
}

type TabGroupColor = "grey" | "blue" | "green" | "purple";

const storage = createModuleStorage("githubPr");

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

async function getTrackedPrs(): Promise<Record<string, TrackedPrEntry>> {
  const data = await storage.get<Record<string, TrackedPrEntry>>("trackedPrs");
  return data ?? {};
}

async function setTrackedPrs(trackedPrs: Record<string, TrackedPrEntry>): Promise<void> {
  await storage.set("trackedPrs", trackedPrs);
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

async function sendScanRequestToTab(tabId: number, prUrl: string): Promise<void> {
  if (!extensionApi?.tabs) {
    return;
  }

  try {
    await extensionApi.tabs.sendMessage(tabId, {
      moduleId: "githubPr",
      action: "scanTimeline",
      payload: { prUrl },
    });
  }
  catch (error: unknown) {
    console.warn("Failed to send scan request:", error);
  }
}

export const backgroundHandlers: Record<string, BackgroundMessageHandler> = {
  registerCurrent: async () => {
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
  },

  getPopupState: async (): Promise<PopupStateResponse> => {
    const trackedPrs = await getTrackedPrs();
    const tab = await getCurrentActiveTab();
    const currentPrUrl = normalizePrUrl(tab?.url);
    const allTabs = await extensionApi?.tabs?.query({}) ?? [];

    const conversationTabCounts = (allTabs as any[]).reduce<Record<string, number>>((acc: Record<string, number>, currentTab: any) => {
      const prUrl = normalizePrUrl(currentTab.url);
      if (!prUrl) {
        return acc;
      }

      if (isConversationView(currentTab.url)) {
        acc[prUrl] = (acc[prUrl] ?? 0) + 1;
      }
      return acc;
    }, {});

    const otherViewTabCounts = (allTabs as any[]).reduce<Record<string, number>>((acc: Record<string, number>, currentTab: any) => {
      const prUrl = normalizePrUrl(currentTab.url);
      if (!prUrl) {
        return acc;
      }

      if (!isConversationView(currentTab.url)) {
        acc[prUrl] = (acc[prUrl] ?? 0) + 1;
      }
      return acc;
    }, {});

    const openTabTitles = (allTabs as any[]).reduce<Record<string, string | null>>((acc: Record<string, string | null>, currentTab: any) => {
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
  },

  untrackCurrent: async (): Promise<UntrackResponse> => {
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
  },

  reloadTrackedPrs: async (): Promise<ReloadTrackedPrsResponse> => {
    if (!extensionApi?.tabs) {
      return { ok: false, reloadedTabCount: 0 };
    }

    const trackedPrs = await getTrackedPrs();
    const trackedPrUrls = new Set(Object.keys(trackedPrs));
    if (trackedPrUrls.size === 0) {
      return { ok: true, reloadedTabCount: 0 };
    }

    const tabs = await extensionApi.tabs.query({});
    const targetTabIds = (tabs as any[])
      .filter((tab: BrowserTab) => {
        const prUrl = normalizePrUrl(tab.url);
        return Boolean(prUrl && trackedPrUrls.has(prUrl));
      })
      .map((tab: BrowserTab) => tab.id)
      .filter((tabId: any): tabId is number => tabId !== undefined);

    await Promise.all(
      targetTabIds.map(async (tabId: number) => {
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
  },

  activatePrTab: async (_payload: unknown, _sender: unknown, _sendResponse: unknown) => {
    const payload = _payload as { prUrl: string } | undefined;
    if (!payload?.prUrl) {
      return;
    }

    if (!extensionApi?.tabs) {
      return { ok: false };
    }

    const tabs = await extensionApi.tabs.query({});
    const prTabs = tabs.filter((tab: BrowserTab) => normalizePrUrl(tab.url) === payload.prUrl);

    if (prTabs.length === 0) {
      return { ok: false };
    }

    let targetTab = prTabs.find((tab: BrowserTab) => isConversationView(tab.url));
    if (!targetTab) {
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
  },

  timelineScanned: async (_payload: unknown, sender: chrome.runtime.MessageSender) => {
    const payload = _payload as {
      events: PrEvent[]
      reviewerStatus: ReviewerStatus
      approvalStatus: ApprovalStatus
      commentStatus: CommentStatus
      prTitle: string | null
      prUrl: string
    } | undefined;

    if (!payload) {
      return;
    }

    const prUrl = normalizePrUrl(payload.prUrl);
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

    const eventsForState = payload.reviewerStatus === "no_reviewers"
      ? payload.events.filter((event: PrEvent) => event !== "review_requested")
      : payload.events;
    const eventsForApproval = payload.approvalStatus === "not_approved"
      ? eventsForState.filter((event: PrEvent) => event !== "approved")
      : eventsForState;
    const eventsForComment = payload.commentStatus === "no_comments"
      ? eventsForApproval.filter((event: PrEvent) => event !== "commented")
      : eventsForApproval;
    const approvedEvent: PrEvent = "approved";
    const eventsForResolvedState: PrEvent[] = payload.approvalStatus === "approved"
      ? [...eventsForComment, approvedEvent]
      : eventsForComment;
    let nextState = applyPrEvents(eventsForResolvedState as any);

    // Current sidebar statuses should win over historical timeline signals.
    if (payload.commentStatus === "has_comments" && nextState !== "merged") {
      nextState = "working";
    }
    else if (payload.approvalStatus === "approved" && nextState !== "merged") {
      nextState = "merge_waiting";
    }
    else if (payload.reviewerStatus === "has_reviewers" && nextState !== "merged") {
      nextState = "reviewing";
    }
    else if (payload.reviewerStatus === "no_reviewers" && nextState === "reviewing") {
      nextState = "working";
    }

    trackedPrs[prUrl] = {
      state: nextState,
      updatedAt: Date.now(),
      title: payload.prTitle ?? tracked.title ?? null,
    };

    await setTrackedPrs(trackedPrs);
    await moveTabToStateGroup(tabId, windowId, nextState);
  },
};

export const commandHandlers: CommandHandler[] = [
  {
    command: "register-current-pr",
    handler: async () => {
      await backgroundHandlers.registerCurrent({}, {}, () => {});
    },
  },
  {
    command: "untrack-current-pr",
    handler: async () => {
      await backgroundHandlers.untrackCurrent({}, {}, () => {});
    },
  },
];

export const navigationHandlers: NavigationHandler[] = [
  {
    handler: async (details) => {
      if (details.frameId !== 0 || details.tabId < 0) {
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
    },
  },
];
