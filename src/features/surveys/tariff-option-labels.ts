import type { SurveyLanguageCode } from "./generator-types";

export const SUPPORTED_PREFERRED_TARIFF_ONTOLOGY_VALUES = new Set([
  "same_price",
  "time_of_use",
  "shift_rewards",
  "dynamic_price",
  "not_sure",
]);

export const CANONICAL_PREFERRED_TARIFF_OPTION_LABELS: Record<
  string,
  Record<string, string>
> = {
  English: {
    same_price: "Same price most of the time",
    time_of_use: "Cheaper electricity at certain times of day",
    shift_rewards: "Rewards for shifting use when asked",
    dynamic_price: "Prices change often, with more risk and possible savings",
    not_sure: "Not sure / I would need more information",
  },
  Spanish: {
    same_price: "El mismo precio la mayor parte del tiempo",
    time_of_use: "Electricidad más barata en ciertas horas del día",
    shift_rewards: "Recompensas por desplazar el consumo cuando se solicite",
    dynamic_price:
      "Los precios cambian con frecuencia, con más riesgo y posible ahorro",
    not_sure: "No lo sé / necesitaría más información",
  },
  French: {
    same_price: "Le même prix la plupart du temps",
    time_of_use: "Électricité moins chère à certaines heures de la journée",
    shift_rewards:
      "Récompenses pour déplacer votre consommation lorsqu'on vous le demande",
    dynamic_price:
      "Les prix changent souvent, avec plus de risque et des économies possibles",
    not_sure: "Je ne sais pas / j'aurais besoin de plus d'informations",
  },
  Croatian: {
    same_price: "Ista cijena većinu vremena",
    time_of_use: "Jeftinija električna energija u određenim dijelovima dana",
    shift_rewards: "Nagrade za pomicanje potrošnje kada se to zatraži",
    dynamic_price:
      "Cijene se često mijenjaju, uz veći rizik i moguću uštedu",
    not_sure: "Nisam siguran/na / trebalo bi mi više informacija",
  },
};

export function getCanonicalPreferredTariffOptionLabel(
  value: string,
  language: SurveyLanguageCode,
) {
  return CANONICAL_PREFERRED_TARIFF_OPTION_LABELS[language]?.[value.trim()] ?? null;
}
