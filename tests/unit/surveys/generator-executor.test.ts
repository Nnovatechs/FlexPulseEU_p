import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/surveys/generator-service", () => ({
  generateMeasurementPlanWithLLM: vi.fn(),
  generateSurveyWithLLM: vi.fn(),
}));

vi.mock("@/features/surveys/generator-transform", () => ({
  transformGeneratedSurvey: vi.fn(),
}));

import { generateSurveyDraftProposal } from "@/features/surveys/survey-generation-flow";
import {
  generateMeasurementPlanWithLLM,
  generateSurveyWithLLM,
} from "@/features/surveys/generator-service";
import { transformGeneratedSurvey } from "@/features/surveys/generator-transform";
import type { PersistedSurvey } from "@/features/surveys/generator-types";

const mockedGenerateMeasurementPlanWithLLM = vi.mocked(
  generateMeasurementPlanWithLLM,
);
const mockedGenerateSurveyWithLLM = vi.mocked(generateSurveyWithLLM);
const mockedTransformGeneratedSurvey = vi.mocked(transformGeneratedSurvey);

function buildSurveyFixture(): PersistedSurvey {
  return {
    id: "survey_1",
    name: "Trust survey",
    status: "draft",
    created_by: "user_1",
    created_at: "2026-04-06T10:00:00.000Z",
    updated_at: "2026-04-06T10:00:00.000Z",
    published_at: null,
    default_language: "English",
    supported_languages: ["English"],
    definition_json: {
      schema_version: 1,
      survey_meta: {
        default_language: "English",
        supported_languages: ["English"],
        behavioural_concept_keys: ["trust_in_automation"],
        ontology_targets: ["flexpulse_behavioural_schema.trust_in_automation"],
        response_context: {
          collect_country_code: false,
          collect_postal_code: false,
          enrich_weather_context: false,
        },
      },
      questions: [],
      translations: {
        English: {
          survey_title: "Trust survey",
          survey_description: "Test survey",
          questions: {},
        },
      },
      validation_rules: {
        pii: {
          allow_direct_identifiers: false,
          allow_free_text: false,
        },
        multilingual: {
          require_complete_translations: false,
        },
      },
    },
    mapping_contract_json: {
      schema_version: 1,
      mappings: [],
    },
    mapping_compiled_json: null,
    mapping_hash: null,
  };
}

describe("generateSurveyDraftProposal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("retries the planner with structured feedback before continuing", async () => {
    mockedGenerateMeasurementPlanWithLLM
      .mockResolvedValueOnce({
        concepts: [],
      })
      .mockResolvedValueOnce({
        concepts: [
          {
            concept_key: "trust_in_automation",
            measurement_type: "single_item_direct",
            aggregation_rule: "identity",
            threshold_profile: "likert_1_5_low_mid_high",
            slot_count: 1,
          },
        ],
      });

    mockedGenerateSurveyWithLLM.mockResolvedValue({
      survey_title: "ignored",
      survey_description: "ignored",
      estimated_completion_minutes: 3,
      questions: [],
    });

    mockedTransformGeneratedSurvey.mockReturnValue({
      definition: {
        schema_version: 1,
        survey_meta: {
          default_language: "English",
          supported_languages: ["English"],
          behavioural_concept_keys: ["trust_in_automation"],
          ontology_targets: ["flexpulse_behavioural_schema.trust_in_automation"],
          response_context: {
            collect_country_code: false,
            collect_postal_code: false,
            enrich_weather_context: false,
          },
        },
        questions: [
          {
            question_key: "Q_TRUST_01",
            type: "rating_scale",
            required: true,
            order: 1,
            scale: {
              min: 1,
              max: 5,
              step: 1,
              min_label: "Low",
              max_label: "High",
            },
          },
        ],
        translations: {
          English: {
            survey_title: "Trust survey",
            survey_description: "Test survey",
            questions: {
              Q_TRUST_01: {
                title:
                  "I would trust an automated system to shift some household energy use to better times.",
              },
            },
          },
        },
        validation_rules: {
          pii: {
            allow_direct_identifiers: false,
            allow_free_text: false,
          },
          multilingual: {
            require_complete_translations: false,
          },
        },
      },
      mappingContract: {
        schema_version: 1,
        mappings: [
          {
            question_key: "Q_TRUST_01",
            ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
            expected_type: "number",
            required_for_mapping: true,
            transform_strategy: { kind: "identity" },
            validation_constraints: {
              min: 1,
              max: 5,
            },
          },
        ],
      },
      slotBindings: {
        SLOT_TRUST_IN_AUTOMATION_01: "Q_TRUST_01",
      },
    });

    const proposal = await generateSurveyDraftProposal({
      survey: buildSurveyFixture(),
      surveyName: "Trust survey",
      surveyDescription: "Test survey",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      behaviouralConceptKeys: ["trust_in_automation"],
      schemaTargets: ["flexpulse_behavioural_schema.trust_in_automation"],
    });

    expect(mockedGenerateMeasurementPlanWithLLM).toHaveBeenCalledTimes(2);
    expect(mockedGenerateMeasurementPlanWithLLM.mock.calls[1]?.[0]).toMatchObject({
      repairFeedback: [
        expect.stringContaining(
          'must return a concept plan for "trust_in_automation"',
        ),
      ],
    });
    expect(proposal.measurementPlan.concepts[0]).toMatchObject({
      concept_key: "trust_in_automation",
      question_keys: ["Q_TRUST_01"],
      required_question_keys: ["Q_TRUST_01"],
    });
  });
});
