import { describe, expect, it } from "vitest";
import {
  analyticsOnboardingGuide,
  editorOnboardingGuide,
  workspaceOnboardingGuide,
} from "@/components/onboarding/guides";

describe("page onboarding guides", () => {
  it("exposes the three opt-in guides with accessible names", () => {
    expect(workspaceOnboardingGuide.ariaLabel).toBe("Open workspace guide");
    expect(editorOnboardingGuide.ariaLabel).toBe("Open survey editor guide");
    expect(analyticsOnboardingGuide.ariaLabel).toBe("Open analytics guide");
  });

  it("keeps workspace copy aligned with the current list, which hides archived surveys", () => {
    const bodies = workspaceOnboardingGuide.sections.map((section) => section.body).join(" ");
    expect(bodies).toContain("Archived surveys are hidden from this list");
    expect(bodies).not.toContain("archived instruments together");
  });

  it("does not claim core profile axes are preselected on this branch", () => {
    const editorText = [
      editorOnboardingGuide.intro,
      ...editorOnboardingGuide.sections.map((section) => section.body),
    ].join(" ");
    expect(editorText).not.toContain("included in generation by default");
  });

  it("covers the four Analytics V2 surfaces without defensive caveats", () => {
    expect(analyticsOnboardingGuide.sections.map((section) => section.title)).toEqual([
      "Overview",
      "Segment Explorer",
      "Compare",
      "Instrument Health",
      "Working across the tabs",
    ]);
    const text = [
      analyticsOnboardingGuide.intro,
      ...analyticsOnboardingGuide.sections.map((section) => section.body),
    ].join(" ");
    expect(text).not.toMatch(/does not make causal|do not establish causes|not as a substitute/i);
  });
});
