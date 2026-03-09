import { SurveyRepository } from "./contracts";
import { Survey } from "./types";

const mockSurveys: Survey[] = [
  {
    id: "survey-household-flex-001",
    title: "Household Flexibility Baseline",
    stakeholderType: "Household",
    sourceLanguage: "English",
    targetLanguages: ["Croatian", "Spanish", "French"],
    ontologyConcepts: [
      "Trusting Automation",
      "Thermal Comfort Zones",
      "Heat Pump Adoption",
    ],
    status: "Published",
    updatedAt: "2026-03-01",
    responsesCount: 184,
    questions: [
      {
        id: "q1",
        title: "Trust in automation",
        description: "How much do you trust automated flexibility control?",
        type: "scale",
        required: true,
      },
      {
        id: "q2",
        title: "Comfort boundaries",
        description:
          "Which indoor temperature range is acceptable during flexibility events?",
        type: "single-choice",
        required: true,
      },
      {
        id: "q3",
        title: "Asset readiness",
        description:
          "Which flexibility assets are available in the household today?",
        type: "multi-choice",
        required: false,
      },
    ],
  },
  {
    id: "survey-ev-behaviour-002",
    title: "EV Charging Behaviour Assessment",
    stakeholderType: "Prosumer",
    sourceLanguage: "English",
    targetLanguages: ["English", "Spanish"],
    ontologyConcepts: ["EV Charging Behaviour", "Flexibility Necessities"],
    status: "Validated",
    updatedAt: "2026-02-18",
    responsesCount: 62,
    questions: [
      {
        id: "q1",
        title: "Charging windows",
        description: "What time windows are preferred for EV charging?",
        type: "multi-choice",
        required: true,
      },
      {
        id: "q2",
        title: "Urgency profile",
        description: "How often do you need immediate charging?",
        type: "scale",
        required: true,
      },
      {
        id: "q3",
        title: "Automation preference",
        description: "Would you allow the system to optimize charging timing?",
        type: "single-choice",
        required: true,
      },
    ],
  },
  {
    id: "survey-thermal-comfort-003",
    title: "Thermal Comfort and Asset Flexibility",
    stakeholderType: "Household",
    sourceLanguage: "English",
    targetLanguages: ["Croatian", "Italian", "French", "Spanish"],
    ontologyConcepts: [
      "Thermal Comfort Zones",
      "Flexibility Necessities",
      "Heat Pump Adoption",
    ],
    status: "Draft",
    updatedAt: "2026-03-05",
    responsesCount: 0,
    questions: [
      {
        id: "q1",
        title: "Heat pump operation confidence",
        description:
          "How confident are you with automated control of your heat pump?",
        type: "scale",
        required: true,
      },
      {
        id: "q2",
        title: "Comfort constraints",
        description: "Describe non-negotiable comfort requirements.",
        type: "open-text",
        required: false,
      },
    ],
  },
];

const cloneSurvey = (survey: Survey): Survey => ({
  ...survey,
  targetLanguages: [...survey.targetLanguages],
  ontologyConcepts: [...survey.ontologyConcepts],
  questions: survey.questions.map((question) => ({ ...question })),
});

export const mockSurveyRepository: SurveyRepository = {
  async listSurveys() {
    return mockSurveys.map(cloneSurvey);
  },
  async getSurveyById(surveyId) {
    const survey = mockSurveys.find((item) => item.id === surveyId);
    return survey ? cloneSurvey(survey) : null;
  },
};
