import { describe, expect, it } from "vitest";
import { deriveSchemaTargetsFromBehaviouralConceptKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import { getGeneratorTargetConfigs } from "@/features/surveys/generator-config";
import { buildMeasurementPlannerPrompt } from "@/features/surveys/survey-generation-prompts";
import { createMeasurementPlanBlueprint } from "@/features/surveys/measurement-plan";

describe("measurement planner prompt", () => {
  it("uses explicit agent blocks instead of a flat instruction blob", () => {
    const behaviouralConceptKeys = ["trust_in_automation"];
    const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
      behaviouralConceptKeys,
    );
    const configs = getGeneratorTargetConfigs(schemaTargets);
    const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
      behaviouralConceptKeys,
    );

    const prompt = buildMeasurementPlannerPrompt({
      surveyName: "Flexibility trust survey",
      surveyDescription: "Study household attitudes toward automation.",
      defaultLanguage: "English",
      supportedLanguages: ["English", "Spanish"],
      behaviouralConceptKeys,
      schemaTargets,
      configs,
      baseMeasurementPlanBlueprint,
    });

    expect(prompt.system).toContain("Identity:");
    expect(prompt.system).toContain("Mission:");
    expect(prompt.system).toContain("Limits:");
    expect(prompt.system).toContain("System context:");
    expect(prompt.system).toContain("Decision principles:");
    expect(prompt.system).toContain("Output contract:");
    expect(prompt.system).toContain("Completion criterion:");
    expect(prompt.system).toContain(
      "the system is not providing a recommended total question budget",
    );
    expect(prompt.user).toContain("Application context:");
    expect(prompt.user).toContain("Server-provided planning envelope:");
    expect(prompt.user).toContain("slot_count");
    expect(prompt.user).not.toContain("Recommended visible question budget");
    expect(prompt.user).not.toContain("target 3");
  });

  it("injects repair feedback only when present", () => {
    const behaviouralConceptKeys = ["trust_in_automation"];
    const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
      behaviouralConceptKeys,
    );
    const configs = getGeneratorTargetConfigs(schemaTargets);
    const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
      behaviouralConceptKeys,
    );

    const prompt = buildMeasurementPlannerPrompt({
      surveyName: "Trust survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      behaviouralConceptKeys,
      schemaTargets,
      configs,
      baseMeasurementPlanBlueprint,
      repairFeedback: [
        'measurement_planner_output: Planner selected unsupported measurement type "meaningless".',
      ],
    });

    expect(prompt.user).toContain(
      "Feedback from the previous invalid planning attempt:",
    );
    expect(prompt.user).toContain("Fix those issues while preserving");
  });

  it("allows context concepts to reach the planner as slot-free passthrough signals", () => {
    const behaviouralConceptKeys = ["trust_in_automation", "country_code"];
    const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
      behaviouralConceptKeys,
    );
    const configs = getGeneratorTargetConfigs(schemaTargets);
    const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
      behaviouralConceptKeys,
    );

    const prompt = buildMeasurementPlannerPrompt({
      surveyName: "Context-aware trust survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      behaviouralConceptKeys,
      schemaTargets,
      configs,
      baseMeasurementPlanBlueprint,
    });

    expect(prompt.user).toContain("country_code");
    expect(prompt.user).toContain("evidence source: response_context");
    expect(prompt.user).toContain("slot capacity max: 0");
    expect(prompt.user).toContain("For context-only or quality-only concepts");
  });
});
