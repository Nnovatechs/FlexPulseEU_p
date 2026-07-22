import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/surveys/generator-service", () => ({
  generateMeasurementPlanWithLLM: vi.fn(),
  generateSurveyWithLLM: vi.fn(),
}));

import { deriveSchemaTargetsFromBehaviouralConceptKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import {
  DFC_INVENTORY_QUESTION_KEY,
  DFC_INVENTORY_SLOT_KEY,
  createDeclaredFlexibilityCapabilityBlueprintArtifact,
  createDeclaredFlexibilityCapabilityDefinitionArtifacts,
} from "@/features/surveys/declared-flexibility-capability-module";
import {
  generateMeasurementPlanWithLLM,
  generateSurveyWithLLM,
} from "@/features/surveys/generator-service";
import {
  createInitialSurveyDefinition,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";
import { generateSurveyDraftProposal } from "@/features/surveys/survey-generation-flow";
import { parseSurveyLanguageLLMOutput } from "@/features/surveys/translation-output";

const mockedPlanner = vi.mocked(generateMeasurementPlanWithLLM);
const mockedWriter = vi.mocked(generateSurveyWithLLM);

function buildSurveyFixture(conceptKeys: string[]): PersistedSurvey {
  const targets = deriveSchemaTargetsFromBehaviouralConceptKeys(conceptKeys);
  const definition = createInitialSurveyDefinition("English", [
    "English",
    "Spanish",
  ]);
  definition.survey_meta.behavioural_concept_keys = conceptKeys;
  definition.survey_meta.ontology_targets = targets;

  return {
    id: "survey_dfc",
    name: "Capability survey",
    status: "draft",
    created_by: "user_1",
    created_at: "2026-07-21T10:00:00.000Z",
    updated_at: "2026-07-21T10:00:00.000Z",
    published_at: null,
    default_language: "English",
    supported_languages: ["English", "Spanish"],
    definition_json: definition,
    mapping_contract_json: { schema_version: 1, mappings: [] },
    mapping_compiled_json: null,
    mapping_hash: null,
  };
}

describe("DFC generation-language flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("filters the planner, locks writer slots, and imposes deterministic DFC artifacts", async () => {
    const conceptKeys = [
      "trust_in_automation",
      "declared_flexibility_capability",
      "owned_der_assets",
    ];
    const schemaTargets =
      deriveSchemaTargetsFromBehaviouralConceptKeys(conceptKeys);
    const capabilityBlueprint =
      createDeclaredFlexibilityCapabilityBlueprintArtifact();
    const deterministicArtifacts =
      createDeclaredFlexibilityCapabilityDefinitionArtifacts();
    const capabilityQuestionBySlot = new Map(
      capabilityBlueprint.sets.flatMap((set) =>
        set.questions.map((question) => [
          question.slot_key,
          question.question_key,
        ]),
      ),
    );

    mockedPlanner.mockResolvedValue({
      concepts: [
        {
          concept_key: "trust_in_automation",
          measurement_type: "single_item_direct",
          aggregation_rule: "identity",
          threshold_profile: "likert_1_5_low_mid_high",
          slot_count: 1,
          slot_intents: [
            {
              facet: "reliability",
              intent: "Measure trust in a concrete automated action.",
              polarity: "positive",
            },
          ],
        },
      ],
    });
    mockedWriter.mockImplementation(async (input) => ({
      survey_title: "Writer capability survey",
      survey_description: "Writer description",
      estimated_completion_minutes: 8,
      questions: input.measurementPlanBlueprint.concepts.flatMap((concept) =>
        concept.question_slots.map((slot) => {
          if (slot.slot_key === "SLOT_TRUST_IN_AUTOMATION_01") {
            return {
              slot_key: slot.slot_key,
              title: "I trust automation to delay one appliance safely.",
              description: "",
              ontology_target:
                "flexpulse_behavioural_schema.trust_in_automation",
              type: "rating_scale" as const,
              options: [],
              scale: {
                min: 1,
                max: 5,
                step: 1,
                min_label: "Low",
                max_label: "High",
              },
              numeric: null,
            };
          }

          const inventory = slot.slot_key === DFC_INVENTORY_SLOT_KEY;
          return {
            slot_key: slot.slot_key,
            title: `Writer copy for ${slot.slot_key}`,
            description: `Writer description for ${slot.slot_key}`,
            ontology_target: "writer.control.is.ignored",
            type: inventory ? ("multiple_choice" as const) : ("rating_scale" as const),
            options: inventory
              ? deterministicArtifacts.questions[0].options!.map((option) => ({
                  label: `Writer label ${option.option_key}`,
                  ontology_value: option.option_key,
                  is_truthy: false,
                }))
              : [],
            scale: inventory
              ? null
              : {
                  min: 99,
                  max: 100,
                  step: 0.5,
                  min_label: "Not true for me",
                  max_label: "Completely true for me",
                },
            numeric: null,
          };
        }),
      ),
    }));

    const proposal = await generateSurveyDraftProposal({
      survey: buildSurveyFixture(conceptKeys),
      surveyName: "Capability survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English", "Spanish"],
      behaviouralConceptKeys: conceptKeys,
      schemaTargets,
    });

    expect(mockedPlanner).toHaveBeenCalledWith(
      expect.objectContaining({
        behaviouralConceptKeys: ["trust_in_automation"],
        schemaTargets: [
          "flexpulse_behavioural_schema.trust_in_automation",
        ],
      }),
    );
    const writerBlueprint =
      mockedWriter.mock.calls[0]![0].measurementPlanBlueprint;
    expect(
      writerBlueprint.concepts.flatMap((concept) =>
        concept.question_slots.map((slot) => slot.slot_key),
      ),
    ).toHaveLength(22);
    expect(
      writerBlueprint.concepts.map((concept) => concept.concept_key),
    ).toEqual([
      "trust_in_automation",
      "owned_der_assets",
      "declared_flexibility_capability",
    ]);

    expect(proposal.definition.survey_meta.capability_module_version).toBe(
      "v1",
    );
    expect(proposal.definition.questions).toHaveLength(22);
    expect(proposal.definition.questions[1]).toEqual({
      ...deterministicArtifacts.questions[0],
      order: 2,
    });
    expect(
      proposal.definition.questions
        .slice(2)
        .map((question) => question.question_key),
    ).toEqual(
      capabilityBlueprint.sets.flatMap((set) =>
        set.questions.map((question) => question.question_key),
      ),
    );
    expect(
      proposal.definition.translations.English.questions[
        DFC_INVENTORY_QUESTION_KEY
      ].title,
    ).toBe(`Writer copy for ${DFC_INVENTORY_SLOT_KEY}`);

    for (const [slotKey, questionKey] of capabilityQuestionBySlot) {
      expect(
        proposal.definition.translations.English.questions[questionKey].title,
      ).toBe(`Writer copy for ${slotKey}`);
      expect(
        proposal.definition.translations.English.questions[questionKey].scale,
      ).toEqual({
        min_label: "Not true for me",
        max_label: "Completely true for me",
      });
      expect(
        proposal.definition.questions.find(
          (question) => question.question_key === questionKey,
        )?.scale,
      ).toEqual({ min: 1, max: 5, step: 1 });
    }
    expect(proposal.definition.translations.Spanish.questions).toEqual({});
    expect(
      proposal.measurementPlan.concepts.find(
        (concept) =>
          concept.concept_key === "declared_flexibility_capability",
      ),
    ).toMatchObject({
      measurement_type: "multi_item_likert_mean",
      aggregation_rule: "mean",
      minimum_answer_count: 4,
    });
  });

  it("preserves deterministic DFC question and option keys in translated copy", () => {
    const artifacts =
      createDeclaredFlexibilityCapabilityDefinitionArtifacts();
    const translated = parseSurveyLanguageLLMOutput({
      content: JSON.stringify({
        survey_title: "Capacidad flexible",
        survey_description: "",
        questions: artifacts.questions.map((question) => ({
          question_key: question.question_key,
          title: `Traducción ${question.question_key}`,
          description: "",
          options: (question.options ?? []).map((option) => ({
            option_key: option.option_key,
            label: `Traducción ${option.option_key}`,
          })),
          scale:
            question.type === "rating_scale"
              ? {
                  min_label: "Nada cierto para mí",
                  max_label: "Totalmente cierto para mí",
                }
              : null,
        })),
      }),
      refusal: null,
      questions: artifacts.questions,
      targetLanguage: "Spanish",
      operationLabel: "Translation",
    });

    expect(Object.keys(translated.questions)).toEqual(
      artifacts.questions.map((question) => question.question_key),
    );
    expect(
      Object.keys(
        translated.questions[DFC_INVENTORY_QUESTION_KEY].options ?? {},
      ),
    ).toEqual(
      artifacts.questions[0].options?.map((option) => option.option_key),
    );
    expect(
      translated.questions[artifacts.questions[1].question_key].scale,
    ).toEqual({
      min_label: "Nada cierto para mí",
      max_label: "Totalmente cierto para mí",
    });
  });
});
