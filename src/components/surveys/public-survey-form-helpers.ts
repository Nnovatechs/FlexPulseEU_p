import type { SurveyQuestionDefinition } from "@/features/surveys/generator-types";

const RESPONSE_GUIDANCE_NOTICE: Record<string, string> = {
  English:
    "There are no right or wrong answers. High and low responses are equally useful. Please answer according to your own household and current situation.",
  Spanish:
    "No hay respuestas correctas o incorrectas. Las respuestas altas y bajas son igual de útiles. Por favor, responda según su propio hogar y su situación actual.",
  French:
    "Il n'y a pas de bonnes ou de mauvaises réponses. Les réponses élevées comme faibles sont tout aussi utiles. Veuillez répondre en fonction de votre propre foyer et de votre situation actuelle.",
};

const TRUST_AUTOMATION_NOTICE: Record<string, string> = {
  English:
    "In the next questions, an automated home energy control means a system that can automatically change when or how much electricity selected household devices use, for example by changing appliance timing, electric vehicle charging, or heating and cooling, in response to a schedule, electricity price, or signal from an electricity provider or energy-flexibility service. If you do not currently use such a system, please answer based on the system described here.",
  Spanish:
    "En las siguientes preguntas, un control energético doméstico automatizado significa un sistema que puede cambiar automáticamente cuándo o cuánta electricidad utilizan determinados dispositivos del hogar, por ejemplo cambiando el horario de los electrodomésticos, la carga del vehículo eléctrico o la calefacción y la refrigeración, en respuesta a un horario, al precio de la electricidad o a una señal de un proveedor de electricidad o de un servicio de flexibilidad energética. Si actualmente no utiliza un sistema de este tipo, responda basándose en el sistema descrito aquí.",
  French:
    "Dans les questions suivantes, un contrôle énergétique domestique automatisé désigne un système qui peut modifier automatiquement le moment ou la quantité d'électricité utilisée par certains appareils du foyer, par exemple en modifiant le moment d'utilisation des appareils, la recharge du véhicule électrique, ou le chauffage et le refroidissement, en réponse à un horaire, au prix de l'électricité ou à un signal provenant d'un fournisseur d'électricité ou d'un service de flexibilité énergétique. Si vous n'utilisez pas actuellement un tel système, veuillez répondre en vous basant sur le système décrit ici.",
};

export function getResponseGuidanceNotice(language: string) {
  return RESPONSE_GUIDANCE_NOTICE[language] ?? RESPONSE_GUIDANCE_NOTICE.English;
}

export function getTrustAutomationNotice(language: string) {
  return TRUST_AUTOMATION_NOTICE[language] ?? TRUST_AUTOMATION_NOTICE.English;
}

export function getFirstVisibleTrustAutomationQuestionKey(
  visibleQuestions: SurveyQuestionDefinition[],
  trustAutomationQuestionKeys: Iterable<string>,
) {
  const trustAutomationQuestionKeySet = new Set(trustAutomationQuestionKeys);
  return (
    visibleQuestions.find((question) => trustAutomationQuestionKeySet.has(question.question_key))
      ?.question_key ?? null
  );
}
