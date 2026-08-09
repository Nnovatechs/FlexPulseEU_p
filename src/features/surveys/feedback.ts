import type { PersistedSurvey, SurveyLanguageCode } from "./generator-types";
import type { SubmittedSurveyAnswer } from "./response-validation";
import { isQuestionVisible, orderSurveyQuestions } from "./question-visibility";

export const SURVEY_FEEDBACK_VERSION = "pilot_feedback_v1";

export type SurveyFeedbackQuestion =
  | {
      id: "ease_rating";
      type: "rating";
      prompt: string;
      minLabel: string;
      maxLabel: string;
    }
  | {
      id:
        | "unclear_questions_text"
        | "energy_flexibility_programme_text"
        | "automated_control_text"
        | "leading_questions_text"
        | "overlap_or_technical_text";
      type: "textarea";
      prompt: string;
      helpText?: string;
    };

export type SurveyFeedbackQuestionReference = {
  questionKey: string;
  index: number;
  title: string;
};

const SURVEY_FEEDBACK_QUESTIONS: SurveyFeedbackQuestion[] = [
  {
    id: "ease_rating",
    type: "rating",
    prompt: "Overall, how easy or difficult was the questionnaire to understand?",
    minLabel: "1 - Very difficult",
    maxLabel: "5 - Very easy",
  },
  {
    id: "unclear_questions_text",
    type: "textarea",
    prompt:
      "Were any questions unclear, difficult to answer or open to more than one interpretation?",
    helpText:
      'Please provide the question number or a few words from the question and briefly explain the problem. Write "None" if you did not find any unclear questions.',
  },
  {
    id: "energy_flexibility_programme_text",
    type: "textarea",
    prompt:
      'In your own words, what did you understand by a "household energy-flexibility programme" in this questionnaire?',
  },
  {
    id: "automated_control_text",
    type: "textarea",
    prompt:
      'When the questionnaire referred to an "automated home energy control", who or what did you imagine was making or carrying out the adjustments?',
  },
  {
    id: "leading_questions_text",
    type: "textarea",
    prompt:
      "Did any questions seem so easy, obvious or positively framed that they appeared to suggest a particular answer?",
    helpText:
      'Please identify the question or questions and briefly explain why. Write "None" if this did not occur.',
  },
  {
    id: "overlap_or_technical_text",
    type: "textarea",
    prompt:
      "Did any questions seem to ask essentially the same thing, or was any wording unnatural or overly technical?",
    helpText:
      'Please identify the relevant questions or expressions. Write "None" if you did not notice this.',
  },
];

function isAnsweredValue(value: SubmittedSurveyAnswer | undefined) {
  if (value == null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

export function isSurveyFeedbackEligible(defaultLanguage: string) {
  return defaultLanguage === "English";
}

export function getSurveyFeedbackQuestions() {
  return SURVEY_FEEDBACK_QUESTIONS;
}

export function buildSurveyFeedbackQuestionReferences(input: {
  survey: PersistedSurvey;
  submittedLanguage: SurveyLanguageCode;
  answers: Record<string, SubmittedSurveyAnswer>;
}): SurveyFeedbackQuestionReference[] {
  const orderedQuestions = orderSurveyQuestions(input.survey.definition_json.questions);
  const translations = input.survey.definition_json.translations;
  const activeQuestionTranslations =
    translations[input.submittedLanguage]?.questions ?? {};
  const defaultQuestionTranslations =
    translations[input.survey.default_language]?.questions ?? {};
  const visibleAnswers: Record<string, SubmittedSurveyAnswer> = {};
  const references: SurveyFeedbackQuestionReference[] = [];

  for (const question of orderedQuestions) {
    if (!isQuestionVisible(question, visibleAnswers)) {
      continue;
    }

    const answer = input.answers[question.question_key];
    if (!isAnsweredValue(answer)) {
      continue;
    }

    visibleAnswers[question.question_key] = answer;
    references.push({
      questionKey: question.question_key,
      index: references.length + 1,
      title:
        activeQuestionTranslations[question.question_key]?.title ??
        defaultQuestionTranslations[question.question_key]?.title ??
        question.question_key,
    });
  }

  return references;
}
