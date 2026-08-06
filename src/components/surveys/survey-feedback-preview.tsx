import { getSurveyFeedbackQuestions } from "@/features/surveys/feedback";

type SurveyFeedbackPreviewProps = {
  enabled: boolean;
  pending: boolean;
  error: string | null;
  onToggle: (nextEnabled: boolean) => void;
  recommendedCopy: string;
};

export function SurveyFeedbackPreview({
  enabled,
  pending,
  error,
  onToggle,
  recommendedCopy,
}: SurveyFeedbackPreviewProps) {
  const questions = getSurveyFeedbackQuestions();

  return (
    <div className="survey-feedback-preview">
      <div className="survey-feedback-preview__header">
        <div>
          <h3>Survey feedback</h3>
          <p className="muted">
            Static English debrief shown after the core survey. Responses are stored
            separately from scoring, mapping, and profiling.
          </p>
        </div>
        <label className="survey-feedback-preview__toggle">
          <span>{enabled ? "Enabled" : "Disabled"}</span>
          <span className="survey-feedback-preview__switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => onToggle(event.target.checked)}
              disabled={pending}
            />
            <span className="survey-feedback-preview__switch-track" />
          </span>
        </label>
      </div>

      <div className="survey-feedback-preview__notes">
        <p>{recommendedCopy}</p>
        <p>Respondents will see this section only after the main survey is already stored.</p>
        <p>The text block warns respondents not to include personal information and asks for honest feedback.</p>
      </div>

      {error ? (
        <div className="notice notice--warning" role="alert">
          {error}
        </div>
      ) : null}

      <div className="survey-feedback-preview__questions">
        {questions.map((question, index) => (
          <article key={question.id} className="survey-feedback-preview__question">
            <p className="survey-feedback-preview__question-index">{index + 1}</p>
            <h4>{question.prompt}</h4>
            {"helpText" in question && question.helpText ? (
              <p className="muted">{question.helpText}</p>
            ) : null}
            {question.type === "rating" ? (
              <p className="muted">
                {question.minLabel} to {question.maxLabel}
              </p>
            ) : (
              <p className="muted">Required free-text response.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
