import { notFound, redirect } from "next/navigation";
import { editorOnboardingGuide } from "@/components/onboarding/guides";
import { PageOnboardingGuide } from "@/components/onboarding/page-onboarding-guide";
import { PageHeader } from "@/components/layout/page-header";
import { ConceptPicker } from "@/components/surveys/concept-picker";
import { EditorInfoTip } from "@/components/surveys/editor-info-tip";
import { FormActions } from "@/components/surveys/form-actions";
import { PreviewTab } from "@/components/surveys/preview-tab";
import { QuestionsOverview } from "@/components/surveys/questions-overview";
import { ReviewTab } from "@/components/surveys/review-tab";
import { SurveyEditorTabs } from "@/components/surveys/survey-editor-tabs";
import { updateSurveySettingsAction } from "@/features/surveys/actions";
import { isSurveyFeedbackEligible } from "@/features/surveys/feedback";
import { getOwnedSurveyFeedbackConfig } from "@/features/surveys/feedback-repository";
import {
  buildQuestionIntentLookup,
  getSurveyIntegrityState,
} from "@/features/surveys/expert-review";
import {
  isRecommendedSurveyLanguage,
  surveyLanguageOptions,
} from "@/features/surveys/language-options";
import { getOwnedSurveyById } from "@/features/surveys/generator-repository";
import { normalizeSurveyResponseContextConfig } from "@/features/surveys/generator-types";
import { appRoutes } from "@/lib/config/routes";

