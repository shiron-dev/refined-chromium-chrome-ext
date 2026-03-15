import { describe, expect, it } from "vitest";
import {
  applyPrEvents,
  isConversationView,
  normalizePrUrl,
} from "../../utils/background-utils";

describe("background-utils", () => {
  describe("normalizePrUrl", () => {
    it("should normalize GitHub PR URLs", () => {
      const url = "https://github.com/owner/repo/pull/123";
      expect(normalizePrUrl(url)).toBe("https://github.com/owner/repo/pull/123");
    });

    it("should extract PR URL with additional paths", () => {
      const url = "https://github.com/owner/repo/pull/123/files";
      expect(normalizePrUrl(url)).toBe("https://github.com/owner/repo/pull/123");
    });

    it("should return null for non-GitHub URLs", () => {
      expect(normalizePrUrl("https://gitlab.com/owner/repo/pull/123")).toBeNull();
    });

    it("should return null for non-PR GitHub URLs", () => {
      expect(normalizePrUrl("https://github.com/owner/repo")).toBeNull();
    });

    it("should return null for empty input", () => {
      expect(normalizePrUrl("")).toBeNull();
      expect(normalizePrUrl(undefined)).toBeNull();
    });

    it("should handle invalid URLs", () => {
      expect(normalizePrUrl("not a url")).toBeNull();
    });
  });

  describe("isConversationView", () => {
    it("should detect conversation view URLs", () => {
      const url = "https://github.com/owner/repo/pull/123";
      expect(isConversationView(url)).toBe(true);
    });

    it("should detect conversation view with trailing slash", () => {
      const url = "https://github.com/owner/repo/pull/123/";
      expect(isConversationView(url)).toBe(true);
    });

    it("should not detect files view", () => {
      const url = "https://github.com/owner/repo/pull/123/files";
      expect(isConversationView(url)).toBe(false);
    });

    it("should not detect commits view", () => {
      const url = "https://github.com/owner/repo/pull/123/commits";
      expect(isConversationView(url)).toBe(false);
    });

    it("should return false for empty input", () => {
      expect(isConversationView("")).toBe(false);
      expect(isConversationView(undefined)).toBe(false);
    });
  });

  describe("applyPrEvents", () => {
    it("should return working state by default", () => {
      expect(applyPrEvents([])).toBe("working");
    });

    it("should transition to reviewing on review_requested", () => {
      expect(applyPrEvents(["review_requested"])).toBe("reviewing");
    });

    it("should transition to merge_waiting on approved", () => {
      expect(applyPrEvents(["approved"])).toBe("merge_waiting");
    });

    it("should transition to merged on merged", () => {
      expect(applyPrEvents(["merged"])).toBe("merged");
    });

    it("should transition from merge_waiting to working on commented", () => {
      expect(applyPrEvents(["approved", "commented"])).toBe("working");
    });

    it("should handle multiple events in sequence", () => {
      expect(applyPrEvents(["review_requested", "approved"])).toBe("merge_waiting");
    });

    it("should keep merged state", () => {
      expect(applyPrEvents(["review_requested", "merged", "commented"])).toBe("merged");
    });
  });
});
