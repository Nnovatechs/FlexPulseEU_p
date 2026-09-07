import { beforeEach, describe, expect, it, vi } from "vitest";
import { flexpulsePrimaryProfileAxisKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import { buildValidationSurveyFixture } from "../../../fixtures/surveys/validation/factory";

const {
  revalidatePath,
  redirect,
  getOwnedSurveyById,
  updateSurveyDraft,
  generateSurveyDraftProposal,
} = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  getOwnedSurveyById: vi.fn(),
  updateSurveyDraft: vi.fn(),
  generateSurveyDraftProposal: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/features/surveys/generator-repository", () => ({
  getOwnedSurveyById,
  updateSurveyDraft,
  publishSurvey: vi.fn(),
  createSurveyDraft: vi.fn(),
  duplicateOwnedSurvey: vi.fn(),
  deleteOwnedSurveyDraft: vi.fn(),
  archiveOwnedSurvey: vi.fn(),
}));

vi.mock("@/features/surveys/survey-generation-flow", () => ({
  generateSurveyDraftProposal,
}));

vi.mock("@/features/surveys/local-timing", () => ({
  withSurveyTimingOperation: vi.fn(async (_input, operation: () => Promise<unknown>) =>
    operation(),
  ),
  timeSurveyStep: vi.fn(async (_name, _meta, operation: () => Promise<unknown>) =>
    operation(),
  ),
}));

function buildSettingsFormData(
  overrides: Record<string, string> = {},
  conceptKeys: string[] = [],
) {
  const formData = new FormData();
  formData.set("surveyId", overrides.surveyId ?? "survey-settings-1");
  formData.set("name", overrides.name ?? "Baseline survey");
  formData.set("surveyDescription", overrides.surveyDescription ?? "Short intro");
  formData.set("defaultLanguage", overrides.defaultLanguage ?? "English");
  formData.set("intent", overrides.intent ?? "save");
  formData.set("surveyContextMode", overrides.surveyContextMode ?? "none");
  formData.append("supportedLanguages", overrides.defaultLanguage ?? "English");
  for (const conceptKey of conceptKeys) {
    formData.append("behaviouralConceptKeys", conceptKey);
  }
  return formData;
}

describe("survey settings generate enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
  });

  it("merges omitted primary axes and DFC inventory before mocked generation", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.survey_meta.behavioural_concept_keys = ["trust_in_automation"];

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-settings-1",
      name: "Baseline survey",
      status: "draft",
      created_by: "user-1",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });
    generateSurveyDraftProposal.mockResolvedValue({
      definition: structuredClone(fixture.definition),
      mappingContract: { schema_version: 1, mappings: fixture.mappings },
      warnings: [],
    });
    updateSurveyDraft.mockResolvedValue({});

    const { updateSurveySettingsAction } = await import("@/features/surveys/actions");

    await expect(
      updateSurveySettingsAction(
        buildSettingsFormData({ intent: "generate" }, ["manual_override_need"]),
      ),
    ).rejects.toThrow(/generated=1/);

    const expectedKeys = [
      ...flexpulsePrimaryProfileAxisKeys,
      "manual_override_need",
      "owned_der_assets",
    ];
    expect(generateSurveyDraftProposal).toHaveBeenCalledTimes(1);
    expect(generateSurveyDraftProposal.mock.calls[0]?.[0]).toMatchObject({
      behaviouralConceptKeys: expectedKeys,
      schemaTargets: expectedKeys.map(
        (conceptKey) => `flexpulse_behavioural_schema.${conceptKey}`,
      ),
      survey: {
        definition_json: {
          survey_meta: {
            behavioural_concept_keys: expectedKeys,
          },
        },
      },
    });
    expect(updateSurveyDraft).toHaveBeenCalledTimes(1);
  });

  it("does not persist submitted concept keys on save", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.survey_meta.behavioural_concept_keys = ["trust_in_automation"];

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-settings-1",
      name: "Baseline survey",
      status: "draft",
      created_by: "user-1",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });
    updateSurveyDraft.mockResolvedValue({});

    const { updateSurveySettingsAction } = await import("@/features/surveys/actions");

    await expect(
      updateSurveySettingsAction(
        buildSettingsFormData({ intent: "save" }, ["manual_override_need"]),
      ),
    ).rejects.toThrow(/saved=1/);

    expect(generateSurveyDraftProposal).not.toHaveBeenCalled();
    expect(updateSurveyDraft).toHaveBeenCalledTimes(1);
    expect(
      updateSurveyDraft.mock.calls[0]?.[0].definition_json.survey_meta
        .behavioural_concept_keys,
    ).toEqual(["trust_in_automation"]);
  });

  it("blocks generate on published surveys without writing a draft", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-settings-1",
      name: "Baseline survey",
      status: "published",
      created_by: "user-1",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { updateSurveySettingsAction } = await import("@/features/surveys/actions");

    await expect(
      updateSurveySettingsAction(buildSettingsFormData({ intent: "generate" })),
    ).rejects.toThrow(/immutable/);

    expect(generateSurveyDraftProposal).not.toHaveBeenCalled();
    expect(updateSurveyDraft).not.toHaveBeenCalled();
  });
});
