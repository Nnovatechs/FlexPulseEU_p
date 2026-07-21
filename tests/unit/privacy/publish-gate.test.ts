import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DPA_ACCEPTANCE_REQUIRED_ERROR,
  PRIVACY_PROFILE_INCOMPLETE_ERROR,
} from "@/features/privacy/types";

const {
  getOwnedSurveyById,
  getCurrentOwnerLegalProfile,
  prepareSurveyLegalSnapshot,
  getCurrentDpaAcceptance,
  publishSurvey,
} = vi.hoisted(() => ({
  getOwnedSurveyById: vi.fn(),
  getCurrentOwnerLegalProfile: vi.fn(),
  prepareSurveyLegalSnapshot: vi.fn(),
  getCurrentDpaAcceptance: vi.fn(),
  publishSurvey: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/features/privacy/repository", () => ({
  getCurrentOwnerLegalProfile,
  prepareSurveyLegalSnapshot,
}));

vi.mock("@/features/privacy/dpa-repository", () => ({
  getCurrentDpaAcceptance,
}));

vi.mock("@/features/surveys/content-validator", () => ({
  computeContentHash: vi.fn(() => "current-content-hash"),
  runContentValidation: vi.fn(),
}));

vi.mock("@/features/surveys/generator-repository", () => ({
  createSurveyDraft: vi.fn(),
  getOwnedSurveyById,
  updateSurveyDraft: vi.fn(),
  publishSurvey,
  deleteOwnedSurveyDraft: vi.fn(),
  archiveOwnedSurvey: vi.fn(),
}));

describe("survey publication privacy gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DPA_REQUIRED", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the draft unpublished when Privacy Settings are incomplete", async () => {
    getOwnedSurveyById.mockResolvedValue({
      id: "survey-1",
      created_by: "owner-1",
      status: "draft",
      default_language: "English",
      supported_languages: ["English"],
      definition_json: {
        survey_meta: {
          validation_result: {
            passed: true,
            content_hash: "current-content-hash",
          },
        },
        questions: [],
        translations: {
          English: {},
        },
      },
    });
    getCurrentOwnerLegalProfile.mockResolvedValue(null);

    const { publishSurveyAction } = await import("@/features/surveys/actions");
    const formData = new FormData();
    formData.set("surveyId", "survey-1");

    await expect(publishSurveyAction(formData)).resolves.toEqual({
      error: PRIVACY_PROFILE_INCOMPLETE_ERROR,
    });
    expect(prepareSurveyLegalSnapshot).not.toHaveBeenCalled();
    expect(publishSurvey).not.toHaveBeenCalled();
  });

  it("prepares the legal snapshot before publishing a valid draft", async () => {
    getOwnedSurveyById.mockResolvedValue({
      id: "survey-1",
      created_by: "owner-1",
      status: "draft",
      default_language: "English",
      supported_languages: ["English"],
      definition_json: {
        survey_meta: {
          validation_result: {
            passed: true,
            content_hash: "current-content-hash",
          },
        },
        questions: [],
        translations: {
          English: {},
        },
      },
    });
    getCurrentOwnerLegalProfile.mockResolvedValue({
      userId: "owner-1",
      controllerName: "Example Research Institute",
      controllerCountry: "Spain",
      contactEmail: "research@example.eu",
      privacyEmail: "privacy@example.eu",
      dpoEmail: null,
      controllerAddress: "1 Research Avenue, Cork",
      representativeName: "Research Lead",
      representativeTitle: "Principal Investigator",
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });
    prepareSurveyLegalSnapshot.mockResolvedValue({});
    publishSurvey.mockResolvedValue({});

    const { publishSurveyAction } = await import("@/features/surveys/actions");
    const formData = new FormData();
    formData.set("surveyId", "survey-1");

    await publishSurveyAction(formData);

    expect(prepareSurveyLegalSnapshot).toHaveBeenCalledWith(
      "survey-1",
      "owner-1",
    );
    expect(prepareSurveyLegalSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      publishSurvey.mock.invocationCallOrder[0],
    );
    expect(publishSurvey).toHaveBeenCalledWith("survey-1");
  });

  it("requires acceptance of the current DPA when the deployment enables it", async () => {
    vi.stubEnv("DPA_REQUIRED", "1");
    vi.stubEnv("LEGAL_PROCESSOR_ADDRESS", "Platform Operator Address");
    vi.stubEnv("LEGAL_PROCESSOR_NAME", "FlexPulseEU Operator");
    vi.stubEnv("LEGAL_PRIVACY_EMAIL", "privacy@platform.example");
    getOwnedSurveyById.mockResolvedValue({
      id: "survey-1",
      created_by: "owner-1",
      status: "draft",
      default_language: "English",
      supported_languages: ["English"],
      definition_json: {
        survey_meta: {
          validation_result: {
            passed: true,
            content_hash: "current-content-hash",
          },
        },
        questions: [],
        translations: { English: {} },
      },
    });
    getCurrentOwnerLegalProfile.mockResolvedValue({
      userId: "owner-1",
      controllerName: "University College Cork",
      controllerCountry: "Ireland",
      contactEmail: "research@ucc.ie",
      privacyEmail: "privacy@ucc.ie",
      dpoEmail: null,
      controllerAddress: "College Road, Cork, Ireland",
      representativeName: "Authorised Researcher",
      representativeTitle: "Principal Investigator",
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });
    getCurrentDpaAcceptance.mockResolvedValue(null);

    const { publishSurveyAction } = await import("@/features/surveys/actions");
    const formData = new FormData();
    formData.set("surveyId", "survey-1");

    await expect(publishSurveyAction(formData)).resolves.toEqual({
      error: DPA_ACCEPTANCE_REQUIRED_ERROR,
    });
    expect(prepareSurveyLegalSnapshot).not.toHaveBeenCalled();
    expect(publishSurvey).not.toHaveBeenCalled();
  });
});
