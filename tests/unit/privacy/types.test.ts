import { describe, expect, it } from "vitest";
import {
  buildSurveyLegalSnapshot,
  isOwnerLegalProfileComplete,
  type OwnerLegalProfile,
} from "@/features/privacy/types";

const completeProfile: OwnerLegalProfile = {
  userId: "owner-1",
  controllerName: "Example Research Institute",
  controllerCountry: "Spain",
  contactEmail: "research@example.eu",
  privacyEmail: "privacy@example.eu",
  dpoEmail: null,
  createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T10:00:00.000Z",
};

describe("owner privacy settings", () => {
  it("requires the controller identity and public contacts", () => {
    expect(isOwnerLegalProfileComplete(completeProfile)).toBe(true);
    expect(
      isOwnerLegalProfileComplete({
        ...completeProfile,
        privacyEmail: "",
      }),
    ).toBe(false);
  });

  it("builds an immutable publication snapshot from owner and platform data", () => {
    const snapshot = buildSurveyLegalSnapshot(
      completeProfile,
      {
        controllerName: "Legacy controller",
        controllerContactEmail: "legacy@example.eu",
        controllerCountry: "EU",
        processorName: "FlexPulseEU",
        privacyEmail: "platform@example.eu",
        privacyUrl: "/privacy",
        cookiesUrl: "/cookies",
        consentVersion: "consent-v2",
        privacyNoticeVersion: "privacy-v2",
        cookieNoticeVersion: "cookies-v2",
      },
      "72 hours",
      "2026-07-16T12:00:00.000Z",
    );

    expect(snapshot).toMatchObject({
      capturedAt: "2026-07-16T12:00:00.000Z",
      controller: {
        name: "Example Research Institute",
        privacyEmail: "privacy@example.eu",
      },
      platform: {
        processorName: "FlexPulseEU",
      },
      notices: {
        privacyNoticeVersion: "privacy-v2",
      },
      retention: {
        rawLocation: "72 hours",
      },
    });
  });
});
