import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  collectTimelineEvents,
  detectEventFromText,
  isBotAccountName,
  isBotTimelineItem,
  normalizeText,
} from "../../utils/pr-detection";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(
    resolve(__dirname, "../../content_scripts/tests/fixtures", name),
    "utf-8",
  );
}

describe("normalizeText", () => {
  it("collapses multiple whitespace into single space", () => {
    expect(normalizeText("foo   bar")).toBe("foo bar");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
  });

  it("converts to lowercase", () => {
    expect(normalizeText("Foo BAR")).toBe("foo bar");
  });

  it("handles newlines and tabs", () => {
    expect(normalizeText("foo\n\tbar")).toBe("foo bar");
  });
});

describe("isBotAccountName", () => {
  it("detects [bot] suffix", () => {
    expect(isBotAccountName("dependabot[bot]")).toBe(true);
  });

  it("detects [bot] suffix case-insensitively", () => {
    expect(isBotAccountName("SomeBot[bot]")).toBe(true);
  });

  it("returns false for regular user names", () => {
    expect(isBotAccountName("shiron")).toBe(false);
  });

  it("returns false for names that contain bot but not as suffix", () => {
    expect(isBotAccountName("[bot]user")).toBe(false);
  });
});

describe("detectEventFromText", () => {
  it("detects merged", () => {
    expect(detectEventFromText("merged this pull request")).toBe("merged");
  });

  it("detects merged commit", () => {
    expect(detectEventFromText("merged commit abc123")).toBe("merged");
  });

  it("detects changes_requested", () => {
    expect(detectEventFromText("requested changes")).toBe("changes_requested");
  });

  it("detects reviewed", () => {
    expect(detectEventFromText("reviewed")).toBe("reviewed");
  });

  it("detects review_requested (requested review from)", () => {
    expect(detectEventFromText("requested review from john")).toBe("review_requested");
  });

  it("detects review_requested (requested a review from)", () => {
    expect(detectEventFromText("requested a review from jane")).toBe("review_requested");
  });

  it("detects approved (approved these changes)", () => {
    expect(detectEventFromText("approved these changes")).toBe("approved");
  });

  it("detects approved (approved this pull request)", () => {
    expect(detectEventFromText("approved this pull request")).toBe("approved");
  });

  it("detects commented (left a comment)", () => {
    expect(detectEventFromText("left a comment")).toBe("commented");
  });

  it("detects commented (commented)", () => {
    expect(detectEventFromText("commented")).toBe("commented");
  });

  it("detects commented (left review comments)", () => {
    expect(detectEventFromText("left review comments")).toBe("commented");
  });

  it("returns null for unknown text", () => {
    expect(detectEventFromText("opened this pull request")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectEventFromText("")).toBeNull();
  });

  it("merged takes priority over reviewed", () => {
    expect(detectEventFromText("merged this pull request reviewed")).toBe("merged");
  });

  it("changes_requested takes priority over reviewed", () => {
    expect(detectEventFromText("requested changes reviewed")).toBe("changes_requested");
  });
});

describe("isBotTimelineItem", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("returns true when element has href with [bot]", () => {
    container.innerHTML = `<a href="/apps/dependabot[bot]">dependabot</a>`;
    expect(isBotTimelineItem(container)).toBe(true);
  });

  it("returns true when element has data-hovercard-url with [bot]", () => {
    container.innerHTML = `<span data-hovercard-url="/users/renovate[bot]/hovercard">renovate</span>`;
    expect(isBotTimelineItem(container)).toBe(true);
  });

  it("returns true when Label--secondary contains 'bot'", () => {
    container.innerHTML = `<span class="Label--secondary">bot</span>`;
    expect(isBotTimelineItem(container)).toBe(true);
  });

  it("returns true when IssueLabel contains 'bot'", () => {
    container.innerHTML = `<span class="IssueLabel">bot</span>`;
    expect(isBotTimelineItem(container)).toBe(true);
  });

  it("returns false for regular user elements", () => {
    container.innerHTML = `<a href="/shiron">shiron approved these changes</a>`;
    expect(isBotTimelineItem(container)).toBe(false);
  });
});

