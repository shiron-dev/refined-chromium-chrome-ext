type PrEvent = "review_requested" | "approved" | "commented" | "reviewed" | "changes_requested" | "merged";
type ReviewerStatus = "has_reviewers" | "no_reviewers" | "unknown";
type ApprovalStatus = "approved" | "not_approved" | "unknown";
type CommentStatus = "has_comments" | "no_comments" | "unknown";

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

interface ExtensionApiLike {
  runtime?: {
    onMessage?: {
      addListener: (callback: (message: ScanPrTimelineMessage) => void) => void
    }
    sendMessage: (message: unknown) => Promise<unknown>
  }
}

const SPACING_PATTERN = /\s+/g;
const REVIEW_REQUEST_PATTERNS = [
  /requested review from/,
  /requested a review from/,
  /review request(ed)?/,
];
const APPROVED_PATTERNS = [
  /approved these changes/,
  /approved$/,
  /approved this pull request/,
];
const REVIEWED_PATTERNS = [
  /reviewed/,
];
const COMMENTED_PATTERNS = [
  /left a comment/,
  /commented/,
  /left review comments/,
];
const CHANGES_REQUESTED_PATTERNS = [
  /requested changes/,
  /request(ed)? changes?/,
];
const MERGED_PATTERNS = [
  /merged this pull request/,
  /merged commit/,
];
const NO_REVIEWS_PATTERN = /no reviews?/;
const APPROVED_CHANGES_PATTERN = /approved these changes/;
const REVIEW_COMMENTS_PATTERN = /left review comments?/;
const AWAITING_REVIEW_PATTERN = /awaiting requested review from/;
const BOT_SUFFIX_PATTERN = /\[bot\]$/;
const PR_NUMBER_SUFFIX_PATTERN = /\s*#\d+\s*$/u;

const extensionApi = (globalThis as { chrome?: ExtensionApiLike }).chrome;

function normalizeText(raw: string): string {
  return raw.replace(SPACING_PATTERN, " ").trim().toLowerCase();
}

function isBotAccountName(name: string): boolean {
  return BOT_SUFFIX_PATTERN.test(name.trim().toLowerCase());
}

function isBotTimelineItem(item: HTMLElement): boolean {
  if (item.querySelector("[href*='[bot]'], [data-hovercard-url*='[bot]']")) {
    return true;
  }

  const labelTexts = Array.from(item.querySelectorAll<HTMLElement>(".Label--secondary, .IssueLabel"), node => normalizeText(node.textContent || ""));
  return labelTexts.includes("bot");
}

function isBotReviewStatusTooltip(reviewersSection: HTMLElement, tooltip: HTMLElement): boolean {
  const statusAnchorId = tooltip.getAttribute("for");
  if (!statusAnchorId) {
    return false;
  }

  const anchor = reviewersSection.querySelector<HTMLElement>(`#${statusAnchorId}`);
  if (!anchor) {
    return false;
  }

  const reviewerContainer = anchor.closest("p, li, .d-flex, .discussion-sidebar-item");
  const assigneeName = reviewerContainer
    ?.querySelector<HTMLElement>("[data-assignee-name]")
    ?.getAttribute("data-assignee-name");

  if (assigneeName && isBotAccountName(assigneeName)) {
    return true;
  }

  const reviewerText = normalizeText(reviewerContainer?.textContent || "");
  return reviewerText.includes("[bot]");
}

function detectEventFromText(text: string): PrEvent | null {
  if (MERGED_PATTERNS.some(pattern => pattern.test(text))) {
    return "merged";
  }

  if (CHANGES_REQUESTED_PATTERNS.some(pattern => pattern.test(text))) {
    return "changes_requested";
  }

  if (REVIEWED_PATTERNS.some(pattern => pattern.test(text))) {
    return "reviewed";
  }

  if (REVIEW_REQUEST_PATTERNS.some(pattern => pattern.test(text))) {
    return "review_requested";
  }

  if (APPROVED_PATTERNS.some(pattern => pattern.test(text))) {
    return "approved";
  }

  if (COMMENTED_PATTERNS.some(pattern => pattern.test(text))) {
    return "commented";
  }

  return null;
}

function getSidebarReviewerStatus(): ReviewerStatus {
  const reviewersSection = document.querySelector<HTMLElement>(
    ".discussion-sidebar-item[data-channel-event-name='reviewers_updated'], .discussion-sidebar-item[data-url*='pull_requests%2Fsidebar%2Fshow%2Freviewers']",
  ) ?? document.querySelector<HTMLElement>("form[aria-label='Select reviewers']")?.closest(".discussion-sidebar-item") as HTMLElement | null;

  if (!reviewersSection) {
    return "unknown";
  }

  const hasAwaitingButton = [...reviewersSection.querySelectorAll<HTMLElement>("button[id^='awaiting-review-']")].some((button) => {
    const reviewerContainer = button.closest("p, li, .d-flex, .discussion-sidebar-item");
    const assigneeName = reviewerContainer
      ?.querySelector<HTMLElement>("[data-assignee-name]")
      ?.getAttribute("data-assignee-name");
    if (assigneeName && isBotAccountName(assigneeName)) {
      return false;
    }

    return !normalizeText(reviewerContainer?.textContent || "").includes("[bot]");
  });
  const hasAwaitingTooltip = [...reviewersSection.querySelectorAll<HTMLElement>("tool-tip[for^='awaiting-review-']")].some((tooltip) => {
    const text = normalizeText(tooltip.textContent || "");
    return AWAITING_REVIEW_PATTERN.test(text) && !isBotReviewStatusTooltip(reviewersSection, tooltip);
  });

  if (hasAwaitingButton || hasAwaitingTooltip) {
    return "has_reviewers";
  }

  const bodyText = normalizeText(reviewersSection.textContent || "");
  if (!bodyText) {
    return "unknown";
  }

  if (NO_REVIEWS_PATTERN.test(bodyText)) {
    return "no_reviewers";
  }

  // From the provided HTML diffs, reviewer markers are explicit. If markers are absent,
  // treat as no reviewers to avoid stale review-request history false positives.
  return "no_reviewers";
}

