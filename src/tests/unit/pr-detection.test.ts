import { describe, expect, it } from "vitest";
import {
  collectTimelineEvents,
  detectEventFromText,
  getPrTitle,
  getSidebarReviewStatuses,
  isBotAccountName,
  normalizeText,
} from "../../utils/pr-detection";

describe("pr-detection", () => {
  describe("normalizeText", () => {
    it("should normalize whitespace and lowercase", () => {
      expect(normalizeText("  Hello   World  ")).toBe("hello world");
    });

    it("should trim and lowercase", () => {
      expect(normalizeText("APPROVED THESE CHANGES")).toBe("approved these changes");
    });

    it("should handle empty strings", () => {
      expect(normalizeText("")).toBe("");
    });
  });

  describe("isBotAccountName", () => {
    it("should detect bot accounts", () => {
      expect(isBotAccountName("dependabot[bot]")).toBe(true);
      expect(isBotAccountName("renovate[bot]")).toBe(true);
    });

    it("should not detect non-bot accounts", () => {
      expect(isBotAccountName("john")).toBe(false);
      expect(isBotAccountName("jane-doe")).toBe(false);
    });
  });

  describe("detectEventFromText", () => {
    it("should detect merged events", () => {
      expect(detectEventFromText("merged this pull request")).toBe("merged");
      expect(detectEventFromText("merged commit abc123")).toBe("merged");
    });

    it("should detect changes_requested events", () => {
      expect(detectEventFromText("requested changes")).toBe("changes_requested");
    });

    it("should detect review_requested events", () => {
      expect(detectEventFromText("requested review from john")).toBe("review_requested");
    });

    it("should detect approved events", () => {
      expect(detectEventFromText("approved these changes")).toBe("approved");
      expect(detectEventFromText("approved")).toBe("approved");
    });

    it("should detect commented events", () => {
      expect(detectEventFromText("left a comment")).toBe("commented");
      expect(detectEventFromText("commented")).toBe("commented");
    });

    it("should detect reviewed events", () => {
      expect(detectEventFromText("reviewed")).toBe("reviewed");
    });

    it("should return null for unknown events", () => {
      expect(detectEventFromText("some random text")).toBeNull();
    });
  });

  describe("collectTimelineEvents", () => {
    it("should return empty array when no timeline items exist", () => {
      const events = collectTimelineEvents();
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe("getPrTitle", () => {
    it("should return null when no title is found", () => {
      const title = getPrTitle();
      expect(title).toBeNull();
    });
  });

  describe("getSidebarReviewStatuses", () => {
    it("should return status object with unknown defaults", () => {
      const statuses = getSidebarReviewStatuses();
      expect(statuses).toHaveProperty("reviewerStatus");
      expect(statuses).toHaveProperty("approvalStatus");
      expect(statuses).toHaveProperty("commentStatus");
      expect(statuses.reviewerStatus).toBe("unknown");
      expect(statuses.approvalStatus).toBe("unknown");
      expect(statuses.commentStatus).toBe("unknown");
    });
  });
});
