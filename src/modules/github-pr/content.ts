import type { ContentMessageHandler } from "../../core/types";
import {
  collectTimelineEvents,
  getPrTitle,
  getSidebarReviewStatuses,
} from "../../utils/pr-detection";

export const contentHandlers: Record<string, ContentMessageHandler> = {
  scanTimeline: (_payload: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
    const payload = _payload as { prUrl: string } | undefined;
    const { reviewerStatus, approvalStatus, commentStatus } = getSidebarReviewStatuses();

    const response = {
      events: collectTimelineEvents(),
      reviewerStatus,
      approvalStatus,
      commentStatus,
      prTitle: getPrTitle(),
      prUrl: payload?.prUrl,
    };

    sendResponse(response);
    return false;
  },
};
