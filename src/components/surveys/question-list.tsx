import { SurveyQuestion } from "@/features/surveys/types";

type QuestionListProps = {
  questions: SurveyQuestion[];
};

export function QuestionList({ questions }: QuestionListProps) {
  return (
    <div className="stack-list">
      {questions.map((question, index) => (
        <article key={question.id} className="question-card">
          <div className="question-card__index">{index + 1}</div>
          <div className="question-card__body">
            <div className="question-card__topline">
              <h3>{question.title}</h3>
              <span className="meta-pill">{question.type}</span>
            </div>
            <p>{question.description || "No description yet."}</p>
            <small>{question.required ? "Required" : "Optional"}</small>
          </div>
        </article>
      ))}
    </div>
  );
}
