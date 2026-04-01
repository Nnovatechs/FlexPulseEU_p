import { QuestionCardEditable } from "@/components/surveys/question-card-editable";
import type {
  SurveyQuestionDefinition,
  SurveyMappingDefinition,
  SurveyLanguageTranslations,
} from "@/features/surveys/generator-types";

type QuestionsOverviewProps = {
  questions: SurveyQuestionDefinition[];
  mappings: SurveyMappingDefinition[];
  translations: SurveyLanguageTranslations | null;
  surveyId: string;
  defaultLanguage: string;
};

export function QuestionsOverview({
  questions,
  mappings,
  translations,
  surveyId,
  defaultLanguage,
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
      {questions.map((q, index) => (
        <QuestionCardEditable
          key={q.question_key}
          index={index}
          question={q}
          mapping={mappingByKey[q.question_key]}
          translation={translations?.questions[q.question_key]}
          surveyId={surveyId}
          defaultLanguage={defaultLanguage}
        />
      ))}
    </div>
  );
}
