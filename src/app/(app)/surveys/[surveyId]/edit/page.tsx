import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ConceptPicker } from "@/components/surveys/concept-picker";
import { FormActions } from "@/components/surveys/form-actions";
import { PreviewTab } from "@/components/surveys/preview-tab";
import { QuestionsOverview } from "@/components/surveys/questions-overview";
import { ReviewTab } from "@/components/surveys/review-tab";
import { SurveyEditorTabs } from "@/components/surveys/survey-editor-tabs";
import { updateSurveySettingsAction } from "@/features/surveys/actions";
import { computeContentHash } from "@/features/surveys/content-validator";
import { surveyLanguageOptions } from "@/features/surveys/language-options";
import { getOwnedSurveyById } from "@/features/surveys/generator-repository";
import { normalizeSurveyResponseContextConfig } from "@/features/surveys/generator-types";
import { computeMultilingualTranslationHash } from "@/features/surveys/translation-validation";

type SurveyEditPageProps = {
  params: Promise<{ surveyId: string }>;
  searchParams?: Promise<{
    created?: string;
    saved?: string;
    generated?: string;
    error?: string;
    message?: string;
    tab?: string;
  }>;
};

export default async function SurveyEditPage({
  params,
  searchParams,
}: SurveyEditPageProps) {
  const { surveyId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  let survey;

  try {
    survey = await getOwnedSurveyById(surveyId);
  } catch {
    survey = null;
  }

  if (!survey) {
    notFound();
  }

  const activeTranslations =
    survey.definition_json.translations[survey.default_language] ?? null;
  const savedTargets = survey.definition_json.survey_meta.ontology_targets ?? [];

  const createdMessage = resolvedSearchParams.created === "1";
  const savedMessage = resolvedSearchParams.saved === "1";
  const generatedMessage = resolvedSearchParams.generated === "1";
  const tabParam = resolvedSearchParams.tab;
  const generationMessage = resolvedSearchParams.message
    ? decodeURIComponent(resolvedSearchParams.message)
    : "";
  const missingFieldsError = resolvedSearchParams.error === "missing-fields";
  const missingTargetsError =
    resolvedSearchParams.error === "missing-ontology-targets";
  const generationFailedError =
    resolvedSearchParams.error === "generation-failed";
  const responseContext = normalizeSurveyResponseContextConfig(
    survey.definition_json.survey_meta.response_context,
  );

  const configurationTab = (
    <form action={updateSurveySettingsAction}>
      <input type="hidden" name="surveyId" value={survey.id} />

      <div className="editor-sections">
        <details className="collapsible-section">
          <summary className="collapsible-section__header">
            <span className="collapsible-section__title">Survey settings</span>
            <span className="collapsible-section__chevron" aria-hidden>
              ›
            </span>
          </summary>

          <div className="collapsible-section__body">
            <label className="field">
              <span>Survey name</span>
              <input name="name" defaultValue={survey.name} required />
            </label>

            <label className="field">
              <span>Description</span>
              <textarea
                name="surveyDescription"
                defaultValue={activeTranslations?.survey_description ?? ""}
                rows={3}
                placeholder="Short introduction or context for respondents"
              />
            </label>

            <div className="field">
              <span>Response context</span>
              <p className="muted">
                Configure whether published respondents should provide coarse
                location context for later enrichment and profiling.
              </p>
              <div className="choice-stack">
                <label className="choice-chip">
                  <input
                    type="checkbox"
                    name="collectCountryCode"
                    defaultChecked={responseContext.collect_country_code}
                  />
                  <span>Collect country code</span>
                </label>
                <label className="choice-chip">
                  <input
                    type="checkbox"
                    name="collectPostalCode"
                    defaultChecked={responseContext.collect_postal_code}
                  />
                  <span>Collect postal code</span>
                </label>
                <label className="choice-chip">
                  <input
                    type="checkbox"
                    name="enrichWeatherContext"
                    defaultChecked={responseContext.enrich_weather_context}
                  />
                  <span>Enrich weather context after submission</span>
                </label>
              </div>
            </div>
          </div>
        </details>

        <details className="collapsible-section">
          <summary className="collapsible-section__header">
            <span className="collapsible-section__title">Survey languages</span>
            <span className="collapsible-section__chevron" aria-hidden>
              ›
            </span>
          </summary>

          <div className="collapsible-section__body">
            <label className="field">
              <span>Primary language</span>
              <select
                name="defaultLanguage"
                defaultValue={survey.default_language}
                required
              >
                {surveyLanguageOptions.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>Supported languages</span>
              <div className="chip-grid">
                {surveyLanguageOptions.map((language) => (
                  <label key={language} className="choice-chip">
                    <input
                      type="checkbox"
                      name="supportedLanguages"
                      value={language}
                      defaultChecked={survey.supported_languages.includes(
                        language,
                      )}
                    />
                    <span>{language}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </details>

        <details className="collapsible-section">
          <summary className="collapsible-section__header">
            <span className="collapsible-section__title">
              Ontology concepts
            </span>
            <span className="collapsible-section__meta">
              {savedTargets.length > 0 && (
                <span className="concept-block__count">
                  {savedTargets.length} selected
                </span>
              )}
            </span>
            <span className="collapsible-section__chevron" aria-hidden>
              ›
            </span>
          </summary>

          <div className="collapsible-section__body">
            <p className="concept-picker__hint">
              Select the behavioural concepts this survey should cover. The
              generator uses these to propose questions and their ontological
              mappings.
            </p>
            <ConceptPicker initialTargets={savedTargets} />
          </div>
        </details>
      </div>

      <FormActions initialHasTargets={savedTargets.length > 0} />
    </form>
  );

  const questionsTab = (
    <QuestionsOverview
      questions={survey.definition_json.questions}
      mappings={survey.mapping_contract_json.mappings}
      translations={activeTranslations}
      surveyId={survey.id}
      defaultLanguage={survey.default_language}
    />
  );

  const hasQuestions = survey.definition_json.questions.length > 0;
  const storedValidation =
    survey.definition_json.survey_meta.validation_result ?? null;
  const storedMultilingualValidation =
    survey.definition_json.survey_meta.multilingual_validation_result ?? null;
  const isValidationStale =
    storedValidation !== null && activeTranslations !== null
      ? computeContentHash(survey.definition_json.questions, activeTranslations) !==
        storedValidation.content_hash
      : false;
  const isMultilingualValidationStale =
    storedMultilingualValidation !== null
      ? computeMultilingualTranslationHash(
          survey.definition_json,
          survey.supported_languages,
        ) !== storedMultilingualValidation.translation_hash
      : false;

  const hasSecondaryLanguages = survey.supported_languages.some(
    (lang) => lang !== survey.default_language,
  );
  const contentPassed = storedValidation?.passed === true && !isValidationStale;
  const multilingualPassed =
    !hasSecondaryLanguages ||
    (storedMultilingualValidation?.passed === true && !isMultilingualValidationStale);
  const previewUnlocked = contentPassed && multilingualPassed && hasQuestions;

  const reviewTab = (
    <ReviewTab
      surveyId={survey.id}
      hasQuestions={hasQuestions}
      questions={survey.definition_json.questions}
      translations={activeTranslations}
      validationResult={storedValidation}
      isStale={isValidationStale}
      defaultLanguage={survey.default_language}
      supportedLanguages={survey.supported_languages}
      multilingualValidationResult={storedMultilingualValidation}
      isMultilingualStale={isMultilingualValidationStale}
    />
  );

  const previewTab = (
    <PreviewTab
      surveyId={survey.id}
      surveyTitle={activeTranslations?.survey_title ?? survey.name}
      surveyDescription={activeTranslations?.survey_description ?? ""}
      questions={survey.definition_json.questions}
      mappings={survey.mapping_contract_json.mappings}
      translations={survey.definition_json.translations}
      defaultLanguage={survey.default_language}
      supportedLanguages={survey.supported_languages}
    />
  );

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Survey editor" title={survey.name} />

      {createdMessage ? (
        <div className="notice notice--info" role="status">
          Survey created. Configure settings and select concepts to generate questions.
        </div>
      ) : null}

      {savedMessage ? (
        <div className="notice notice--info" role="status">
          Changes saved.
        </div>
      ) : null}

      {generatedMessage ? (
        <div className="notice notice--info" role="status">
          Survey draft generated and saved.
        </div>
      ) : null}

      {missingFieldsError ? (
        <div className="notice notice--error" role="alert">
          Survey name and primary language are required.
        </div>
      ) : null}

      {missingTargetsError ? (
        <div className="notice notice--error" role="alert">
          Select at least one ontology concept before generating a survey.
        </div>
      ) : null}

      {generationFailedError ? (
        <div className="notice notice--error" role="alert">
          Survey generation failed.{" "}
          {generationMessage || "Please review the current settings and try again."}
        </div>
      ) : null}

      <div className="overview-band">
        <div className="overview-band__item">
          <span className="overview-band__label">Status</span>
          <span className={`status-pill status-pill--${survey.status}`}>
            {survey.status}
          </span>
        </div>
        <div className="overview-band__item">
          <span className="overview-band__label">Languages</span>
          <span className="overview-band__value">
            {survey.supported_languages.join(", ")}
          </span>
        </div>
        <div className="overview-band__item">
          <span className="overview-band__label">Questions</span>
          <span className="overview-band__value">
            {survey.definition_json.questions.length}
          </span>
        </div>
        <div className="overview-band__item">
          <span className="overview-band__label">Mappings</span>
          <span className="overview-band__value">
            {survey.mapping_contract_json.mappings.length}
          </span>
        </div>
        <div className="overview-band__item">
          <span className="overview-band__label">Concepts</span>
          <span className="overview-band__value">{savedTargets.length}</span>
        </div>
      </div>

      <SurveyEditorTabs
        configurationTab={configurationTab}
        questionsTab={questionsTab}
        reviewTab={reviewTab}
        previewTab={previewTab}
        previewUnlocked={previewUnlocked}
        defaultTab={
          tabParam === "preview" && previewUnlocked
            ? "preview"
            : generatedMessage
              ? "questions"
              : "configuration"
        }
      />
    </div>
  );
}
