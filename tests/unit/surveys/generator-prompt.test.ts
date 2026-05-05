import { describe, expect, it } from "vitest";
import { deriveSchemaTargetsFromBehaviouralConceptKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import { getGeneratorTargetConfigs } from "@/features/surveys/generator-config";
import {
  buildMeasurementPlannerPrompt,
  buildSurveyGeneratorPrompt,
} from "@/features/surveys/survey-generation-prompts";
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
    expect(prompt.user).toContain(
      "explicitly protect their boundaries when choosing slot_count",
    );
    expect(prompt.user).toContain("Application context:");
    expect(prompt.user).toContain("Server-provided planning envelope:");
    expect(prompt.user).toContain("slot_count");
    expect(prompt.user).toContain("Concept scores remain canonical downstream");
    expect(prompt.user).toContain("interpretive signal");
    expect(prompt.user).toContain("naming the mechanism, action, or trade-off");
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

  it("passes concept-specific boundaries to planner and writer prompts", () => {
    const behaviouralConceptKeys = ["savings_motivation", "bill_stability_need"];
    const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
      behaviouralConceptKeys,
    );
    const configs = getGeneratorTargetConfigs(schemaTargets);
    const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
      behaviouralConceptKeys,
    );

    const plannerPrompt = buildMeasurementPlannerPrompt({
      surveyName: "Economic flexibility survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      behaviouralConceptKeys,
      schemaTargets,
      configs,
      baseMeasurementPlanBlueprint,
    });

    expect(plannerPrompt.user).toContain(
      "Avoid measuring generic flexibility willingness, tariff preference, or bill predictability",
    );
    expect(plannerPrompt.user).toContain(
      "Avoid measuring pure savings motivation or tariff-model familiarity",
    );

    const writerPrompt = buildSurveyGeneratorPrompt({
      surveyName: "Economic flexibility survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      schemaTargets,
      configs,
      measurementPlanBlueprint: {
        schema_version: 1,
        schema_namespace: "flexpulse_behavioural_schema",
        concepts: baseMeasurementPlanBlueprint.concepts.map((concept) => ({
          ...concept,
          measurement_type: "multi_item_likert_median",
          aggregation_rule: "median",
          threshold_profile: "likert_1_5_low_mid_high",
          minimum_answer_count: 2,
          question_slots: [
            {
              slot_key: `${concept.concept_key}_slot_1`,
              facet: "importance",
              intent: "Measure importance of the construct.",
              polarity: "positive",
            },
            {
              slot_key: `${concept.concept_key}_slot_2`,
              facet: "boundary_condition",
              intent: "Measure the limiting side of the construct.",
              polarity: "negative",
            },
          ],
        })),
      },
    });

    expect(writerPrompt.system).toContain(
      "write items that cover distinct facets rather than paraphrases",
    );
    expect(writerPrompt.system).toContain(
      "Write from the household respondent's point of view",
    );
    expect(writerPrompt.system).toContain(
      "paraphrased naturally in simple Spanish",
    );
    expect(writerPrompt.system).toContain("Use one primary domain per item");
    expect(writerPrompt.system).toContain(
      "delaying laundry",
    );
    expect(writerPrompt.user).toContain(
      "Do not borrow content from neighboring constructs",
    );
    expect(writerPrompt.user).toContain("realistic household decision");
    expect(writerPrompt.user).toContain("willingness to delay");
    expect(writerPrompt.user).toContain(
      "network reliability",
    );
    expect(writerPrompt.user).toContain("lower-demand times");
    expect(writerPrompt.user).toContain("what the respondent needs to know");
    expect(writerPrompt.user).toContain("duration-only item");
    expect(writerPrompt.system).toContain("respondent-facing label");
    expect(writerPrompt.user).toContain("Same price most of the time");
    expect(writerPrompt.user).toContain("Not sure / I would need more information");
    expect(writerPrompt.user).toContain("facet: importance");
    expect(writerPrompt.user).toContain("polarity: negative");
  });
});
