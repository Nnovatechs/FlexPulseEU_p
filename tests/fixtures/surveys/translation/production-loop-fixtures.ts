import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type SurveyLanguageCode,
  type SurveyLanguageTranslations,
  type SurveyMappingDefinition,
  type SurveyQuestionDefinition,
} from "@/features/surveys/generator-types";

type ProductionLoopQuestionFixture = {
  questionKey: string;
  ontologyTarget: string;
  title: string;
  description?: string;
  optionLabels: string[];
};

export type ProductionTranslationLoopFixture = {
  id: string;
  purpose: string;
  surveyName: string;
  sourceLanguage: SurveyLanguageCode;
  targetLanguages: SurveyLanguageCode[];
  questions: SurveyQuestionDefinition[];
  mappings: SurveyMappingDefinition[];
  sourceTranslations: SurveyLanguageTranslations;
  expectedFinalPass: true;
};

function buildProductionTranslationLoopFixture(input: {
  id: string;
  purpose: string;
  surveyName: string;
  sourceLanguage: SurveyLanguageCode;
  targetLanguages: SurveyLanguageCode[];
  surveyTitle: string;
  surveyDescription: string;
  questions: ProductionLoopQuestionFixture[];
}): ProductionTranslationLoopFixture {
  const definition = createInitialSurveyDefinition(input.sourceLanguage, [
    input.sourceLanguage,
    ...input.targetLanguages,
  ]);
  const mappingContract = createInitialMappingContract();

  definition.translations[input.sourceLanguage].survey_title = input.surveyTitle;
  definition.translations[input.sourceLanguage].survey_description = input.surveyDescription;

  definition.questions = input.questions.map((question, index) => {
    const optionEntries = question.optionLabels.map((label, optionIndex) => [
      `opt_${optionIndex + 1}`,
      label,
    ]);

    definition.translations[input.sourceLanguage].questions[question.questionKey] = {
      title: question.title,
      ...(question.description ? { description: question.description } : {}),
      options: Object.fromEntries(optionEntries),
    };

    return {
      question_key: question.questionKey,
      type: "single_choice",
      required: true,
      order: index + 1,
      options: optionEntries.map((_, optionIndex) => ({
        option_key: `opt_${optionIndex + 1}`,
        value: `value_${optionIndex + 1}`,
      })),
    } satisfies SurveyQuestionDefinition;
  });

  mappingContract.mappings = input.questions.map((question) => ({
    question_key: question.questionKey,
    ontology_target: question.ontologyTarget,
    expected_type: "string",
    required_for_mapping: true,
    transform_strategy: { kind: "identity" },
  }));

  return {
    id: input.id,
    purpose: input.purpose,
    surveyName: input.surveyName,
    sourceLanguage: input.sourceLanguage,
    targetLanguages: input.targetLanguages,
    questions: definition.questions,
    mappings: mappingContract.mappings,
    sourceTranslations: definition.translations[input.sourceLanguage],
    expectedFinalPass: true,
  };
}

