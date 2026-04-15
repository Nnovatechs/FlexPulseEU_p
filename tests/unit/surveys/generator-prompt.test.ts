import { describe, expect, it } from "vitest";
import { deriveSchemaTargetsFromBehaviouralConceptKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import { getGeneratorTargetConfigs } from "@/features/surveys/generator-config";
import { buildMeasurementPlannerPrompt } from "@/features/surveys/generator-prompt";
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
    expect(prompt.user).toContain("Server-provided planning envelope and allowed slot keys:");
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
});
