export type PrEvent = "review_requested" | "approved" | "commented" | "reviewed" | "changes_requested" | "merged";

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
const BOT_SUFFIX_PATTERN = /\[bot\]$/;

export function normalizeText(raw: string): string {
  return raw.replace(SPACING_PATTERN, " ").trim().toLowerCase();
}

export function isBotAccountName(name: string): boolean {
  return BOT_SUFFIX_PATTERN.test(name.trim().toLowerCase());
}

export function isBotTimelineItem(item: HTMLElement): boolean {
  if (item.querySelector("[href*='[bot]'], [data-hovercard-url*='[bot]']")) {
    return true;
  }

  const labelTexts = Array.from(
    item.querySelectorAll<HTMLElement>(".Label--secondary, .IssueLabel"),
    node => normalizeText(node.textContent || ""),
  );
  return labelTexts.includes("bot");
}

export function detectEventFromText(text: string): PrEvent | null {
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

export function collectTimelineEvents(doc: Document): PrEvent[] {
  const timelineItems = [...doc.querySelectorAll<HTMLElement>(".js-timeline-item, .TimelineItem")];

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