// These fixtures evaluate the real multicultural pipeline:
// translate -> validate -> retry with validator feedback.
// All source surveys are intentionally publishable in the canonical language, so
// the key question is whether the loop can produce a clean final localized
// version for each target language rather than whether the validator can spot
// synthetic broken translations in isolation.
export const productionTranslationLoopFixtures: ProductionTranslationLoopFixture[] = [
  buildProductionTranslationLoopFixture({
    id: "en-core-household-flexibility",
    purpose:
      "Source in English with routine automation, tariff preference, and comfort-protection wording that should localize cleanly to every other canonical language.",
    surveyName: "Household flexibility readiness",
    sourceLanguage: "English",
    targetLanguages: ["Spanish", "French", "Croatian"],
    surveyTitle: "Household energy flexibility survey",
    surveyDescription:
      "A short survey about how your household feels about automation, tariffs, and comfort protection.",
    questions: [
      {
        questionKey: "Q_EN_01",
        ontologyTarget: "flexpulse_behavioural_schema.trust_in_automation",
        title:
          "How comfortable would you be if your home's energy system automatically moved dishwasher or laundry use to cheaper hours?",
        description: "Answer based on what would feel acceptable in your household today.",
        optionLabels: [
          "Very uncomfortable",
          "Somewhat uncomfortable",
          "Neutral",
          "Somewhat comfortable",
          "Very comfortable",
        ],
      },
      {
        questionKey: "Q_EN_02",
        ontologyTarget: "flexpulse_behavioural_schema.preferred_tariff_model",
        title: "Which electricity tariff model would you be most willing to choose?",
        description: "Choose the option that best matches your preference right now.",
        optionLabels: [
          "Same price most of the time",
          "Lower prices at certain times",
          "Rewards for shifting use when asked",
        ],
      },
      {
        questionKey: "Q_EN_03",
        ontologyTarget: "flexpulse_behavioural_schema.flexibility_willingness",
        title:
          "I would join a household energy programme if it clearly explained how my comfort would be protected.",
        description: "Think about heating, cooling, and everyday routines at home.",
        optionLabels: ["Strongly disagree", "Neutral", "Strongly agree"],
      },
    ],
  }),
  buildProductionTranslationLoopFixture({
    id: "es-factura-estable-y-automatizacion",
    purpose:
      "Source in Spanish with stable-bill trade-offs and plain household framing that should remain natural after localization.",
    surveyName: "Preferencias del hogar sobre flexibilidad",
    sourceLanguage: "Spanish",
    targetLanguages: ["English", "French", "Croatian"],
    surveyTitle: "Encuesta sobre flexibilidad energética del hogar",
    surveyDescription:
      "Un cuestionario breve sobre automatización, tarifas y condiciones para participar.",
    questions: [
      {
        questionKey: "Q_ES_01",
        ontologyTarget: "flexpulse_behavioural_schema.bill_stability_need",
        title:
          "Preferiría pagar un precio estable por la electricidad antes que tener que gestionar precios que cambian a lo largo del día.",
        description: "Responde según lo que encajaría mejor con tu hogar hoy.",
        optionLabels: ["Totalmente en desacuerdo", "Neutral", "Totalmente de acuerdo"],
      },
      {
        questionKey: "Q_ES_02",
        ontologyTarget: "flexpulse_behavioural_schema.trust_in_automation",
        title:
          "Me sentiría cómodo si el sistema energético de mi hogar ajustara automáticamente algunos usos a horas más baratas.",
        description: "Piensa en tareas domésticas que no requieren atención constante.",
        optionLabels: ["Nada cómodo", "Neutral", "Muy cómodo"],
      },
      {
        questionKey: "Q_ES_03",
        ontologyTarget: "flexpulse_behavioural_schema.explainability_need",
        title:
          "Me resultaría más fácil apuntarme a un programa energético si sus condiciones fueran simples de entender antes de decidir.",
        description: "Piensa en cómo te explican el funcionamiento y las condiciones.",
        optionLabels: ["No", "Quizás", "Sí"],
      },
    ],
  }),
  buildProductionTranslationLoopFixture({
    id: "fr-offre-energie-et-confort",
    purpose:
      "Source in French with offer explainability and comfort framing so we can observe whether the loop keeps native survey register across targets.",
    surveyName: "Acceptation des offres energetiques",
    sourceLanguage: "French",
    targetLanguages: ["English", "Spanish", "Croatian"],
    surveyTitle: "Enquete sur la flexibilite energetique du foyer",
    surveyDescription:
      "Un court questionnaire sur l'automatisation, la clarte des offres et la protection du confort.",
    questions: [
      {
        questionKey: "Q_FR_01",
        ontologyTarget: "flexpulse_behavioural_schema.explainability_need",
        title:
          "Je serais plus a l'aise avec une offre d'electricite si elle etait simple a comprendre avant de m'inscrire.",
        description: "Repondez en pensant a ce qui vous aiderait vraiment a prendre une decision.",
        optionLabels: ["Pas du tout d'accord", "Neutre", "Tout a fait d'accord"],
      },
      {
        questionKey: "Q_FR_02",
        ontologyTarget: "flexpulse_behavioural_schema.flexibility_willingness",
        title:
          "J'envisagerais de participer si l'on expliquait clairement comment mon confort quotidien serait protege.",
        description: "Pensez au chauffage, au refroidissement et aux habitudes du foyer.",
        optionLabels: ["Non", "Peut-etre", "Oui"],
      },
      {
        questionKey: "Q_FR_03",
        ontologyTarget: "flexpulse_behavioural_schema.preferred_tariff_model",
        title: "Quel modele de tarif d'electricite prefereriez-vous ?",
        description: "Choisissez l'option qui correspond le mieux a votre preference actuelle.",
        optionLabels: [
          "Un prix presque toujours identique",
          "Des prix plus bas a certains moments",
          "Des avantages si l'on vous demande de deplacer certains usages",
        ],
      },
    ],
  }),
  buildProductionTranslationLoopFixture({
    id: "hr-kucna-fleksibilnost-i-rutine",
    purpose:
      "Source in Croatian with routine-compatible wording to cover Croatian as a canonical source language in the end-to-end loop.",
    surveyName: "Spremnost kucanstva na fleksibilnost",
    sourceLanguage: "Croatian",
    targetLanguages: ["English", "Spanish", "French"],
    surveyTitle: "Anketa o energetskoj fleksibilnosti kucanstva",
    surveyDescription:
      "Kratak upitnik o automatizaciji, cijenama elektricne energije i uvjetima sudjelovanja.",
    questions: [
      {
        questionKey: "Q_HR_01",
        ontologyTarget: "flexpulse_behavioural_schema.trust_in_automation",
        title:
          "Koliko bi vam odgovaralo da sustav u domu automatski prebaci neke uredaje na jeftinije sate?",
        description: "Odgovorite prema onome sto bi bilo prihvatljivo u vasem kucanstvu danas.",
        optionLabels: ["Nimalo", "Neutralno", "Vrlo"],
      },
      {
        questionKey: "Q_HR_02",
        ontologyTarget: "flexpulse_behavioural_schema.bill_stability_need",
        title:
          "Radije bih imao/la stabilan racun za struju nego svaki dan pratio/la promjene cijena.",
        description: "Mislite na ono sto bi vam bilo jednostavnije u svakodnevici.",
        optionLabels: ["Uopce se ne slazem", "Neutralno", "U potpunosti se slazem"],
      },
      {
        questionKey: "Q_HR_03",
        ontologyTarget: "flexpulse_behavioural_schema.flexibility_willingness",
        title:
          "Pridruzio/la bih se programu kada bi jasno objasnio kako ce zastititi moju udobnost kod kuce.",
        description: "Mislite na grijanje, hladenje i svakodnevne navike u domu.",
        optionLabels: ["Ne", "Mozda", "Da"],
      },
    ],
  }),
];