function getSidebarApprovalStatus(): ApprovalStatus {
  const reviewersSection = document.querySelector<HTMLElement>(
    ".discussion-sidebar-item[data-channel-event-name='reviewers_updated'], .discussion-sidebar-item[data-url*='pull_requests%2Fsidebar%2Fshow%2Freviewers']",
  ) ?? document.querySelector<HTMLElement>("form[aria-label='Select reviewers']")?.closest(".discussion-sidebar-item") as HTMLElement | null;

  if (!reviewersSection) {
    return "unknown";
  }

  const reviewStatusTooltips = [...reviewersSection.querySelectorAll<HTMLElement>("tool-tip[for^='review-status-']")];
  const approvedTooltips = reviewStatusTooltips.filter((tooltip) => {
    if (isBotReviewStatusTooltip(reviewersSection, tooltip)) {
      return false;
    }

    const text = normalizeText(tooltip.textContent || "");
    return APPROVED_CHANGES_PATTERN.test(text);
  });
  if (approvedTooltips.length > 0) {
    return "approved";
  }

  const hasApprovedStatusAnchor = Boolean(
    reviewersSection.querySelector("a[id^='review-status-'] .octicon-check.color-fg-success"),
  );
  if (hasApprovedStatusAnchor) {
    return "approved";
  }

  const bodyText = normalizeText(reviewersSection.textContent || "");
  if (!bodyText) {
    return "unknown";
  }

  if (NO_REVIEWS_PATTERN.test(bodyText)) {
    return "not_approved";
  }

  if (reviewersSection.querySelector("button[id^='awaiting-review-'], .reviewers-status-icon")) {
    return "not_approved";
  }

  return "unknown";
}

function getSidebarCommentStatus(): CommentStatus {
  const reviewersSection = document.querySelector<HTMLElement>(
    ".discussion-sidebar-item[data-channel-event-name='reviewers_updated'], .discussion-sidebar-item[data-url*='pull_requests%2Fsidebar%2Fshow%2Freviewers']",
  ) ?? document.querySelector<HTMLElement>("form[aria-label='Select reviewers']")?.closest(".discussion-sidebar-item") as HTMLElement | null;

  if (!reviewersSection) {
    return "unknown";
  }

  const commentTooltips = [...reviewersSection.querySelectorAll<HTMLElement>("tool-tip[for^='review-status-']")].filter((tooltip) => {
    if (isBotReviewStatusTooltip(reviewersSection, tooltip)) {
      return false;
    }

    const text = normalizeText(tooltip.textContent || "");
    return REVIEW_COMMENTS_PATTERN.test(text);
  });

  if (commentTooltips.length > 0) {
    return "has_comments";
  }

  return "no_comments";
}

function collectTimelineEvents(): PrEvent[] {
  const timelineItems = [...document.querySelectorAll<HTMLElement>(".js-timeline-item, .TimelineItem")];

  const events: PrEvent[] = [];

  for (const item of timelineItems) {
    if (isBotTimelineItem(item)) {
      continue;
    }

    const text = normalizeText(item.textContent || "");
    if (!text) {
      continue;
    }

    const event = detectEventFromText(text);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

function getPrTitle(): string | null {
  const titleNode = document.querySelector<HTMLElement>("bdi.js-issue-title, h1 .markdown-title");
  const titleText = titleNode?.textContent?.trim();
  if (titleText) {
    return titleText;
  }

  const docTitle = document.title.replace(PR_NUMBER_SUFFIX_PATTERN, "").trim();
  return docTitle || null;
}

export default defineContentScript({
  matches: ["https://github.com/*"],
  runAt: "document_end",
  main() {
    extensionApi?.runtime?.onMessage?.addListener((message: ScanPrTimelineMessage) => {
      if (message.type !== "SCAN_PR_TIMELINE") {
        return;
      }

      const response: PrTimelineScannedMessage = {
        type: "PR_TIMELINE_SCANNED",
        prUrl: message.prUrl,
        events: collectTimelineEvents(),
        reviewerStatus: getSidebarReviewerStatus(),
        approvalStatus: getSidebarApprovalStatus(),
        commentStatus: getSidebarCommentStatus(),
        prTitle: getPrTitle(),
      };

      extensionApi?.runtime?.sendMessage(response).catch((error: unknown) => {
        console.warn("Failed to return PR timeline scan:", error);
      });
    });
  },
});
