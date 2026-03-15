/**
 * Shared popup styles and UI state types
 */
import type { CSSProperties } from "react";

export const baseCardStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: 12,
  background: "#ffffff",
};

export interface UiStatus {
  tone: "neutral" | "success" | "warn"
  message: string
}

export function getStatusColor(tone: UiStatus["tone"]): string {
  if (tone === "success") {
    return "#166534";
  }

  if (tone === "warn") {
    return "#b45309";
  }

  return "#1f2937";
}
