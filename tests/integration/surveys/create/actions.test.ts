import { beforeEach, describe, expect, it, vi } from "vitest";
import { supportedSurveyLanguages } from "@/features/surveys/languages";

const { revalidatePath, redirect, createSurveyDraft } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  createSurveyDraft: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/features/surveys/generator-repository", () => ({
  createSurveyDraft,
  getOwnedSurveyById: vi.fn(),
  updateSurveyDraft: vi.fn(),
  publishSurvey: vi.fn(),
  duplicateOwnedSurvey: vi.fn(),
  deleteOwnedSurveyDraft: vi.fn(),
  archiveOwnedSurvey: vi.fn(),
}));

function buildCreateFormData(defaultLanguage: string, name = "Household baseline") {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("defaultLanguage", defaultLanguage);
  return formData;
}

describe("create survey draft language validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
    createSurveyDraft.mockResolvedValue({
      id: "survey-create-1",
    });
  });

  it.each([...supportedSurveyLanguages])("accepts canonical defaultLanguage %s", async (language) => {
    const { createSurveyDraftAction } = await import("@/features/surveys/actions");

    await expect(createSurveyDraftAction(buildCreateFormData(language))).rejects.toThrow(
      /created=1/,
    );

    expect(createSurveyDraft).toHaveBeenCalledTimes(1);
    expect(createSurveyDraft).toHaveBeenCalledWith({
      name: "Household baseline",
      default_language: language,
      supported_languages: [language],
    });
  });

  it("rejects Español before creating a survey", async () => {
    const { createSurveyDraftAction } = await import("@/features/surveys/actions");

    await expect(createSurveyDraftAction(buildCreateFormData("Español"))).rejects.toThrow(
      /unsupported-language/,
    );

    expect(createSurveyDraft).not.toHaveBeenCalled();
  });

  it("rejects an arbitrary unsupported language before creating a survey", async () => {
    const { createSurveyDraftAction } = await import("@/features/surveys/actions");

    await expect(createSurveyDraftAction(buildCreateFormData("Klingon"))).rejects.toThrow(
      /unsupported-language/,
    );

    expect(createSurveyDraft).not.toHaveBeenCalled();
  });
});
