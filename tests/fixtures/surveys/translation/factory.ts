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

function getDefaultTargetSurveyTitle(language: string) {
  if (language === "Spanish") return "Encuesta sobre flexibilidad energética";
  if (language === "Croatian") return "Anketa o energetskoj fleksibilnosti";
  if (language === "French") return "Enquête sur la flexibilité énergétique";
  return "Energy flexibility survey";
}

function getDefaultTargetSurveyDescription(language: string) {
  if (language === "Spanish") {
    return "Un breve cuestionario sobre cómo su hogar podría desplazar algunas tareas que consumen electricidad a otras horas.";
  }
  if (language === "Croatian") {
    return "Kratak upitnik o tome kako bi vaše kućanstvo moglo prebaciti dio potrošnje električne energije na druga doba dana.";
  }
  if (language === "French") {
    return "Un court questionnaire sur la manière dont votre foyer pourrait déplacer certaines consommations d'électricité à d'autres moments de la journée.";
  }
  return "A short questionnaire about how your household might move some electricity use to different times of day.";
}

function getDefaultSurveyTitle(language: string) {
  if (language === "Spanish") return "Encuesta sobre flexibilidad energética";
  if (language === "Croatian") return "Anketa o energetskoj fleksibilnosti";
  if (language === "French") return "Enquête sur la flexibilité énergétique";
  return "Energy flexibility survey";
}

function getDefaultSurveyDescription(language: string) {
  if (language === "Spanish") {
    return "Un breve cuestionario sobre cómo su hogar podría desplazar algunas tareas que consumen electricidad a otras horas.";
  }
  if (language === "Croatian") {
    return "Kratak upitnik o tome kako bi vaše kućanstvo moglo prebaciti dio potrošnje električne energije na druga doba dana.";
  }
  if (language === "French") {
    return "Un court questionnaire sur la manière dont votre foyer pourrait déplacer certaines consommations d'électricité à d'autres moments de la journée.";
  }
  return "A short questionnaire about how your household might move some electricity use to different times of day.";
}

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
  ontologyTarget = "flexpulse_behavioural_schema.trust_in_automation",
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
  definition.translations[sourceLanguage].survey_title = getDefaultSurveyTitle(sourceLanguage);
  definition.translations[sourceLanguage].survey_description =
    getDefaultSurveyDescription(sourceLanguage);
  definition.translations[sourceLanguage].questions[questionKey] = {
    title: sourceTitle,
    ...(sourceDescription ? { description: sourceDescription } : {}),
    options: Object.fromEntries(
      optionLabels.map((label, index) => [`opt_${index + 1}`, label]),
    ),
  };

  definition.translations[targetLanguage] = {
    survey_title: getDefaultTargetSurveyTitle(targetLanguage),
    survey_description: getDefaultTargetSurveyDescription(targetLanguage),
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
