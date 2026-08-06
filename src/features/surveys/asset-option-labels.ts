import type { SurveyLanguageCode } from "./generator-types";

export const CANONICAL_DER_ASSET_OPTION_LABELS: Record<
  string,
  Record<string, string>
> = {
  English: {
    pv_system: "Solar photovoltaic system",
    battery_storage: "Home battery system",
    heating_system: "Home heating system (other than a heat pump)",
    ev: "Electric vehicle",
    inverter: "Solar or battery inverter (if you know you have one)",
    heat_pump: "Heat pump",
    thermal_storage: "Thermal storage system",
    hot_water_tank: "Hot water tank",
    programmable_appliance: "Appliance with a timer or delayed-start setting",
    washing_machine: "Washing machine",
    air_conditioning: "Air conditioning",
    none_of_these: "None of these",
    not_sure: "Not sure",
  },
  Spanish: {
    pv_system: "Sistema fotovoltaico solar",
    battery_storage: "Batería doméstica",
    heating_system: "Sistema de calefacción del hogar (que no sea una bomba de calor)",
    ev: "Vehículo eléctrico",
    inverter: "Inversor solar o de batería (si sabe que dispone de uno)",
    heat_pump: "Bomba de calor",
    thermal_storage: "Sistema de almacenamiento térmico",
    hot_water_tank: "Depósito de agua caliente",
    programmable_appliance:
      "Electrodoméstico con temporizador o función de inicio diferido",
    washing_machine: "Lavadora",
    air_conditioning: "Aire acondicionado",
    none_of_these: "Ninguna de estas opciones",
    not_sure: "No lo sé",
  },
  French: {
    pv_system: "Système solaire photovoltaïque",
    battery_storage: "Batterie domestique",
    heating_system: "Système de chauffage du logement (hors pompe à chaleur)",
    ev: "Véhicule électrique",
    inverter: "Onduleur solaire ou de batterie (si vous savez que vous en avez un)",
    heat_pump: "Pompe à chaleur",
    thermal_storage: "Système de stockage thermique",
    hot_water_tank: "Ballon d'eau chaude",
    programmable_appliance:
      "Appareil avec minuterie ou départ différé",
    washing_machine: "Lave-linge",
    air_conditioning: "Climatisation",
    none_of_these: "Aucune de ces options",
    not_sure: "Je ne sais pas",
  },
  Croatian: {
    pv_system: "Solarni fotonaponski sustav",
    battery_storage: "Kućna baterija",
    heating_system: "Sustav grijanja u kućanstvu (osim dizalice topline)",
    ev: "Električno vozilo",
    inverter: "Solarni ili baterijski inverter (ako znate da ga imate)",
    heat_pump: "Dizalica topline",
    thermal_storage: "Sustav toplinske pohrane",
    hot_water_tank: "Spremnik tople vode",
    programmable_appliance:
      "Uređaj s timerom ili odgođenim početkom rada",
    washing_machine: "Perilica rublja",
    air_conditioning: "Klimatizacija",
    none_of_these: "Ništa od navedenog",
    not_sure: "Nisam siguran/na",
  },
};

export function getCanonicalDerAssetOptionLabel(
  value: string,
  language: SurveyLanguageCode,
) {
  return CANONICAL_DER_ASSET_OPTION_LABELS[language]?.[value.trim()] ?? null;
}

export function isDerAssetInventoryTarget(ontologyTarget: string) {
  return (
    ontologyTarget === "flexpulse_behavioural_schema.owned_der_assets" ||
    ontologyTarget === "flexpulse_behavioural_schema.interested_der_assets"
  );
}
