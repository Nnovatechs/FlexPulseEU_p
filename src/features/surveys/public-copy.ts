export type PublicSurveyCopy = {
  openSurveyEyebrow: string;
  openSurveyDescription: string;
  responseContextEyebrow: string;
  responseContextTitle: string;
  responseContextDescription: string;
  countryCodeLabel: string;
  countryCodePlaceholder: string;
  countryCodeEmpty: string;
  postalCodeLabel: string;
  postalCodePlaceholder: string;
  submitLabel: string;
  yesLabel: string;
  noLabel: string;
  thankYouEyebrow: string;
  thankYouTitle: string;
  thankYouDescription: string;
  thankYouBody: string;
  thankYouProcessing: string;
};

const publicCopyByLanguage: Record<string, PublicSurveyCopy> = {
  English: {
    openSurveyEyebrow: "Open survey",
    openSurveyDescription: "Complete the published survey and submit your responses securely.",
    responseContextEyebrow: "Response context",
    responseContextTitle: "Context for later enrichment",
    responseContextDescription:
      "This survey collects coarse location context to support later enrichment and profiling workflows.",
    countryCodeLabel: "Country",
    countryCodePlaceholder: "Select a country",
    countryCodeEmpty: "Select a country.",
    postalCodeLabel: "Postal code",
    postalCodePlaceholder: "e.g. 08001",
    submitLabel: "Submit response",
    yesLabel: "Yes",
    noLabel: "No",
    thankYouEyebrow: "Thank you",
    thankYouTitle: "Your response has been submitted",
    thankYouDescription: "Thank you for taking the time to complete this survey.",
    thankYouBody:
      "Your answers were received successfully and stored for later analysis.",
    thankYouProcessing:
      "Background enrichment and downstream processing will continue after submission.",
  },
  Spanish: {
    openSurveyEyebrow: "Encuesta abierta",
    openSurveyDescription:
      "Completa la encuesta publicada y envía tus respuestas de forma segura.",
    responseContextEyebrow: "Contexto de respuesta",
    responseContextTitle: "Contexto para enriquecimiento posterior",
    responseContextDescription:
      "Esta encuesta recoge un contexto de localización aproximado para procesos posteriores de enriquecimiento y profiling.",
    countryCodeLabel: "País",
    countryCodePlaceholder: "Selecciona un país",
    countryCodeEmpty: "Selecciona un país.",
    postalCodeLabel: "Código postal",
    postalCodePlaceholder: "p. ej. 08001",
    submitLabel: "Enviar respuesta",
    yesLabel: "Sí",
    noLabel: "No",
    thankYouEyebrow: "Gracias",
    thankYouTitle: "Tu respuesta se ha enviado",
    thankYouDescription: "Gracias por dedicar tiempo a completar esta encuesta.",
    thankYouBody:
      "Tus respuestas se han recibido correctamente y se han guardado para su análisis posterior.",
    thankYouProcessing:
      "El enriquecimiento en segundo plano y el procesamiento posterior continuarán después del envío.",
  },
  French: {
    openSurveyEyebrow: "Enquete ouverte",
    openSurveyDescription:
      "Completez l'enquete publiee et envoyez vos reponses en toute securite.",
    responseContextEyebrow: "Contexte de reponse",
    responseContextTitle: "Contexte pour un enrichissement ulterieur",
    responseContextDescription:
      "Cette enquete collecte un contexte de localisation approximatif pour un enrichissement et un profiling ulterieurs.",
    countryCodeLabel: "Pays",
    countryCodePlaceholder: "Selectionnez un pays",
    countryCodeEmpty: "Selectionnez un pays.",
    postalCodeLabel: "Code postal",
    postalCodePlaceholder: "ex. 75001",
    submitLabel: "Envoyer la reponse",
    yesLabel: "Oui",
    noLabel: "Non",
    thankYouEyebrow: "Merci",
    thankYouTitle: "Votre reponse a ete envoyee",
    thankYouDescription: "Merci d'avoir pris le temps de repondre a cette enquete.",
    thankYouBody:
      "Vos reponses ont ete recues avec succes et enregistrees pour une analyse ulterieure.",
    thankYouProcessing:
      "L'enrichissement en arriere-plan et les traitements ulterieurs continueront apres l'envoi.",
  },
  Croatian: {
    openSurveyEyebrow: "Otvorena anketa",
    openSurveyDescription:
      "Ispunite objavljenu anketu i sigurno posaljite svoje odgovore.",
    responseContextEyebrow: "Kontekst odgovora",
    responseContextTitle: "Kontekst za naknadno obogacivanje",
    responseContextDescription:
      "Ova anketa prikuplja grubi lokacijski kontekst za kasnije obogacivanje i profiliranje.",
    countryCodeLabel: "Drzava",
    countryCodePlaceholder: "Odaberite drzavu",
    countryCodeEmpty: "Odaberite drzavu.",
    postalCodeLabel: "Postanski broj",
    postalCodePlaceholder: "npr. 10000",
    submitLabel: "Posalji odgovor",
    yesLabel: "Da",
    noLabel: "Ne",
    thankYouEyebrow: "Hvala",
    thankYouTitle: "Vas odgovor je poslan",
    thankYouDescription: "Hvala vam sto ste odvojili vrijeme za ispunjavanje ankete.",
    thankYouBody:
      "Vasi odgovori su uspjesno zaprimljeni i spremljeni za kasniju analizu.",
    thankYouProcessing:
      "Pozadinsko obogacivanje i daljnja obrada nastavit ce se nakon slanja.",
  },
};

export function getPublicSurveyCopy(language: string): PublicSurveyCopy {
  return publicCopyByLanguage[language] ?? publicCopyByLanguage.English;
}
