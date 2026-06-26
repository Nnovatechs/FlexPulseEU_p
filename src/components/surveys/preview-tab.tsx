"use client";

import { useState, useTransition } from "react";
import { getFlexpulseBehaviouralConceptByTarget } from "@/features/ontology/flexpulse-behavioural-schema";
import { publishSurveyAction } from "@/features/surveys/actions";
import { rethrowNextNavigationError } from "@/lib/navigation/errors";
import type {
  ContentValidationResult,
  MultilingualValidationIssue,
  MultilingualValidationResult,
  SurveyDefinition,
  SurveyLanguageCode,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "@/features/surveys/generator-types";

const TYPE_LABELS: Record<string, string> = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  rating_scale: "Rating scale",
  free_text: "Free text",
  numeric: "Numeric",
  boolean: "Boolean",
};

function getMultilingualFlagLabel(flag: MultilingualValidationIssue) {
  if (flag.severity === "advisory") return "Recommendation";
  if (flag.type === "pii") return "PII";
  if (flag.type === "quality") return "Flag";
  if (flag.type === "cultural") return "Culture";
  return "Parity";
}

function getReadableOntologyTargetLabel(ontologyTarget: string) {
  const concept = getFlexpulseBehaviouralConceptByTarget(ontologyTarget);
  if (concept) {
    return concept.label;
  }

  const rawLabel = ontologyTarget.split(".").pop() ?? ontologyTarget;
  return rawLabel.replace(/_/g, " ");
}

type ReadOnlyQuestionCardProps = {
  index: number;
  question: SurveyQuestionDefinition;
  mapping: SurveyMappingDefinition | undefined;
  translation:
    | SurveyDefinition["translations"][string]["questions"][string]
    | undefined;
  languageFlags?: MultilingualValidationIssue[];
};

