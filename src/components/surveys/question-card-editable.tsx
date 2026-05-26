"use client";

import { useState, useTransition } from "react";
import { getFlexpulseBehaviouralConceptByTarget } from "@/features/ontology/flexpulse-behavioural-schema";
import { updateQuestionTranslationAction } from "@/features/surveys/actions";
import type {
  SurveyQuestionDefinition,
  SurveyMappingDefinition,
} from "@/features/surveys/generator-types";

type TranslationEntry = {
  title: string;
  description?: string;
  options?: Record<string, string>;
};

type QuestionCardEditableProps = {
  index: number;
  question: SurveyQuestionDefinition;
  mapping: SurveyMappingDefinition | undefined;
  translation: TranslationEntry | undefined;
  surveyId: string;
  defaultLanguage: string;
};

const TYPE_LABELS: Record<string, string> = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  rating_scale: "Rating scale",
  free_text: "Free text",
  numeric: "Numeric",
  boolean: "Boolean",
};

function getReadableOntologyTargetLabel(ontologyTarget: string) {
  const concept = getFlexpulseBehaviouralConceptByTarget(ontologyTarget);
  if (concept) {
    return concept.label;
  }

  const rawLabel = ontologyTarget.split(".").pop() ?? ontologyTarget;
  return rawLabel.replace(/_/g, " ");
}

export function QuestionCardEditable({
  index,
  question,
  mapping,
  translation,
  surveyId,
  defaultLanguage,
}: QuestionCardEditableProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSaveError(null);
    startTransition(async () => {
      try {
        await updateQuestionTranslationAction(formData);
        setIsEditing(false);
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Save failed. Please try again.",
        );
      }
    });
  }

  const typeBadge = (
    <span className={`qov-card__type qov-card__type--${question.type}`}>
      {TYPE_LABELS[question.type] ?? question.type}
    </span>
  );

  if (isEditing) {
    return (
      <div className="qov-card qov-card--editing">
        <form onSubmit={handleSave} className="qov-card__edit-form">
          <input type="hidden" name="surveyId" value={surveyId} />
          <input type="hidden" name="questionKey" value={question.question_key} />
          <input type="hidden" name="defaultLanguage" value={defaultLanguage} />

          <div className="qov-card__main">
            <div className="qov-card__header qov-card__header--edit">
              <span className="qov-card__number">{index + 1}</span>
              {typeBadge}
            </div>

            <label className="field">
              <span>Question text</span>
              <input
                name="title"
                defaultValue={translation?.title ?? ""}
                required
                autoFocus
                disabled={isPending}
              />
            </label>

            <label className="field">
              <span>
                Description{" "}
                <span className="muted">(optional)</span>
              </span>
              <textarea
                name="description"
                defaultValue={translation?.description ?? ""}
                rows={2}
                disabled={isPending}
              />
            </label>

            {question.options && question.options.length > 0 && (
              <div className="qov-card__options-edit">
                <span className="qov-card__options-edit-label">
                  Answer options
                </span>
                <div className="qov-card__options-edit-grid">
                  {question.options.map((opt) => (
                    <label key={opt.option_key} className="field">
                      <span className="qov-card__option-key muted">
                        {opt.option_key}
                      </span>
                      <input
                        name={`option_${opt.option_key}`}
                        defaultValue={
                          translation?.options?.[opt.option_key] ?? ""
                        }
                        disabled={isPending}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {question.scale && (
              <div className="qov-card__scale-indicator">
                <span className="qov-card__scale-indicator-label">
                  Response scale
                </span>
                <span className="qov-card__scale-indicator-value">
                  {question.scale.min}
                  {question.scale.min_label
                    ? ` — ${question.scale.min_label}`
                    : ""}
                  {"  ·  "}
                  {question.scale.max}
                  {question.scale.max_label
                    ? ` — ${question.scale.max_label}`
                    : ""}
                </span>
              </div>
            )}

            {saveError && (
              <p className="qov-card__error" role="alert">
                {saveError}
              </p>
            )}

            <div className="qov-card__edit-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={isPending}
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  setSaveError(null);
                  setIsEditing(false);
                }}
                disabled={isPending}
              >
                Cancel
              </button>
            </div>
          </div>

          {mapping && (
            <div className="qov-card__mapping">
              <span className="qov-card__mapping-label">Maps to</span>
              <span className="qov-card__mapping-target">
                {getReadableOntologyTargetLabel(mapping.ontology_target)}
              </span>
            </div>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="qov-card">
      <div className="qov-card__main">
        <div className="qov-card__header">
          <span className="qov-card__number">{index + 1}</span>
          <span className="qov-card__title">
            {translation?.title ?? question.question_key}
          </span>
          {typeBadge}
          <button
            type="button"
            className="qov-card__edit-btn"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </button>
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
            {getReadableOntologyTargetLabel(mapping.ontology_target)}
          </span>
        </div>
      )}
    </div>
  );
}
