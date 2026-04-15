export type PlannerEvalFixture = {
  id: string;
  purpose: string;
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  behaviouralConceptKeys: string[];
  minQuestionSlotsByConcept?: Record<string, number>;
  zeroSlotConcepts?: string[];
};

export const plannerEvalFixtures: PlannerEvalFixture[] = [
  {
    id: "core-axes-keep-multi-angle-coverage",
    purpose:
      "Control positivo: los ejes conductuales centrales no deberían degradarse a cobertura trivial de un solo ítem cuando el planner diseña el instrumento.",
    surveyName: "Household flexibility attitudes",
    surveyDescription:
      "Understand willingness, trust and home flexibility behaviour with enough coverage for later profiling.",
    defaultLanguage: "English",
    supportedLanguages: ["English", "Spanish"],
    behaviouralConceptKeys: [
      "trust_in_automation",
      "flexibility_willingness",
    ],
    minQuestionSlotsByConcept: {
      trust_in_automation: 2,
      flexibility_willingness: 2,
    },
  },
  {
    id: "context-concepts-stay-outside-question-design",
    purpose:
      "Control de arquitectura: el planner no debe inventar preguntas para conceptos que pertenecen a contexto de respuesta o enrichment.",
    surveyName: "Survey context integrity",
    surveyDescription:
      "Verify that runtime context stays outside respondent-facing question planning.",
    defaultLanguage: "English",
    supportedLanguages: ["English"],
    behaviouralConceptKeys: [
      "trust_in_automation",
      "country_code",
      "climate_context",
    ],
    zeroSlotConcepts: ["country_code", "climate_context"],
    minQuestionSlotsByConcept: {
      trust_in_automation: 2,
    },
  },
];
