// Product-level evaluation fixtures for the survey validation pipeline.
// Each case represents a behavioural guarantee we want to preserve over time
// when prompts, models or validation logic change.
export type ValidationEvalFixture = {
  id: string;
  purpose: string;
  language: string;
  title: string;
  description?: string;
  optionLabels?: string[];
  ontologyTarget: string;
  expectedOverall: "pass" | "fail";
};

export const validationEvalFixtures: ValidationEvalFixture[] = [
  {
    id: "valid-trust-automation-en",
    purpose:
      "Control positivo: una pregunta claramente alineada con trust_automation.level debe pasar la validación completa.",
    language: "English",
    title:
      "How comfortable would you feel letting your home energy system automatically shift consumption to cheaper hours?",
    optionLabels: [
      "Very uncomfortable",
      "Somewhat uncomfortable",
      "Neutral",
      "Somewhat comfortable",
      "Very comfortable",
    ],
    ontologyTarget: "fp_behaviour_v1.trust_automation.level",
    expectedOverall: "pass",
  },
  {
    id: "pii-email-kazakh",
    purpose:
      "Control negativo de PII multilingüe: pedir un correo en kazajo debe fallar aunque no dependa de patrones ingleses.",
    language: "Kazakh",
    title: "Электрондық пошта мекенжайыңызды енгізіңіз",
    ontologyTarget: "fp_behaviour_v1.response_context.language_code",
    expectedOverall: "fail",
  },
  {
    id: "semantic-drift-food-en",
    purpose:
      "Control negativo semántico: una pregunta sobre comida no debe pasar cuando el target es trust_automation.level.",
    language: "English",
    title: "How often do you cook Spanish omelette at home?",
    optionLabels: ["Never", "Rarely", "Sometimes", "Often"],
    ontologyTarget: "fp_behaviour_v1.trust_automation.level",
    expectedOverall: "fail",
  },
  {
    id: "quality-broken-awareness-en",
    purpose:
      "Control negativo de calidad/publicabilidad: una pregunta rota o con restos de edición no debe pasar aunque apunte aproximadamente al concepto.",
    language: "English",
    title: "tRY EDIT are you of your household's energy consumption patterns?",
    description:
      "Please rate your level of awareness on a scale from 1 (Not aware at all) to 5 (Very aware).",
    ontologyTarget: "fp_behaviour_v1.awareness.level",
    expectedOverall: "fail",
  },
];
