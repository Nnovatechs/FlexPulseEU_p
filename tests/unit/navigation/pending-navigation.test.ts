import { describe, expect, it } from "vitest";
import { appRoutes } from "@/lib/config/routes";
import { getPendingNavigationCopy } from "@/lib/navigation/pending-navigation";

describe("getPendingNavigationCopy", () => {
  it("uses the workspace copy for dashboard and surveys list", () => {
    expect(getPendingNavigationCopy(appRoutes.dashboard)).toEqual({
      title: "Opening workspace",
      description: "Loading your surveys…",
    });
    expect(getPendingNavigationCopy(`${appRoutes.surveys}?view=all`)).toEqual({
      title: "Opening workspace",
      description: "Loading your surveys…",
    });
  });

  it("uses a create-survey copy for the new survey page", () => {
    expect(getPendingNavigationCopy(appRoutes.surveyNew)).toEqual({
      title: "Opening new survey",
      description: "Getting the form ready…",
    });
  });

  it("uses analytics copy for both analytics surfaces", () => {
    expect(getPendingNavigationCopy(appRoutes.surveyAnalytics("abc"))).toMatchObject({
      title: "Opening analytics",
    });
    expect(getPendingNavigationCopy(appRoutes.surveyAnalyticsV2("abc"))).toMatchObject({
      title: "Opening analytics",
    });
  });

  it("uses opening-survey copy for detail and edit", () => {
    expect(getPendingNavigationCopy(appRoutes.surveyDetail("abc"))).toEqual({
      title: "Opening survey",
      description: "Loading the survey…",
    });
    expect(getPendingNavigationCopy(appRoutes.surveyEdit("abc"))).toEqual({
      title: "Opening survey",
      description: "Loading the editor…",
    });
  });

  it("does not wrap unrelated routes", () => {
    expect(getPendingNavigationCopy(appRoutes.accountApi)).toBeNull();
    expect(getPendingNavigationCopy(appRoutes.privacySettings)).toBeNull();
  });
});
