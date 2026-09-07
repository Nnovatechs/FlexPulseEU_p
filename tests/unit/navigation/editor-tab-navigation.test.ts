import { describe, expect, it } from "vitest";
import {
  getEditorTabPendingTitle,
  shouldShowEditorTabOverlay,
} from "@/lib/navigation/editor-tab-navigation";

describe("editor tab pending overlay", () => {
  it("uses a title for each editor tab", () => {
    expect(getEditorTabPendingTitle("configuration")).toBe("Loading configuration…");
    expect(getEditorTabPendingTitle("questions")).toBe("Loading questions…");
    expect(getEditorTabPendingTitle("review")).toBe("Loading review…");
    expect(getEditorTabPendingTitle("preview")).toBe("Loading preview…");
  });

  it("hides the overlay when no tab is pending or the active tab already matches", () => {
    expect(shouldShowEditorTabOverlay("configuration", null)).toBe(false);
    expect(shouldShowEditorTabOverlay("review", "review")).toBe(false);
    expect(shouldShowEditorTabOverlay("configuration", "questions")).toBe(true);
  });
});
