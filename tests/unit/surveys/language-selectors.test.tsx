import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";
import { SurveyLanguageSelect } from "@/components/surveys/survey-language-select";
import { supportedSurveyLanguages } from "@/features/surveys/languages";

const { getOwnedSurveyById, getOwnedSurveyFeedbackConfig } = vi.hoisted(() => ({
  getOwnedSurveyById: vi.fn(),
  getOwnedSurveyFeedbackConfig: vi.fn(),
}));

vi.mock("@/components/pending-nav-link", () => ({
  PendingNavLink: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/pending-view-overlay", () => ({
  FormPendingOverlay: () => null,
  PendingSubmitButton: ({ children }: { children: ReactNode }) => (
    <button type="submit">{children}</button>
  ),
}));

vi.mock("@/components/layout/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/features/surveys/generator-repository", () => ({
  getOwnedSurveyById,
}));

vi.mock("@/features/surveys/feedback-repository", () => ({
  getOwnedSurveyFeedbackConfig,
}));

vi.mock("@/components/onboarding/page-onboarding-guide", () => ({
  PageOnboardingGuide: () => null,
}));

vi.mock("@/components/surveys/editor-info-tip", () => ({
  EditorInfoTip: () => null,
}));

vi.mock("@/components/surveys/concept-picker", () => ({
  ConceptPicker: () => null,
}));

vi.mock("@/components/surveys/form-actions", () => ({
  FormActions: () => null,
}));

vi.mock("@/components/surveys/preview-tab", () => ({
  PreviewTab: () => null,
}));

vi.mock("@/components/surveys/questions-overview", () => ({
  QuestionsOverview: () => null,
}));

vi.mock("@/components/surveys/review-tab", () => ({
  ReviewTab: () => null,
}));

vi.mock("@/components/surveys/survey-editor-tabs", () => ({
  SurveyEditorTabs: ({ configurationTab }: { configurationTab: ReactNode }) => (
    <div>{configurationTab}</div>
  ),
}));

function expectCanonicalLanguageOptions(html: string) {
  expect(html).toContain('name="defaultLanguage"');

  for (const language of supportedSurveyLanguages) {
    expect(html).toContain(`value="${language}"`);
    expect(html).toMatch(
      new RegExp(`<option value="${language}"[^>]*>${language}</option>`),
    );
  }
}

function buildDraftSurvey(defaultLanguage: string, supportedLanguages: string[]) {
  return {
    id: "survey-edit-1",
    name: "Household baseline",
    status: "draft" as const,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    published_at: null,
    default_language: defaultLanguage,
    supported_languages: supportedLanguages,
    definition_json: {
      schema_version: 1 as const,
      survey_meta: {
        default_language: defaultLanguage,
        supported_languages: supportedLanguages,
      },
      questions: [],
      translations: {
        [defaultLanguage]: {
          survey_title: "Household baseline",
          survey_description: "",
          questions: {},
        },
      },
      validation_rules: {
        pii: {
          allow_direct_identifiers: false,
          allow_free_text: false,
        },
        multilingual: {
          require_complete_translations: true,
        },
      },
    },
    mapping_contract_json: {
      schema_version: 1 as const,
      mappings: [],
    },
    mapping_compiled_json: null,
    mapping_hash: null,
  };
}

describe("canonical language selectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnedSurveyFeedbackConfig.mockResolvedValue(null);
  });

  it("gives the shared primary-language select explicit canonical values", () => {
    const html = renderToStaticMarkup(
      <SurveyLanguageSelect defaultValue="Spanish" />,
    );

    expectCanonicalLanguageOptions(html);
    expect(html).toContain('name="defaultLanguage"');
  });

  it("renders those canonical values on create and edit", async () => {
    const { default: NewSurveyPage } = await import(
      "@/app/(app)/surveys/new/page"
    );
    const createHtml = renderToStaticMarkup(
      await NewSurveyPage({ searchParams: Promise.resolve({}) }),
    );
    expectCanonicalLanguageOptions(createHtml);

    getOwnedSurveyById.mockResolvedValue(
      buildDraftSurvey("Spanish", ["Spanish", "English"]),
    );
    const { default: SurveyEditPage } = await import(
      "@/app/(app)/surveys/[surveyId]/edit/page"
    );
    const editHtml = renderToStaticMarkup(
      await SurveyEditPage({
        params: Promise.resolve({ surveyId: "survey-edit-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expectCanonicalLanguageOptions(editHtml);
    expect(editHtml).toContain('name="supportedLanguages"');
    for (const language of supportedSurveyLanguages) {
      expect(editHtml).toMatch(
        new RegExp(
          `<input[^>]*name="supportedLanguages"[^>]*value="${language}"`,
        ),
      );
    }
  });

  it("opts the authenticated shell out of browser translation", () => {
    const html = renderToStaticMarkup(
      <AppShell userName="Pilot user" userEmail="pilot@example.com">
        workspace
      </AppShell>,
    );

    expect(html).toContain('translate="no"');
    expect(html).toContain("notranslate");
    expect(html).not.toContain("<html");
  });
});
