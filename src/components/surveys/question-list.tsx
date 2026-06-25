import { SurveyQuestion } from "@/features/surveys/types";

type QuestionListProps = {
  questions: SurveyQuestion[];
};

export function QuestionList({ questions }: QuestionListProps) {
  return (
    <div className="survey-detail-questions">
      {questions.map((question, index) => (
        <article key={question.id} className="qov-card qov-card--preview qov-card--detail">
          <div className="qov-card__main">
            <div className="qov-card__header">
              <span className="qov-card__number">{index + 1}</span>
              <span className="qov-card__title">{question.title}</span>
              <span className={`qov-card__type qov-card__type--${question.typeKey}`}>
                {question.type}
              </span>
            </div>

            {question.optionLabels && question.optionLabels.length > 0 ? (
              <div className="qov-card__options">
                {question.optionLabels.map((label) => (
                  <span key={label} className="qov-card__option">
                    {label}
                  </span>
                ))}
              </div>
            ) : null}

            {question.scaleSummary ? (
              <p className="qov-card__meta muted">{question.scaleSummary}</p>
            ) : null}

            {question.numericSummary ? (
              <p className="qov-card__meta muted">{question.numericSummary}</p>
            ) : null}

            <p className="qov-card__meta muted">
              {question.required ? "Required" : "Optional"}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