describe("collectTimelineEvents with HTML fixtures", () => {
  let parser: DOMParser;

  beforeEach(() => {
    parser = new DOMParser();
  });

  it("github-pr-normal: no user events (PR just opened)", () => {
    const html = loadFixture("github-pr-normal.html");
    const doc = parser.parseFromString(html, "text/html");
    const events = collectTimelineEvents(doc);
    expect(events).toHaveLength(0);
  });

  it("github-pr-reviewer: no user events (reviewer assigned, not yet reviewed)", () => {
    const html = loadFixture("github-pr-reviewer.html");
    const doc = parser.parseFromString(html, "text/html");
    const events = collectTimelineEvents(doc);
    expect(events).toHaveLength(0);
  });

  it("github-pr-comment: user reviewed events only (no bot events)", () => {
    const html = loadFixture("github-pr-comment.html");
    const doc = parser.parseFromString(html, "text/html");
    const events = collectTimelineEvents(doc);
    expect(events).toEqual(["reviewed", "reviewed"]);
  });

  it("github-pr-change: user reviewed and changes_requested events (no bot events)", () => {
    const html = loadFixture("github-pr-change.html");
    const doc = parser.parseFromString(html, "text/html");
    const events = collectTimelineEvents(doc);
    expect(events).toEqual(["reviewed", "reviewed", "changes_requested", "changes_requested"]);
  });

  it("github-pr-bot-approve: bot events are filtered out, only user events remain", () => {
    const html = loadFixture("github-pr-bot-approve.html");
    const doc = parser.parseFromString(html, "text/html");
    const events = collectTimelineEvents(doc);
    expect(events).toEqual(["reviewed", "reviewed", "changes_requested", "changes_requested"]);
  });

  it("github-pr-bot-comment: bot events are filtered out, only user events remain", () => {
    const html = loadFixture("github-pr-bot-comment.html");
    const doc = parser.parseFromString(html, "text/html");
    const events = collectTimelineEvents(doc);
    expect(events).toEqual(["reviewed", "reviewed", "changes_requested", "changes_requested"]);
  });

  it("github-pr-bot-hu-approve: bot events are filtered, human events preserved", () => {
    const html = loadFixture("github-pr-bot-hu-approve.html");
    const doc = parser.parseFromString(html, "text/html");
    const events = collectTimelineEvents(doc);
    expect(events).toEqual([
      "reviewed", "reviewed", "changes_requested", "changes_requested", "reviewed", "reviewed",
    ]);
  });

  it("github-pr-comment-and-comment: multiple user review/changes events", () => {
    const html = loadFixture("github-pr-comment-and-comment.html");
    const doc = parser.parseFromString(html, "text/html");
    const events = collectTimelineEvents(doc);
    expect(events).toEqual([
      "reviewed", "reviewed", "changes_requested", "changes_requested",
      "reviewed", "reviewed", "reviewed", "reviewed", "reviewed", "reviewed",
      "changes_requested", "changes_requested", "reviewed", "reviewed",
      "reviewed", "reviewed", "reviewed", "reviewed",
    ]);
  });

  it("github-pr-comment-and-request: user review/changes_requested events", () => {
    const html = loadFixture("github-pr-comment-and-request.html");
    const doc = parser.parseFromString(html, "text/html");
    const events = collectTimelineEvents(doc);
    expect(events).toEqual([
      "reviewed", "reviewed", "changes_requested", "changes_requested",
      "reviewed", "reviewed", "reviewed", "reviewed", "reviewed", "reviewed",
      "changes_requested", "changes_requested",
    ]);
  });

  it("github-pr-comment-and-review: user review events", () => {
    const html = loadFixture("github-pr-comment-and-review.html");
    const doc = parser.parseFromString(html, "text/html");
    const events = collectTimelineEvents(doc);
    expect(events).toEqual([
      "reviewed", "reviewed", "changes_requested", "changes_requested",
      "reviewed", "reviewed", "reviewed", "reviewed",
    ]);
  });
});
