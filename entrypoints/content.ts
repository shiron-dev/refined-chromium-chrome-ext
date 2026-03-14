import type { PrEvent } from "../src/utils/pr-detection";
import {
  collectTimelineEvents as collectTimelineEventsFromDoc,
  isBotAccountName,
  normalizeText,

} from "../src/utils/pr-detection";

type ReviewerStatus = "has_reviewers" | "no_reviewers" | "unknown";
type ApprovalStatus = "approved" | "not_approved" | "unknown";
type CommentStatus = "has_comments" | "no_comments" | "unknown";

interface ScanPrTimelineMessage {
  type: "SCAN_PR_TIMELINE"
  prUrl: string
}

interface CopyCurrentUrlToClipboardMessage {
  type: "COPY_CURRENT_URL_TO_CLIPBOARD"
  url: string
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
      addListener: (
        callback: (
          message: ScanPrTimelineMessage | CopyCurrentUrlToClipboardMessage,
          sender: unknown,
          sendResponse: (response: unknown) => void,
        ) => boolean | void,
      ) => void
    }
    sendMessage: (message: unknown) => Promise<unknown>
  }
}

const NO_REVIEWS_PATTERN = /no reviews?/;
const APPROVED_CHANGES_PATTERN = /approved these changes/;
const REVIEW_COMMENTS_PATTERN = /left review comments?/;
const AWAITING_REVIEW_PATTERN = /awaiting requested review from/;
const PR_NUMBER_SUFFIX_PATTERN = /\s*#\d+\s*$/u;
const COPY_TOAST_ID = "refined-chromium-copy-toast";
const COPY_TOAST_DURATION_MS = 1600;

const extensionApi = (globalThis as { chrome?: ExtensionApiLike }).chrome;
let copyToastTimer: number | undefined;

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
  return collectTimelineEventsFromDoc(document);
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

function fallbackCopyTextToClipboard(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

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
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    }
    catch {
      // Fall back to execCommand to handle pages where Clipboard API is blocked.
    }
  }

  return fallbackCopyTextToClipboard(text);
}

function showCopyToast(message: string, tone: "success" | "warn"): void {
  const existing = document.getElementById(COPY_TOAST_ID);
  existing?.remove();

  const toast = document.createElement("div");
  toast.id = COPY_TOAST_ID;
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
  toast.style.boxShadow = "0 12px 30px rgba(15, 23, 42, 0.18)";
  toast.style.color = "#ffffff";
  toast.style.background = tone === "success" ? "#111827" : "#b45309";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(-6px)";
  toast.style.transition = "opacity 160ms ease, transform 160ms ease";

  document.body.append(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  if (copyToastTimer !== undefined) {
    window.clearTimeout(copyToastTimer);
  }

  copyToastTimer = window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    window.setTimeout(() => toast.remove(), 180);
  }, COPY_TOAST_DURATION_MS);
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_end",
  main() {
    extensionApi?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
      if (message.type === "COPY_CURRENT_URL_TO_CLIPBOARD") {
        copyTextToClipboard(message.url)
          .then((ok) => {
            showCopyToast(ok ? "URLをコピーしました" : "URLのコピーに失敗しました", ok ? "success" : "warn");
            sendResponse({
              ok,
              reason: ok ? undefined : "copy_failed",
            });
          })
          .catch(() => {
            showCopyToast("URLのコピーに失敗しました", "warn");
            sendResponse({ ok: false, reason: "copy_failed" });
          });

        return true;
      }

      if (message.type !== "SCAN_PR_TIMELINE") {
        return false;
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

      return false;
    });
  },
});
