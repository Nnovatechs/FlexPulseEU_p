import { describe, expect, it } from "vitest";
import {
  FLEXPULSE_DER_ASSET_VALUES,
  deriveSchemaTargetsFromBehaviouralConceptKeys,
  flexpulseApplicabilityFactors,
  flexpulseBehaviouralModulators,
  flexpulsePrimaryProfileAxes,
  getFlexpulseBehaviouralConcept,
} from "@/features/ontology/flexpulse-behavioural-schema";

describe("flexpulse behavioural schema v1", () => {
  it("defines the seven primary profile axes requested by the research scope", () => {
    expect(flexpulsePrimaryProfileAxes.map((concept) => concept.concept_key)).toEqual([
      "awareness_of_energy_systems",
      "flexibility_willingness",
      "declared_flexibility_capability",
      "thermal_comfort_norms",
      "tariff_preference_orientation",
      "trust_in_automation",
      "der_engagement",
    ]);
  });

  it("includes DER inventory values aligned with the open-call device list", () => {
    expect(FLEXPULSE_DER_ASSET_VALUES).toEqual([
      "pv_system",
      "battery_storage",
      "heating_system",
      "ev",
      "inverter",
      "heat_pump",
      "thermal_storage",
      "hot_water_tank",
      "programmable_appliance",
      "washing_machine",
      "air_conditioning",
    ]);

    const ownedAssets = getFlexpulseBehaviouralConcept("owned_der_assets");
    expect(ownedAssets?.validation_constraints?.allowed_values).toEqual([
      ...FLEXPULSE_DER_ASSET_VALUES,
    ]);
    expect(ownedAssets).toMatchObject({
      label: "Household energy assets and flexible appliances",
      dimension: "der_engagement",
    });
  });

  it("keeps trust constraints and event tolerance as behavioural modulators", () => {
    expect(
      flexpulseBehaviouralModulators.map((concept) => concept.concept_key),
    ).toEqual(
      expect.arrayContaining([
        "manual_override_need",
        "explainability_need",
        "bill_stability_need",
        "event_frequency_tolerance",
      ]),
    );
  });

  it("separates comfort setpoints and tariff model as applicability factors", () => {
    expect(
      flexpulseApplicabilityFactors.map((concept) => concept.concept_key),
    ).toEqual(
      expect.arrayContaining([
        "winter_comfort_setpoint_c",
        "summer_comfort_setpoint_c",
        "preferred_tariff_model",
      ]),
    );
  });

  it("derives generator ontology targets from selected behavioural concepts", () => {
    expect(
      deriveSchemaTargetsFromBehaviouralConceptKeys([
        "trust_in_automation",
        "manual_override_need",
      ]),
    ).toEqual([
      "flexpulse_behavioural_schema.trust_in_automation",
      "flexpulse_behavioural_schema.manual_override_need",
    ]);
  });
});