type SurveyEditPageProps = {
  params: Promise<{ surveyId: string }>;
  searchParams?: Promise<{
    created?: string;
    duplicated?: string;
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

  if (survey.status !== "draft") {
    redirect(`${appRoutes.surveyDetail(survey.id)}?error=immutable`);
  }

  const activeTranslations =
    survey.definition_json.translations[survey.default_language] ?? null;
  const savedConceptKeys =
    survey.definition_json.survey_meta.behavioural_concept_keys ?? [];

  const createdMessage = resolvedSearchParams.created === "1";
  const duplicatedMessage = resolvedSearchParams.duplicated === "1";
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
  const unsupportedLanguageError =
    resolvedSearchParams.error === "unsupported-language";
  const responseContext = normalizeSurveyResponseContextConfig(
    survey.definition_json.survey_meta.response_context,
  );
  const surveyContextMode = responseContext.enrich_weather_context
    ? "weather_enriched"
    : responseContext.collect_postal_code
      ? responseContext.postal_collection_mode === "prefix"
        ? "postal_prefix"
        : "full_postal"
      : responseContext.collect_country_code
        ? "country_only"
        : "none";

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
            <div className="review-notice review-notice--warning">
              Saving a new description or language configuration clears the
              current validation and expert review snapshots because it changes
              visible survey copy.
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
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
              <p className="muted">
                English, Spanish and French are the recommended primary
                languages for the current deployment.
              </p>
            </label>

            <div className="field">
              <span>Supported languages</span>
              <div className="chip-grid">
                {surveyLanguageOptions.map((language) => (
                  <div key={language} className="language-chip-row">
                    <label className="choice-chip">
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
                    {isRecommendedSurveyLanguage(language) ? (
                      <span
                        className="editor-recommended-badge"
                        tabIndex={0}
                        role="note"
                        aria-label="Recommended for the current FlexPulse-EU deployment. These languages have completed linguistic review and have been fielded in real participant data."
                        data-tooltip="Recommended for the current FlexPulse-EU deployment. These languages have completed linguistic review and have been fielded in real participant data."
                      >
                        Recommended
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>

        <details className="collapsible-section">
          <summary className="collapsible-section__header">
            <span className="collapsible-section__title">
              Survey context
              <EditorInfoTip
                label="Geographic coverage details"
                tooltip="Country-level context is available broadly. Postal-prefix analytics and interactive postal-area maps are currently supported for Spain, France and Ireland. Full-postal enrichment is attempted where the submitted postal code can be resolved; coverage and quality are reported in analytics."
              />
            </span>
            <span className="collapsible-section__chevron" aria-hidden>
              ›
            </span>
          </summary>

          <div className="collapsible-section__body">
            <div className="field">
              <span>Context level</span>
              <p className="muted">
                Choose how much respondent location context the public survey
                should collect. Prefix mode is currently intended for Spain,
                France and Ireland only.
              </p>
              <div className="choice-stack">
                <label className="choice-chip">
                  <input
                    type="radio"
                    name="surveyContextMode"
                    value="none"
                    defaultChecked={surveyContextMode === "none"}
                  />
                  <span>No context</span>
                </label>
                <label className="choice-chip">
                  <input
                    type="radio"
                    name="surveyContextMode"
                    value="country_only"
                    defaultChecked={surveyContextMode === "country_only"}
                  />
                  <span>Country only</span>
                </label>
                <label className="choice-chip">
                  <input
                    type="radio"
                    name="surveyContextMode"
                    value="postal_prefix"
                    defaultChecked={surveyContextMode === "postal_prefix"}
                  />
                  <span>Country + postal prefix</span>
                </label>
                <label className="choice-chip">
                  <input
                    type="radio"
                    name="surveyContextMode"
                    value="full_postal"
                    defaultChecked={surveyContextMode === "full_postal"}
                  />
                  <span>Country + full postal code</span>
                </label>
                <label className="choice-chip">
                  <input
                    type="radio"
                    name="surveyContextMode"
                    value="weather_enriched"
                    defaultChecked={surveyContextMode === "weather_enriched"}
                  />
                  <span>Country + full postal code + weather enrichment</span>
                </label>
              </div>
              <div className="review-notice review-notice--warning">
                Country only keeps the coarsest location layer. Postal prefix
                adds an intermediate bucket without full geocoding or weather.
                Full postal code enables the strongest spatial granularity, and
                weather enrichment only works with full postal collection.
              </div>
              <p className="muted">
                Saving only the internal survey name or survey context keeps the
                current validation and expert review snapshots.
              </p>
            </div>
          </div>
        </details>

        <details className="collapsible-section">
          <summary className="collapsible-section__header">
            <span className="collapsible-section__title">
              Behavioural schema concepts
            </span>
            <span className="collapsible-section__meta">
              {savedConceptKeys.length > 0 && (
                <span className="concept-block__count">
                  {savedConceptKeys.length} selected
                </span>
              )}
            </span>
            <span className="collapsible-section__chevron" aria-hidden>
              ›
            </span>
          </summary>

          <div className="collapsible-section__body">
            <p className="concept-picker__hint">
              The seven core profile axes are always included in generation.
              Optional concepts can still be added. Declared flexibility
              capability keeps its household-assets dependency.
            </p>
            <ConceptPicker initialConceptKeys={savedConceptKeys} />
          </div>
        </details>
      </div>

      <FormActions initialHasTargets />
    </form>
  );

  const hasQuestions = survey.definition_json.questions.length > 0;
  const storedValidation =
    survey.definition_json.survey_meta.validation_result ?? null;
  const storedMultilingualValidation =
    survey.definition_json.survey_meta.multilingual_validation_result ?? null;
  const expertReviewResult =
    survey.definition_json.survey_meta.expert_review_result ?? null;
  const integrity = getSurveyIntegrityState({
    definition: survey.definition_json,
    defaultLanguage: survey.default_language,
    supportedLanguages: survey.supported_languages,
  });
  const isValidationStale = expertReviewResult
    ? !integrity.expert_review_baseline_linked
    : !integrity.automatic_content_current && storedValidation !== null;
  const isMultilingualValidationStale = expertReviewResult
    ? !integrity.expert_review_baseline_linked
    : !integrity.automatic_multilingual_current &&
      storedMultilingualValidation !== null;
  const questionIntentLookup = buildQuestionIntentLookup(
    survey.definition_json.survey_meta.measurement_plan_json,
  );
  const surveyFeedbackConfig = await getOwnedSurveyFeedbackConfig(survey.id);
  const surveyFeedbackEligible = isSurveyFeedbackEligible(survey.default_language);
  const hasCurrentContentValidation =
    storedValidation?.passed === true && !isValidationStale;
  const hasCurrentMultilingualValidation =
    storedMultilingualValidation?.passed === true && !isMultilingualValidationStale;

  const questionsTab = (
    <QuestionsOverview
      questions={survey.definition_json.questions}
      mappings={survey.mapping_contract_json.mappings}
      translations={activeTranslations}
      surveyId={survey.id}
      defaultLanguage={survey.default_language}
      hasContentValidation={hasCurrentContentValidation}
      hasMultilingualValidation={hasCurrentMultilingualValidation}
      hasExpertReview={expertReviewResult != null}
    />
  );

  const previewUnlocked = hasQuestions;

  const reviewTab = (
    <ReviewTab
      surveyId={survey.id}
      hasQuestions={hasQuestions}
      questions={survey.definition_json.questions}
      translations={activeTranslations}
      translationsByLanguage={survey.definition_json.translations}
      validationResult={storedValidation}
      isStale={isValidationStale}
      defaultLanguage={survey.default_language}
      supportedLanguages={survey.supported_languages}
      multilingualValidationResult={storedMultilingualValidation}
      isMultilingualStale={isMultilingualValidationStale}
      hasExpertReview={expertReviewResult != null}
    />
  );

  const previewTab = (
    <PreviewTab
      surveyId={survey.id}
      surveyFeedbackEligible={surveyFeedbackEligible}
      surveyFeedbackEnabled={surveyFeedbackConfig?.enabled === true}
      surveyTitle={activeTranslations?.survey_title ?? survey.name}
      surveyDescription={activeTranslations?.survey_description ?? ""}
      questions={survey.definition_json.questions}
      mappings={survey.mapping_contract_json.mappings}
      translations={survey.definition_json.translations}
      defaultLanguage={survey.default_language}
      supportedLanguages={survey.supported_languages}
      validationResult={storedValidation}
      multilingualValidationResult={storedMultilingualValidation}
      isValidationStale={isValidationStale}
      isMultilingualValidationStale={isMultilingualValidationStale}
      expertReviewResult={expertReviewResult}
      integrity={integrity}
      questionIntentLookup={questionIntentLookup}
    />
  );

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[
          { label: "Surveys", href: appRoutes.dashboard },
          { label: survey.name, href: appRoutes.surveyDetail(survey.id) },
          { label: "Edit" },
        ]}
        eyebrow="Survey editor"
        title={survey.name}
        titleAside={<PageOnboardingGuide {...editorOnboardingGuide} />}
      />

      {createdMessage ? (
        <div className="notice notice--info" role="status">
          Survey created. Configure settings and select concepts to generate questions.
        </div>
      ) : null}

      {duplicatedMessage ? (
        <div className="notice notice--info" role="status">
          Survey duplicated. This new draft preserves the source content and can
          now be edited independently.
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

      {generatedMessage && generationMessage ? (
        <div className="notice notice--warning" role="status">
          {generationMessage}
        </div>
      ) : null}

      {missingFieldsError ? (
        <div className="notice notice--error" role="alert">
          Survey name and primary language are required.
        </div>
      ) : null}

      {unsupportedLanguageError ? (
        <div className="notice notice--error" role="alert">
          The submitted language selection is not supported. Reload the page and
          select a language again.
        </div>
      ) : null}

      {missingTargetsError ? (
        <div className="notice notice--error" role="alert">
          Select at least one behavioural concept before generating a survey.
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
          <span className="overview-band__value">{savedConceptKeys.length}</span>
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
