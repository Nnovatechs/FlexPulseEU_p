export type TranslationEvalFixture = {
  id: string;
  purpose: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceTitle: string;
  targetTitle: string;
  sourceDescription?: string;
  targetDescription?: string;
  optionLabels: string[];
  translatedOptionLabels: string[];
  expectedOverall: "pass" | "fail";
};

export const translationEvalFixtures: TranslationEvalFixture[] = [
  {
    id: "fr-equivalent-trust-automation",
    purpose:
      "Control positivo: una traduccion natural y semantica al frances debe pasar parity y quality.",
    sourceLanguage: "English",
    targetLanguage: "French",
    sourceTitle:
      "How comfortable are you with your home's energy system automatically shifting consumption to cheaper hours?",
    targetTitle:
      "Dans quelle mesure vous sentez-vous a l'aise avec le fait que le systeme energetique de votre domicile deplace automatiquement la consommation vers les heures les moins cheres ?",
    sourceDescription:
      "Please answer according to your current household preferences.",
    targetDescription:
      "Veuillez repondre en fonction des preferences actuelles de votre foyer.",
    optionLabels: [
      "Very uncomfortable",
      "Somewhat uncomfortable",
      "Neutral",
      "Somewhat comfortable",
      "Very comfortable",
    ],
    translatedOptionLabels: [
      "Tres mal a l'aise",
      "Plutot mal a l'aise",
      "Neutre",
      "Plutot a l'aise",
      "Tres a l'aise",
    ],
    expectedOverall: "pass",
  },
  {
    id: "es-false-friend-drift",
    purpose:
      "Control negativo: un falso amigo o cambio de sentido en espanol debe fallar.",
    sourceLanguage: "English",
    targetLanguage: "Spanish",
    sourceTitle:
      "How comfortable are you with your home's energy system automatically shifting consumption to cheaper hours?",
    targetTitle:
      "Cuan comodo te sientes con que el sistema energetico de tu hogar cancele automaticamente el consumo en las horas mas baratas?",
    sourceDescription:
      "Please answer according to your current household preferences.",
    targetDescription:
      "Responde segun las preferencias actuales de tu hogar.",
    optionLabels: ["Very uncomfortable", "Neutral", "Very comfortable"],
    translatedOptionLabels: ["Muy incomodo", "Neutral", "Muy comodo"],
    expectedOverall: "fail",
  },
  {
    id: "hr-unnatural-wording",
    purpose:
      "Control negativo: una redaccion poco natural o rota en croata debe fallar por quality.",
    sourceLanguage: "English",
    targetLanguage: "Croatian",
    sourceTitle:
      "How comfortable are you with your home's energy system automatically shifting consumption to cheaper hours?",
    targetTitle:
      "Kako ste vi komfortan sa automaticki pomak potrosnja kuca u jeftinije sate?",
    sourceDescription:
      "Please answer according to your current household preferences.",
    targetDescription:
      "Molimo odgovorite prema sadasnje preferencije vaseg kucanstvo.",
    optionLabels: ["Very uncomfortable", "Neutral", "Very comfortable"],
    translatedOptionLabels: ["Vrlo neugodno", "Neutralno", "Vrlo ugodno"],
    expectedOverall: "fail",
  },
  {
    id: "fr-pii-added",
    purpose:
      "Control negativo: si la traduccion introduce PII que no estaba en origen debe fallar.",
    sourceLanguage: "English",
    targetLanguage: "French",
    sourceTitle:
      "How comfortable are you with your home's energy system automatically shifting consumption to cheaper hours?",
    targetTitle:
      "Dans quelle mesure vous sentez-vous a l'aise avec ce systeme ? Indiquez aussi votre adresse e-mail.",
    sourceDescription:
      "Please answer according to your current household preferences.",
    targetDescription:
      "Veuillez repondre et ajouter votre adresse e-mail pour verification.",
    optionLabels: ["Very uncomfortable", "Neutral", "Very comfortable"],
    translatedOptionLabels: ["Tres mal a l'aise", "Neutre", "Tres a l'aise"],
    expectedOverall: "fail",
  },
];