function ReadOnlyQuestionCard({
  index,
  question,
  mapping,
  translation,
  languageFlags = [],
}: ReadOnlyQuestionCardProps) {
  return (
    <div className="qov-card qov-card--preview">
      <div className="qov-card__main">
        <div className="qov-card__header">
          <span className="qov-card__number">{index + 1}</span>
          <span className="qov-card__title">
            {translation?.title ?? question.question_key}
          </span>
          <span className={`qov-card__type qov-card__type--${question.type}`}>
            {TYPE_LABELS[question.type] ?? question.type}
          </span>
        </div>

        {languageFlags.length > 0 && (
          <div className="preview-tab__question-flags">
            {languageFlags.map((flag, index) => (
              <div key={`${question.question_key}-${index}`} className="preview-tab__flag">
                <span className="preview-tab__flag-badge">
                  {getMultilingualFlagLabel(flag)}
                </span>
                <span className="preview-tab__flag-message">
                  {flag.message}
                  {flag.recommendation ? ` Recommendation: ${flag.recommendation}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {translation?.description && (
          <p className="qov-card__description">{translation.description}</p>
        )}

        {question.options && question.options.length > 0 && (
          <div className="qov-card__options">
            {question.options.map((opt) => (
              <span key={opt.option_key} className="qov-card__option">
                {translation?.options?.[opt.option_key] ?? opt.option_key}
              </span>
            ))}
          </div>
        )}

        {question.scale && (
          <p className="qov-card__meta muted">
            Scale {question.scale.min}
            {question.scale.min_label ? ` (${question.scale.min_label})` : ""}{" "}
            → {question.scale.max}
            {question.scale.max_label ? ` (${question.scale.max_label})` : ""}
          </p>
        )}

        {question.numeric && (
          <p className="qov-card__meta muted">
            Numeric
            {question.numeric.unit ? ` · ${question.numeric.unit}` : ""}
            {question.numeric.min != null && question.numeric.max != null
              ? ` · ${question.numeric.min}–${question.numeric.max}`
              : ""}
          </p>
        )}
      </div>

      {mapping && (
        <div className="qov-card__mapping">
          <span className="qov-card__mapping-label">Maps to</span>
          <span className="qov-card__mapping-target">
            {getReadableOntologyTargetLabel(mapping.ontology_target)}
          </span>
        </div>
      )}
    </div>
  );
}

type PreviewTabProps = {
  surveyId: string;
  surveyTitle: string;
  surveyDescription: string;
  questions: SurveyQuestionDefinition[];
  mappings: SurveyMappingDefinition[];
  translations: SurveyDefinition["translations"];
  defaultLanguage: SurveyLanguageCode;
  supportedLanguages: SurveyLanguageCode[];
  validationResult: ContentValidationResult | null;
  multilingualValidationResult: MultilingualValidationResult | null;
  isValidationStale: boolean;
  isMultilingualValidationStale: boolean;
};

export function PreviewTab({
  surveyId,
  surveyTitle,
  surveyDescription,
  questions,
  mappings,
  translations,
  defaultLanguage,
  supportedLanguages,
  validationResult,
  multilingualValidationResult,
  isValidationStale,
  isMultilingualValidationStale,
}: PreviewTabProps) {
  const [activeLanguage, setActiveLanguage] = useState<SurveyLanguageCode>(
    defaultLanguage,
  );
  const [publishPending, startPublish] = useTransition();
  const [publishError, setPublishError] = useState<string | null>(null);

  const mappingByKey: Record<string, SurveyMappingDefinition> = {};
  for (const m of mappings) {
    mappingByKey[m.question_key] = m;
  }

  const activeTranslations = translations[activeLanguage];
  const hasSecondaryLanguages = supportedLanguages.some(
    (language) => language !== defaultLanguage,
  );
  const contentPassed =
    validationResult?.passed === true && !isValidationStale;
  const multilingualPassed =
    !hasSecondaryLanguages ||
    (multilingualValidationResult?.passed === true && !isMultilingualValidationStale);
  const canPublish = contentPassed && multilingualPassed;
  const multilingualBlockingIssueCount = (
    multilingualValidationResult?.issues ?? []
  ).filter((issue) => issue.severity !== "advisory").length;
  const surveyTitleForLanguage =
    activeTranslations?.survey_title || surveyTitle;
  const surveyDescriptionForLanguage =
    activeTranslations?.survey_description || surveyDescription;
  const activeLanguageIssues = (multilingualValidationResult?.issues ?? []).filter(
    (issue) => issue.language === activeLanguage && issue.question_key,
  );
  const surveyLevelFlags = (multilingualValidationResult?.issues ?? []).filter(
    (issue) => issue.language === activeLanguage && !issue.question_key,
  );
  const issuesByQuestionKey = activeLanguageIssues.reduce<
    Record<string, MultilingualValidationIssue[]>
  >((groups, issue) => {
    const key = issue.question_key as string;
    groups[key] = [...(groups[key] ?? []), issue];
    return groups;
  }, {});

  function handlePublish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setPublishError(null);
    startPublish(async () => {
      try {
        await publishSurveyAction(formData);
      } catch (err) {
        rethrowNextNavigationError(err);
        setPublishError(
          err instanceof Error ? err.message : "Publish failed. Please try again.",
        );
      }
    });
  }

  const publishSection = (
    <div className="preview-tab__publish">
      <p className="preview-tab__publish-hint muted">
        Publishing freezes all translations and makes the survey available for
        responses. This action cannot be undone.
      </p>

      {!contentPassed && (
        <p className="review-notice review-notice--warning">
          Preview remains available, but publication is blocked until content validation
          passes{isValidationStale ? " and is up to date" : ""}.
        </p>
      )}

      {!multilingualPassed && hasSecondaryLanguages && (
        <p className="review-notice review-notice--warning">
          Preview remains available, but publication is blocked until multicultural
          blocking flags are cleared and the adapted language versions pass validation
          {isMultilingualValidationStale ? " again" : ""}.
        </p>
      )}
      {multilingualPassed &&
        hasSecondaryLanguages &&
        multilingualBlockingIssueCount === 0 &&
        (multilingualValidationResult?.issues.length ?? 0) > 0 && (
          <p className="review-notice review-notice--success">
            Publication is allowed. Non-blocking multicultural recommendations are
            available for review before publishing.
          </p>
        )}

      {publishError && (
        <p className="review-notice review-notice--error" role="alert">
          {publishError}
        </p>
      )}

      <form onSubmit={handlePublish}>
        <input type="hidden" name="surveyId" value={surveyId} />
        <button
          type="submit"
          className="button button--primary"
          disabled={publishPending || !canPublish}
          title={
            canPublish
              ? "Publish survey"
              : "Publishing stays blocked until validation and multicultural blocking flags are resolved"
          }
        >
          {publishPending ? "Publishing…" : "Publish survey"}
        </button>
      </form>
    </div>
  );

  return (
    <div className="preview-tab">
      {publishSection}

      {/* Language sub-tabs */}
      {supportedLanguages.length > 1 && (
        <nav
          className="preview-tab__lang-nav"
          role="tablist"
          aria-label="Preview by language"
        >
          {supportedLanguages.map((language) => (
            <button
              key={language}
              type="button"
              role="tab"
              aria-selected={activeLanguage === language}
              className={`preview-tab__lang-tab${
                activeLanguage === language ? " preview-tab__lang-tab--active" : ""
              }`}
              onClick={() => setActiveLanguage(language)}
            >
              {language}
              {language === defaultLanguage && (
                <span className="preview-tab__lang-canonical muted">
                  {" "}canonical
                </span>
              )}
            </button>
          ))}
        </nav>
      )}

      {/* Survey header */}
      <div className="preview-tab__survey-header">
        <h3 className="preview-tab__survey-title">{surveyTitleForLanguage}</h3>
        {surveyDescriptionForLanguage && (
          <p className="preview-tab__survey-description muted">
            {surveyDescriptionForLanguage}
          </p>
        )}
        {surveyLevelFlags.length > 0 && (
          <div className="preview-tab__survey-flags">
            {surveyLevelFlags.map((flag, index) => (
              <div key={`${activeLanguage}-survey-${index}`} className="preview-tab__flag">
                <span className="preview-tab__flag-badge">
                  {getMultilingualFlagLabel(flag)}
                </span>
                <span className="preview-tab__flag-message">
                  {flag.message}
                  {flag.recommendation ? ` Recommendation: ${flag.recommendation}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read-only question list */}
      <div className="preview-tab__questions">
        {questions.length === 0 ? (
          <p className="muted">No questions to preview.</p>
        ) : (
          questions.map((q, index) => (
            <ReadOnlyQuestionCard
              key={q.question_key}
              index={index}
              question={q}
              mapping={mappingByKey[q.question_key]}
              translation={activeTranslations?.questions?.[q.question_key]}
              languageFlags={issuesByQuestionKey[q.question_key] ?? []}
            />
          ))
        )}
      </div>

      {publishSection}
    </div>
  );
}
