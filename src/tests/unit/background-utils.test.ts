import { describe, expect, it } from "vitest";
import {
  applyPrEvents,
  isConversationView,
  normalizePrUrl,
} from "../../utils/background-utils";

describe("normalizePrUrl", () => {
  it("returns null for undefined input", () => {
    expect(normalizePrUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizePrUrl("")).toBeNull();
  });

  it("returns null for non-github URLs", () => {
    expect(normalizePrUrl("https://example.com/foo/bar/pull/1")).toBeNull();
  });

  it("returns null for github URLs that are not PRs", () => {
    expect(normalizePrUrl("https://github.com/owner/repo/issues/1")).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(normalizePrUrl("not-a-url")).toBeNull();
  });

  it("normalizes a PR conversation URL", () => {
    expect(normalizePrUrl("https://github.com/shiron/repo/pull/42")).toBe(
      "https://github.com/shiron/repo/pull/42",
    );
  });

  it("strips /files suffix from PR URL", () => {
    expect(normalizePrUrl("https://github.com/shiron/repo/pull/42/files")).toBe(
      "https://github.com/shiron/repo/pull/42",
    );
  });

  it("strips /commits suffix from PR URL", () => {
    expect(normalizePrUrl("https://github.com/shiron/repo/pull/42/commits")).toBe(
      "https://github.com/shiron/repo/pull/42",
    );
  });

  it("strips query string from PR URL", () => {
    expect(normalizePrUrl("https://github.com/shiron/repo/pull/42?foo=bar")).toBe(
      "https://github.com/shiron/repo/pull/42",
    );
  });

  it("handles URL with hash fragment", () => {
    expect(normalizePrUrl("https://github.com/shiron/repo/pull/42#issuecomment-123")).toBe(
      "https://github.com/shiron/repo/pull/42",
    );
  });
});

describe("isConversationView", () => {
  it("returns false for undefined input", () => {
    expect(isConversationView(undefined)).toBe(false);
  });

  it("returns false for non-github URLs", () => {
    expect(isConversationView("https://example.com/foo/bar/pull/1")).toBe(false);
  });

  it("returns false for non-PR github URLs", () => {
    expect(isConversationView("https://github.com/owner/repo/issues/1")).toBe(false);
  });

  it("returns true for PR conversation URL (no suffix)", () => {
    expect(isConversationView("https://github.com/shiron/repo/pull/42")).toBe(true);
  });

  it("returns false for PR files view", () => {
    expect(isConversationView("https://github.com/shiron/repo/pull/42/files")).toBe(false);
  });

  it("returns false for PR commits view", () => {
    expect(isConversationView("https://github.com/shiron/repo/pull/42/commits")).toBe(false);
  });

  it("returns true for PR URL with query string but no path suffix", () => {
    expect(isConversationView("https://github.com/shiron/repo/pull/42?foo=bar")).toBe(true);
  });
});

describe("applyPrEvents", () => {
  it("returns working for empty events", () => {
    expect(applyPrEvents([])).toBe("working");
  });

  it("transitions to reviewing on review_requested", () => {
    expect(applyPrEvents(["review_requested"])).toBe("reviewing");
  });

  it("transitions to merge_waiting on approved", () => {
    expect(applyPrEvents(["review_requested", "approved"])).toBe("merge_waiting");
  });

  it("transitions to merged on merged event", () => {
    expect(applyPrEvents(["review_requested", "approved", "merged"])).toBe("merged");
  });

  it("stays merged even after subsequent events", () => {
    expect(applyPrEvents(["merged", "review_requested"])).toBe("reviewing");
  });

  it("transitions from merge_waiting to working on commented", () => {
    expect(applyPrEvents(["review_requested", "approved", "commented"])).toBe("working");
  });

  it("commented does not affect working state", () => {
    expect(applyPrEvents(["commented"])).toBe("working");
  });

  it("commented does not affect reviewing state", () => {
    expect(applyPrEvents(["review_requested", "commented"])).toBe("reviewing");
  });

  it("handles full workflow: work → review → approve → comment → work", () => {
    expect(applyPrEvents(["review_requested", "approved", "commented"])).toBe("working");
  });

  it("handles re-review after approval", () => {
    expect(applyPrEvents(["review_requested", "approved", "commented", "review_requested"])).toBe("reviewing");
  });
});
