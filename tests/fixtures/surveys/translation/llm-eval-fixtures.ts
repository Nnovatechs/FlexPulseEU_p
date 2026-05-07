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
  expectedIssueTypes?: Array<"parity" | "quality" | "pii" | "cultural">;
};

// The translation golden set combines:
// - positive controls that should pass as natural localized survey wording;
// - negative controls that should fail on parity, quality, or added PII;
// - cases where closed-answer options drift even if the question looks plausible;
// - source languages beyond English so localization quality is not judged from a
//   single canonical source language only.
//
// Stable cultural battery policy:
// - INCLUDE cases where the core construct remains recognizable but the
//   localization adds moral pressure, civic framing, or market-specific cues that
//   could bias answers.
// - EXCLUDE cases that are really parity reversals, plain bad grammar, or direct
//   PII insertion, because those should stay attributable to their own issue
//   types and keep the cultural score interpretable.
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
      "Dans quelle mesure vous sentez-vous à l'aise avec le fait que le système énergétique de votre domicile déplace automatiquement la consommation vers les heures les moins chères ?",
    sourceDescription:
      "Please answer according to your current household preferences.",
    targetDescription:
      "Veuillez répondre en fonction des préférences actuelles de votre foyer.",
    optionLabels: [
      "Very uncomfortable",
      "Somewhat uncomfortable",
      "Neutral",
      "Somewhat comfortable",
      "Very comfortable",
    ],
    translatedOptionLabels: [
      "Très mal à l'aise",
      "Plutôt mal à l'aise",
      "Neutre",
      "Plutôt à l'aise",
      "Très à l'aise",
    ],
    expectedOverall: "pass",
  },
  {
    id: "es-natural-paraphrase-variable-prices",
    purpose:
      "Control positivo: una reformulacion natural en espanol no debe fallar parity solo por no ser literal.",
    sourceLanguage: "English",
    targetLanguage: "Spanish",
    sourceTitle:
      "I would rather pay a stable electricity price than have to deal with prices that change during the day.",
    targetTitle:
      "Preferiría pagar un precio estable por la electricidad antes que tener que gestionar precios que cambian a lo largo del día.",
    sourceDescription:
      "Please answer according to your current household preferences.",
    targetDescription:
      "Responde según las preferencias actuales de tu hogar.",
    optionLabels: ["Strongly disagree", "Neutral", "Strongly agree"],
    translatedOptionLabels: ["Totalmente en desacuerdo", "Neutral", "Totalmente de acuerdo"],
    expectedOverall: "pass",
  },
  {
    id: "es-household-benefits-home-register",
    purpose:
      "Control positivo: una version publicable en espanol no debe fallar parity por una leve variacion de registro si la interpretacion sigue siendo la misma.",
    sourceLanguage: "English",
    targetLanguage: "Spanish",
    sourceTitle:
      "I would consider adopting a home energy technology if it offered practical benefits for my household.",
    targetTitle:
      "Consideraría adoptar una tecnología energética para el hogar si ofreciera beneficios prácticos para mi hogar.",
    sourceDescription:
      "Please answer according to your current household preferences.",
    targetDescription:
      "Responde según las preferencias actuales de tu hogar.",
    optionLabels: ["No", "Maybe", "Yes"],
    translatedOptionLabels: ["No", "Quizás", "Sí"],
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
    expectedIssueTypes: ["parity"],
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
    expectedIssueTypes: ["quality"],
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
    expectedIssueTypes: ["pii"],
  },
  {
    id: "es-polarity-drift",
    purpose:
      "Control negativo: la traduccion no debe invertir la direccion de una afirmacion Likert.",
    sourceLanguage: "English",
    targetLanguage: "Spanish",
    sourceTitle:
      "I prefer a stable electricity bill even if it means missing some possible savings.",
    targetTitle:
      "Prefiero una factura electrica que cambie mucho si eso me da la oportunidad de ahorrar algo.",
    sourceDescription:
      "Please answer according to your current household preferences.",
    targetDescription:
      "Responde segun las preferencias actuales de tu hogar.",
    optionLabels: ["Strongly disagree", "Neutral", "Strongly agree"],
    translatedOptionLabels: ["Totalmente en desacuerdo", "Neutral", "Totalmente de acuerdo"],
    expectedOverall: "fail",
    expectedIssueTypes: ["parity"],
  },
  {
    id: "fr-option-parity-drift",
    purpose:
      "Control negativo: una opcion cerrada mal traducida puede cambiar el valor analitico aunque la pregunta parezca correcta.",
    sourceLanguage: "English",
    targetLanguage: "French",
    sourceTitle: "Which electricity tariff model would you prefer?",
    targetTitle: "Quel modele de tarif d'electricite prefereriez-vous ?",
    sourceDescription: "Choose the option closest to your preference.",
    targetDescription: "Choisissez l'option la plus proche de votre preference.",
    optionLabels: [
      "Same price most of the time",
      "Lower prices at certain times",
      "Rewards for shifting use when asked",
    ],
    translatedOptionLabels: [
      "Prix stable la plupart du temps",
      "Prix plus bas a certains moments",
      "Penalites si vous deplacez votre consommation a la demande",
    ],
    expectedOverall: "fail",
    expectedIssueTypes: ["parity"],
  },
  {
    id: "hr-cultural-electricity-bill-context",
    purpose:
      "Control negativo cultural: una adaptacion con contexto local raro o no publicable debe fallar aunque preserve parte del sentido literal.",
    sourceLanguage: "English",
    targetLanguage: "Croatian",
    sourceTitle:
      "I would join a household energy programme if it clearly explained how my comfort would be protected.",
    targetTitle:
      "Pridruzio bih se kucnom energetskom programu ako objasni moju udobnost kao u americkom ljetnom kampu.",
    sourceDescription:
      "Please answer according to your current household preferences.",
    targetDescription:
      "Odgovorite prema trenutnim sklonostima svog kucanstva.",
    optionLabels: ["No", "Maybe", "Yes"],
    translatedOptionLabels: ["Ne", "Mozda", "Da"],
    expectedOverall: "fail",
    expectedIssueTypes: ["parity"],
  },
  {
    id: "es-to-en-natural-localization",
    purpose:
      "Control positivo: una encuesta canonica en espanol debe poder localizarse a ingles sin perder el significado ni sonar traducida literalmente.",
    sourceLanguage: "Spanish",
    targetLanguage: "English",
    sourceTitle:
      "Preferiría pagar un precio estable por la electricidad antes que tener que gestionar precios que cambian a lo largo del día.",
    targetTitle:
      "I would rather pay a stable electricity price than have to deal with prices that change during the day.",
    sourceDescription:
      "Responde según las preferencias actuales de tu hogar.",
    targetDescription:
      "Please answer according to your current household preferences.",
    optionLabels: ["Totalmente en desacuerdo", "Neutral", "Totalmente de acuerdo"],
    translatedOptionLabels: ["Strongly disagree", "Neutral", "Strongly agree"],
    expectedOverall: "pass",
  },
  {
    id: "fr-to-es-parity-drift",
    purpose:
      "Control negativo: una fuente en frances con un destino en espanol no debe aceptar cambios de sentido aunque ambos idiomas sean romances y el wording parezca plausible.",
    sourceLanguage: "French",
    targetLanguage: "Spanish",
    sourceTitle:
      "Je préfère une facture d'électricité stable même si cela réduit certaines économies possibles.",
    targetTitle:
      "Prefiero una factura eléctrica muy variable porque así puedo aprovechar cualquier posible ahorro.",
    sourceDescription:
      "Veuillez répondre selon les préférences actuelles de votre foyer.",
    targetDescription:
      "Responde según las preferencias actuales de tu hogar.",
    optionLabels: ["Pas du tout d'accord", "Neutre", "Tout à fait d'accord"],
    translatedOptionLabels: ["Totalmente en desacuerdo", "Neutral", "Totalmente de acuerdo"],
    expectedOverall: "fail",
    expectedIssueTypes: ["parity"],
  },
  {
    id: "hr-to-fr-natural-localization",
    purpose:
      "Control positivo: una fuente canonica en croata debe poder localizarse a frances con redaccion nativa y publicable.",
    sourceLanguage: "Croatian",
    targetLanguage: "French",
    sourceTitle:
      "Koliko vam odgovara da energetski sustav vašeg doma automatski prebacuje potrošnju na jeftinije sate?",
    targetTitle:
      "Dans quelle mesure êtes-vous à l'aise avec le fait que le système énergétique de votre domicile déplace automatiquement la consommation vers les heures les moins chères ?",
    sourceDescription:
      "Odgovorite prema trenutnim sklonostima svog kućanstva.",
    targetDescription:
      "Veuillez répondre en fonction des préférences actuelles de votre foyer.",
    optionLabels: ["Vrlo neugodno", "Neutralno", "Vrlo ugodno"],
    translatedOptionLabels: ["Très mal à l'aise", "Neutre", "Très à l'aise"],
    expectedOverall: "pass",
  },
  {
    id: "hr-to-en-cultural-pressure",
    purpose:
      "Control negativo cultural: una localizacion no debe introducir presion moral o framing civico que pueda sesgar la respuesta aunque siga hablando de energia.",
    sourceLanguage: "Croatian",
    targetLanguage: "English",
    sourceTitle:
      "Pridružio/la bih se kućnom energetskom programu ako bi jasno objasnio kako će zaštititi moju udobnost.",
    targetTitle:
      "I would join the programme if it helped the grid and proved that I am a responsible citizen, even before explaining how my comfort would be protected.",
    sourceDescription:
      "Odgovorite prema trenutnim sklonostima svog kućanstva.",
    targetDescription:
      "Please answer according to your current household preferences.",
    optionLabels: ["Ne", "Možda", "Da"],
    translatedOptionLabels: ["No", "Maybe", "Yes"],
    expectedOverall: "fail",
    expectedIssueTypes: ["cultural"],
  },
  {
    id: "en-to-es-cultural-civic-duty",
    purpose:
      "Control negativo cultural estable: el meaning base se conserva, pero la localizacion no debe introducir presion civica o deseabilidad social.",
    sourceLanguage: "English",
    targetLanguage: "Spanish",
    sourceTitle:
      "I would join a household energy programme if it clearly explained how my comfort would be protected.",
    targetTitle:
      "Me uniría a un programa energético del hogar si, como ciudadano responsable, ayudara a la red y mostrara compromiso con mi comunidad, siempre que también explicara cómo protegería mi comodidad.",
    sourceDescription:
      "Please answer according to your current household preferences.",
    targetDescription:
      "Responde según las preferencias actuales de tu hogar.",
    optionLabels: ["No", "Maybe", "Yes"],
    translatedOptionLabels: ["No", "Quizás", "Sí"],
    expectedOverall: "fail",
    expectedIssueTypes: ["cultural"],
  },
  {
    id: "fr-to-en-cultural-market-assumption",
    purpose:
      "Control negativo cultural estable: la localizacion no debe meter referencias de mercado o producto local que puedan sesgar la respuesta aunque el constructo siga siendo reconocible.",
    sourceLanguage: "French",
    targetLanguage: "English",
    sourceTitle:
      "Je serais plus à l'aise avec une offre d'électricité si elle était simple à comprendre avant de m'inscrire.",
    targetTitle:
      "I would be more comfortable with an electricity offer if it were easy to understand before I signed up, especially if it worked like the familiar EDF Tempo-style plans many responsible households already know.",
    sourceDescription:
      "Veuillez répondre selon les préférences actuelles de votre foyer.",
    targetDescription:
      "Please answer according to your current household preferences.",
    optionLabels: ["Pas du tout d'accord", "Neutre", "Tout à fait d'accord"],
    translatedOptionLabels: ["Strongly disagree", "Neutral", "Strongly agree"],
    expectedOverall: "fail",
    expectedIssueTypes: ["cultural"],
  },
];
