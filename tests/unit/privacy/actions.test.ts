import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDpaDocument, getDpaConfig } from "@/features/privacy/dpa";
import type { OwnerLegalProfile } from "@/features/privacy/types";

const {
  getCurrentDpaAcceptance,
  recordCurrentDpaAcceptance,
  saveCurrentOwnerParticipantPrivacySettings,
  saveCurrentOwnerDpaSigningDetails,
  getCurrentOwnerLegalProfile,
  revalidatePath,
  redirect,
} = vi.hoisted(() => ({
  getCurrentDpaAcceptance: vi.fn(),
  recordCurrentDpaAcceptance: vi.fn(),
  saveCurrentOwnerParticipantPrivacySettings: vi.fn(),
  saveCurrentOwnerDpaSigningDetails: vi.fn(),
  getCurrentOwnerLegalProfile: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/privacy/repository", () => ({
  getCurrentOwnerLegalProfile,
  saveCurrentOwnerParticipantPrivacySettings,
  saveCurrentOwnerDpaSigningDetails,
}));
vi.mock("@/features/privacy/dpa-repository", () => ({
  getCurrentDpaAcceptance,
  recordCurrentDpaAcceptance,
}));

const profile: OwnerLegalProfile = {
  userId: "owner-1",
  controllerName: "University College Cork",
  controllerCountry: "Ireland",
  controllerAddress: "College Road, Cork, Ireland",
  representativeName: "Authorised Researcher",
  representativeTitle: "Principal Investigator",
  contactEmail: "research@ucc.ie",
  privacyEmail: "privacy@ucc.ie",
  dpoEmail: null,
  createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T10:00:00.000Z",
};

describe("privacy actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LEGAL_PROCESSOR_NAME", "FlexPulseEU Operator");
    vi.stubEnv("LEGAL_PRIVACY_EMAIL", "privacy@platform.example");
    vi.stubEnv("LEGAL_PROCESSOR_ADDRESS", "Operator registered address");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("saves participant privacy details without overwriting DPA signing fields", async () => {
    saveCurrentOwnerParticipantPrivacySettings.mockResolvedValue(profile);
    const formData = new FormData();
    formData.set("controllerName", "Updated Controller");
    formData.set("controllerCountry", "Ireland");
    formData.set("contactEmail", "updated@ucc.ie");
    formData.set("privacyEmail", "privacy@ucc.ie");
    formData.set("dpoEmail", "dpo@ucc.ie");

    const { saveParticipantPrivacySettingsAction } = await import(
      "@/features/privacy/actions"
    );
    await saveParticipantPrivacySettingsAction(formData);

    expect(saveCurrentOwnerParticipantPrivacySettings).toHaveBeenCalledWith({
      controllerName: "Updated Controller",
      controllerCountry: "Ireland",
      contactEmail: "updated@ucc.ie",
      privacyEmail: "privacy@ucc.ie",
      dpoEmail: "dpo@ucc.ie",
    });
    expect(redirect).toHaveBeenCalledWith("/account/privacy?participantSaved=1");
  });

  it("saves DPA signing details without overwriting participant privacy fields", async () => {
    getCurrentOwnerLegalProfile.mockResolvedValue(profile);
    saveCurrentOwnerDpaSigningDetails.mockResolvedValue(profile);
    const formData = new FormData();
    formData.set("controllerAddress", "New Registered Address");
    formData.set("representativeName", "New Representative");
    formData.set("representativeTitle", "Legal Signatory");

    const { saveDpaSigningDetailsAction } = await import(
      "@/features/privacy/actions"
    );
    await saveDpaSigningDetailsAction(formData);

    expect(saveCurrentOwnerDpaSigningDetails).toHaveBeenCalledWith({
      controllerAddress: "New Registered Address",
      representativeName: "New Representative",
      representativeTitle: "Legal Signatory",
    });
    expect(redirect).toHaveBeenCalledWith("/account/privacy?dpaSaved=1");
  });

  it("requires participant privacy details before saving DPA signing details", async () => {
    getCurrentOwnerLegalProfile.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("controllerAddress", "New Registered Address");
    formData.set("representativeName", "New Representative");
    formData.set("representativeTitle", "Legal Signatory");

    const { saveDpaSigningDetailsAction } = await import(
      "@/features/privacy/actions"
    );
    await saveDpaSigningDetailsAction(formData);

    expect(saveCurrentOwnerDpaSigningDetails).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      "/account/privacy?error=participant-profile-required",
    );
  });

  it("records the exact document displayed to the authorised Controller", async () => {
    getCurrentOwnerLegalProfile.mockResolvedValue(profile);
    getCurrentDpaAcceptance.mockResolvedValue(null);
    recordCurrentDpaAcceptance.mockResolvedValue({});
    const document = buildDpaDocument(profile, getDpaConfig());
    const formData = new FormData();
    formData.set("accepted", "true");
    formData.set("documentHash", document.documentHash);

    const { acceptDpaAction } = await import("@/features/privacy/actions");
    await acceptDpaAction(formData);

    expect(recordCurrentDpaAcceptance).toHaveBeenCalledWith(profile, document);
    expect(revalidatePath).toHaveBeenCalledWith("/account/privacy/dpa");
    expect(redirect).toHaveBeenCalledWith("/account/privacy/dpa?accepted=1");
  });
});
