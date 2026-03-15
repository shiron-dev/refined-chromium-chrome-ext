export type PrState = "working" | "reviewing" | "merge_waiting" | "merged";
export type BackgroundPrEvent = "review_requested" | "approved" | "commented" | "merged";

const GITHUB_PR_URL_PATTERN = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/.*)?$/;
const CONVERSATION_VIEW_PATTERN = /^\/[^/]+\/[^/]+\/pull\/\d+\/?$/;

export function normalizePrUrl(rawUrl?: string): string | null {
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

export function isConversationView(rawUrl?: string): boolean {
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

  return CONVERSATION_VIEW_PATTERN.test(parsed.pathname);
}

export function applyPrEvents(events: BackgroundPrEvent[]): PrState {
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
