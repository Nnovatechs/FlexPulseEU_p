import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type SurveyMappingDefinition,
  type SurveyQuestionDefinition,
} from "@/features/surveys/generator-types";

type BuildTranslationSurveyInput = {
  sourceLanguage?: string;
  targetLanguage?: string;
  questionKey?: string;
  sourceTitle?: string;
  sourceDescription?: string;
  targetTitle?: string;
  targetDescription?: string;
  optionLabels?: string[];
  translatedOptionLabels?: string[];
  ontologyTarget?: string;
};

export function buildTranslationSurveyFixture({
  sourceLanguage = "English",
  targetLanguage = "French",
  questionKey = "Q_TEST_01",
  sourceTitle = "How comfortable are you with automated load shifting?",
  sourceDescription = "Please answer based on your current household preferences.",
  targetTitle = "Quel est votre niveau de confort vis-a-vis du pilotage automatise de la consommation ?",
  targetDescription = "Veuillez repondre selon les preferences actuelles de votre foyer.",
  optionLabels = ["Very uncomfortable", "Neutral", "Very comfortable"],
  translatedOptionLabels = ["Tres mal a l'aise", "Neutre", "Tres a l'aise"],
  ontologyTarget = "fp_behaviour_v1.trust_automation.level",
}: BuildTranslationSurveyInput = {}) {
  const definition = createInitialSurveyDefinition(sourceLanguage, [
    sourceLanguage,
    targetLanguage,
  ]);

  const question: SurveyQuestionDefinition = {
    question_key: questionKey,
    type: "single_choice",
    required: true,
    order: 1,
    options: optionLabels.map((_, index) => ({
      option_key: `opt_${index + 1}`,
      value: `value_${index + 1}`,
    })),
  };

  definition.questions = [question];
  definition.translations[sourceLanguage].survey_title = "Energy flexibility survey";
  definition.translations[sourceLanguage].survey_description =
    "A short questionnaire about household flexibility preferences.";
  definition.translations[sourceLanguage].questions[questionKey] = {
    title: sourceTitle,
    ...(sourceDescription ? { description: sourceDescription } : {}),
    options: Object.fromEntries(
      optionLabels.map((label, index) => [`opt_${index + 1}`, label]),
    ),
  };

  definition.translations[targetLanguage] = {
    survey_title: "Enquete sur la flexibilite energetique",
    survey_description:
      "Un court questionnaire sur les preferences de flexibilite du foyer.",
    questions: {
      [questionKey]: {
        title: targetTitle,
        ...(targetDescription ? { description: targetDescription } : {}),
        options: Object.fromEntries(
          translatedOptionLabels.map((label, index) => [`opt_${index + 1}`, label]),
        ),
      },
    },
  };

  const mapping: SurveyMappingDefinition = {
    question_key: questionKey,
    ontology_target: ontologyTarget,
    expected_type: "string",
    required_for_mapping: true,
    transform_strategy: { kind: "identity" },
  };

  const mappingContract = createInitialMappingContract();
  mappingContract.mappings = [mapping];

  return {
    sourceLanguage,
    targetLanguage,
    definition,
    question,
    questions: definition.questions,
    sourceTranslations: definition.translations[sourceLanguage],
    targetTranslations: definition.translations[targetLanguage],
    mappings: mappingContract.mappings,
  };
}
