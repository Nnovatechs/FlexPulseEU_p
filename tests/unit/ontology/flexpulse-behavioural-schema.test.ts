import { describe, expect, it } from "vitest";
import {
  FLEXPULSE_DER_ASSET_VALUES,
  deriveSchemaTargetsFromBehaviouralConceptKeys,
  flexpulseApplicabilityFactors,
  flexpulseBehaviouralModulators,
  flexpulseBehaviouralSchemaV1,
  flexpulsePrimaryProfileAxes,
  getFlexpulseBehaviouralConcept,
  resolveFlexpulseAnalysisModel,
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

  it("keeps analysis models on every concept without changing primary axes", () => {
    expect(
      flexpulseBehaviouralSchemaV1.every((concept) => concept.analysis_model != null),
    ).toBe(true);
    expect(getFlexpulseBehaviouralConcept("awareness_of_energy_systems")?.analysis_model).toMatchObject({
      measurement_role: "reflective_candidate",
      reliability_applicable: true,
    });
    expect(getFlexpulseBehaviouralConcept("tariff_preference_orientation")?.analysis_model.measurement_role).toBe(
      "descriptive_composite",
    );
    expect(getFlexpulseBehaviouralConcept("declared_flexibility_capability")?.analysis_model).toMatchObject({
      measurement_role: "conditional_module",
      reliability_applicable: false,
    });
    expect(getFlexpulseBehaviouralConcept("manual_override_need")?.analysis_model.measurement_role).toBe(
      "descriptive_composite",
    );
    expect(getFlexpulseBehaviouralConcept("owned_der_assets")?.analysis_model.measurement_role).toBe(
      "not_applicable",
    );
    expect(
      resolveFlexpulseAnalysisModel({
        schemaNamespace: "flexpulse_behavioural_schema",
        schemaVersion: 1,
        conceptKey: "trust_in_automation",
      })?.measurement_role,
    ).toBe("reflective_candidate");
  });
});
