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
  languagePickerTitle: string;
  languagePickerSub: string;
  nextLabel: string;
  backLabel: string;
};

const publicCopyByLanguage: Record<string, PublicSurveyCopy> = {
  English: {
    openSurveyEyebrow: "Survey",
    openSurveyDescription: "Complete the published survey and submit your responses securely.",
    responseContextEyebrow: "Almost done",
    responseContextTitle: "One last thing",
    responseContextDescription:
      "Help us understand regional patterns. Your location is used only for aggregated research — never shared individually.",
    countryCodeLabel: "Country",
    countryCodePlaceholder: "Select a country",
    countryCodeEmpty: "Please select your country.",
    postalCodeLabel: "Postal code",
    postalCodePlaceholder: "e.g. 08001",
    submitLabel: "Submit",
    yesLabel: "Yes",
    noLabel: "No",
    thankYouEyebrow: "Done",
    thankYouTitle: "Thank you!",
    thankYouDescription: "Your response has been submitted.",
    thankYouBody: "Your answers were received and stored securely for later analysis.",
    languagePickerTitle: "Choose your language",
    languagePickerSub: "Select the language you'd like to answer this survey in.",
    nextLabel: "Continue",
    backLabel: "Back",
  },
  Spanish: {
    openSurveyEyebrow: "Encuesta",
    openSurveyDescription:
      "Completa la encuesta publicada y envía tus respuestas de forma segura.",
    responseContextEyebrow: "Casi listo",
    responseContextTitle: "Una última cosa",
    responseContextDescription:
      "Ayúdanos a entender patrones regionales. Tu ubicación se usa solo para investigación agregada, nunca de forma individual.",
    countryCodeLabel: "País",
    countryCodePlaceholder: "Selecciona un país",
    countryCodeEmpty: "Por favor selecciona tu país.",
    postalCodeLabel: "Código postal",
    postalCodePlaceholder: "p. ej. 08001",
    submitLabel: "Enviar",
    yesLabel: "Sí",
    noLabel: "No",
    thankYouEyebrow: "Listo",
    thankYouTitle: "¡Gracias!",
    thankYouDescription: "Tu respuesta ha sido enviada.",
    thankYouBody: "Tus respuestas se han recibido y guardado de forma segura para su análisis.",
    languagePickerTitle: "Elige tu idioma",
    languagePickerSub: "Selecciona el idioma en el que quieres responder esta encuesta.",
    nextLabel: "Continuar",
    backLabel: "Atrás",
  },
  French: {
    openSurveyEyebrow: "Enquête",
    openSurveyDescription:
      "Complétez l'enquête publiée et envoyez vos réponses en toute sécurité.",
    responseContextEyebrow: "Presque terminé",
    responseContextTitle: "Une dernière chose",
    responseContextDescription:
      "Aidez-nous à comprendre les tendances régionales. Votre localisation est utilisée uniquement à des fins de recherche agrégée.",
    countryCodeLabel: "Pays",
    countryCodePlaceholder: "Sélectionnez un pays",
    countryCodeEmpty: "Veuillez sélectionner votre pays.",
    postalCodeLabel: "Code postal",
    postalCodePlaceholder: "ex. 75001",
    submitLabel: "Envoyer",
    yesLabel: "Oui",
    noLabel: "Non",
    thankYouEyebrow: "Terminé",
    thankYouTitle: "Merci !",
    thankYouDescription: "Votre réponse a été envoyée.",
    thankYouBody: "Vos réponses ont été reçues et stockées en toute sécurité pour analyse.",
    languagePickerTitle: "Choisissez votre langue",
    languagePickerSub:
      "Sélectionnez la langue dans laquelle vous souhaitez répondre à cette enquête.",
    nextLabel: "Continuer",
    backLabel: "Retour",
  },
  Croatian: {
    openSurveyEyebrow: "Anketa",
    openSurveyDescription:
      "Ispunite objavljenu anketu i sigurno pošaljite svoje odgovore.",
    responseContextEyebrow: "Gotovo je",
    responseContextTitle: "Još jedna stvar",
    responseContextDescription:
      "Pomozite nam razumjeti regionalne obrasce. Vaša lokacija koristi se samo za agregirano istraživanje.",
    countryCodeLabel: "Država",
    countryCodePlaceholder: "Odaberite državu",
    countryCodeEmpty: "Molimo odaberite državu.",
    postalCodeLabel: "Poštanski broj",
    postalCodePlaceholder: "npr. 10000",
    submitLabel: "Pošalji",
    yesLabel: "Da",
    noLabel: "Ne",
    thankYouEyebrow: "Gotovo",
    thankYouTitle: "Hvala!",
    thankYouDescription: "Vaš odgovor je poslan.",
    thankYouBody: "Vaši odgovori su primljeni i sigurno pohranjeni za kasniju analizu.",
    languagePickerTitle: "Odaberite jezik",
    languagePickerSub: "Odaberite jezik na kojem želite ispuniti ovu anketu.",
    nextLabel: "Nastavi",
    backLabel: "Natrag",
  },
};

export function getPublicSurveyCopy(language: string): PublicSurveyCopy {
  return publicCopyByLanguage[language] ?? publicCopyByLanguage.English;
}
