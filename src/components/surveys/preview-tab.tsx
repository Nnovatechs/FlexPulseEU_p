"use client";

import { useState, useTransition } from "react";
import { publishSurveyAction } from "@/features/surveys/actions";
import type {
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

type ReadOnlyQuestionCardProps = {
  index: number;
  question: SurveyQuestionDefinition;
  mapping: SurveyMappingDefinition | undefined;
  translation:
    | SurveyDefinition["translations"][string]["questions"][string]
    | undefined;
};

function ReadOnlyQuestionCard({
  index,
  question,
  mapping,
  translation,
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
            {mapping.ontology_target}
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
  const surveyTitleForLanguage =
    activeTranslations?.survey_title || surveyTitle;
  const surveyDescriptionForLanguage =
    activeTranslations?.survey_description || surveyDescription;

  function handlePublish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setPublishError(null);
    startPublish(async () => {
      try {
        await publishSurveyAction(formData);
      } catch (err) {
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
          disabled={publishPending}
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
            />
          ))
        )}
      </div>

      {publishSection}
    </div>
  );
}
