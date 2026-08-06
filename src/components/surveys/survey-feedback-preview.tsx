import { getSurveyFeedbackQuestions } from "@/features/surveys/feedback";

type SurveyFeedbackPreviewProps = {
  recommendedCopy: string;
};

export function SurveyFeedbackPreview({ recommendedCopy }: SurveyFeedbackPreviewProps) {
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
      </div>

      <div className="survey-feedback-preview__notes">
        <p>{recommendedCopy}</p>
        <p>Respondents will see this section only after the main survey is already stored.</p>
        <p>The text block warns respondents not to include personal information and asks for honest feedback.</p>
      </div>

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
