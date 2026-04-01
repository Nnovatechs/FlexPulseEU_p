import type {
  SurveyQuestionDefinition,
  SurveyMappingDefinition,
  SurveyLanguageTranslations,
} from "@/features/surveys/generator-types";

type QuestionsOverviewProps = {
  questions: SurveyQuestionDefinition[];
  mappings: SurveyMappingDefinition[];
  translations: SurveyLanguageTranslations | null;
};

const TYPE_LABELS: Record<string, string> = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  rating_scale: "Rating scale",
  free_text: "Free text",
  numeric: "Numeric",
  boolean: "Boolean",
};

export function QuestionsOverview({
  questions,
  mappings,
  translations,
}: QuestionsOverviewProps) {
  if (questions.length === 0) {
    return (
      <div className="qov-empty">
        <p className="qov-empty__text">No questions generated yet.</p>
        <p className="qov-empty__hint muted">
          Go to <strong>Configuration</strong>, select ontology concepts and
          click <strong>Save and generate</strong>.
        </p>
      </div>
    );
  }

  const mappingByKey: Record<string, SurveyMappingDefinition> = {};
  for (const m of mappings) {
    mappingByKey[m.question_key] = m;
  }

  return (
    <div className="qov-list">
      {questions.map((q, index) => {
        const trans = translations?.questions[q.question_key];
        const mapping = mappingByKey[q.question_key];

        return (
          <div key={q.question_key} className="qov-card">
            <div className="qov-card__main">
              <div className="qov-card__header">
                <span className="qov-card__number">{index + 1}</span>
                <span className="qov-card__title">
                  {trans?.title ?? q.question_key}
                </span>
                <span className={`qov-card__type qov-card__type--${q.type}`}>
                  {TYPE_LABELS[q.type] ?? q.type}
                </span>
              </div>

              {trans?.description && (
                <p className="qov-card__description">{trans.description}</p>
              )}

              {q.options && q.options.length > 0 && (
                <div className="qov-card__options">
                  {q.options.map((opt) => (
                    <span key={opt.option_key} className="qov-card__option">
                      {trans?.options?.[opt.option_key] ?? opt.option_key}
                    </span>
                  ))}
                </div>
              )}

              {q.scale && (
                <p className="qov-card__meta muted">
                  Scale {q.scale.min}
                  {q.scale.min_label ? ` (${q.scale.min_label})` : ""} →{" "}
                  {q.scale.max}
                  {q.scale.max_label ? ` (${q.scale.max_label})` : ""}
                </p>
              )}

              {q.numeric && (
                <p className="qov-card__meta muted">
                  Numeric
                  {q.numeric.unit ? ` · ${q.numeric.unit}` : ""}
                  {q.numeric.min != null && q.numeric.max != null
                    ? ` · ${q.numeric.min}–${q.numeric.max}`
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
      })}
    </div>
  );
}
