import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/surveys/generator-service", () => ({
  generateMeasurementPlanWithLLM: vi.fn(),
  generateSurveyWithLLM: vi.fn(),
}));

vi.mock("@/features/surveys/generator-transform", () => ({
  transformGeneratedSurvey: vi.fn(),
}));

vi.mock("@/features/surveys/canonical-language-editor", () => ({
  runCanonicalLanguageCopyEditor: vi.fn(),
}));

import { generateSurveyDraftProposal } from "@/features/surveys/survey-generation-flow";
import {
  generateMeasurementPlanWithLLM,
  generateSurveyWithLLM,
} from "@/features/surveys/generator-service";
import { runCanonicalLanguageCopyEditor } from "@/features/surveys/canonical-language-editor";
import { transformGeneratedSurvey } from "@/features/surveys/generator-transform";
import type { PersistedSurvey } from "@/features/surveys/generator-types";

const mockedGenerateMeasurementPlanWithLLM = vi.mocked(
  generateMeasurementPlanWithLLM,
);
const mockedGenerateSurveyWithLLM = vi.mocked(generateSurveyWithLLM);
const mockedRunCanonicalLanguageCopyEditor = vi.mocked(
  runCanonicalLanguageCopyEditor,
);
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

function buildCompiledSurveyFixture(overrides?: {
  defaultLanguage?: "English" | "Spanish";
  surveyTitle?: string;
  surveyDescription?: string;
  questionTitle?: string;
}) {
  const language = overrides?.defaultLanguage ?? "English";

  return {
    definition: {
      schema_version: 1 as const,
      survey_meta: {
        default_language: language,
        supported_languages: [language],
        behavioural_concept_keys: ["trust_in_automation"],
        ontology_targets: ["flexpulse_behavioural_schema.trust_in_automation"],
        response_context: {
          collect_country_code: false,
          collect_postal_code: false,
          enrich_weather_context: false,
        },
        measurement_plan_json: {
          schema_version: 1 as const,
          schema_namespace: "flexpulse_behavioural_schema" as const,
          concepts: [
            {
              concept_key: "trust_in_automation",
              evidence_source: "survey_questions" as const,
              measurement_type: "single_item_direct" as const,
              output_type: "number" as const,
              aggregation_rule: "identity" as const,
              threshold_profile: "likert_1_5_low_mid_high" as const,
              minimum_answer_count: 1,
              question_keys: ["Q_TRUST_01"],
              required_question_keys: ["Q_TRUST_01"],
              question_intents: [
                {
                  question_key: "Q_TRUST_01",
                  slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
                  facet: "reliability",
                  intent: "Measure trust in automation reliability.",
                  polarity: "positive" as const,
                },
              ],
            },
          ],
        },
      },
      questions: [
        {
          question_key: "Q_TRUST_01",
          type: "rating_scale" as const,
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
        [language]: {
          survey_title: overrides?.surveyTitle ?? "Trust survey",
          survey_description: overrides?.surveyDescription ?? "Test survey",
          questions: {
            Q_TRUST_01: {
              title:
                overrides?.questionTitle ??
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
      schema_version: 1 as const,
      mappings: [
        {
          question_key: "Q_TRUST_01",
          ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
          expected_type: "number" as const,
          required_for_mapping: true,
          transform_strategy: { kind: "identity" as const },
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
            slot_intents: [
              {
                facet: "reliability",
                intent: "Measure trust in automation reliability.",
                polarity: "positive",
              },
            ],
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

  it("skips the canonical language editor for English surveys", async () => {
    mockedGenerateMeasurementPlanWithLLM.mockResolvedValue({
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
              intent: "Measure trust in automation reliability.",
              polarity: "positive",
            },
          ],
        },
      ],
    });

    mockedGenerateSurveyWithLLM.mockResolvedValue({
      survey_title: "Trust survey",
      survey_description: "Test survey",
      estimated_completion_minutes: 3,
      questions: [
        {
          slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
          title: "I trust automation to delay one appliance safely.",
          description: "",
          ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
          type: "rating_scale",
          options: [],
          scale: {
            min: 1,
            max: 5,
            step: 1,
            min_label: "Low",
            max_label: "High",
          },
          numeric: null,
        },
      ],
    });

    mockedTransformGeneratedSurvey.mockReturnValue(buildCompiledSurveyFixture());

    await generateSurveyDraftProposal({
      survey: buildSurveyFixture(),
      surveyName: "Trust survey",
      surveyDescription: "Test survey",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      behaviouralConceptKeys: ["trust_in_automation"],
      schemaTargets: ["flexpulse_behavioural_schema.trust_in_automation"],
    });

    expect(mockedRunCanonicalLanguageCopyEditor).not.toHaveBeenCalled();
  });

  it("runs the canonical language editor for non-English surveys and compiles the edited copy", async () => {
    mockedGenerateMeasurementPlanWithLLM.mockResolvedValue({
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
              intent: "Measure trust in automation reliability.",
              polarity: "positive",
            },
          ],
        },
      ],
    });

    const writerOutput = {
      survey_title: "Automatización del hogar",
      survey_description: "Encuesta",
      estimated_completion_minutes: 3,
      questions: [
        {
          slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
          title: "Confío en la automatización del hogar.",
          description: "",
          ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
          type: "rating_scale" as const,
          options: [],
          scale: {
            min: 1,
            max: 5,
            step: 1,
            min_label: "Muy poco",
            max_label: "Mucho",
          },
          numeric: null,
        },
      ],
    };

    const editedWriterOutput = {
      ...writerOutput,
      survey_title: "Confianza en la automatización doméstica",
      questions: [
        {
          ...writerOutput.questions[0],
          title: "Confiaría en que un sistema automatizado retrasara una tarea sin urgencia de forma segura.",
        },
      ],
    };

    mockedGenerateSurveyWithLLM.mockResolvedValue(writerOutput);
    mockedRunCanonicalLanguageCopyEditor.mockResolvedValue({
      output: editedWriterOutput,
      report: {
        language: "Spanish",
        status: "partial",
        total_slots: 1,
        kept_slots: 0,
        applied_rewrites: 1,
        fallback_slots: 0,
        diagnostics: [],
      },
    });
    mockedTransformGeneratedSurvey.mockReturnValue(
      buildCompiledSurveyFixture({
        defaultLanguage: "Spanish",
        surveyTitle: editedWriterOutput.survey_title,
        surveyDescription: editedWriterOutput.survey_description,
        questionTitle: editedWriterOutput.questions[0].title,
      }),
    );

    const survey = buildSurveyFixture();
    survey.default_language = "Spanish";
    survey.supported_languages = ["Spanish"];
    survey.definition_json.survey_meta.default_language = "Spanish";
    survey.definition_json.survey_meta.supported_languages = ["Spanish"];
    survey.definition_json.translations = {
      Spanish: {
        survey_title: "",
        survey_description: "",
        questions: {},
      },
    };

    await generateSurveyDraftProposal({
      survey,
      surveyName: "Encuesta de confianza",
      surveyDescription: "Encuesta",
      defaultLanguage: "Spanish",
      supportedLanguages: ["Spanish"],
      behaviouralConceptKeys: ["trust_in_automation"],
      schemaTargets: ["flexpulse_behavioural_schema.trust_in_automation"],
    });

    expect(mockedRunCanonicalLanguageCopyEditor).toHaveBeenCalledTimes(1);
    expect(mockedRunCanonicalLanguageCopyEditor.mock.calls[0]?.[0]).toMatchObject({
      defaultLanguage: "Spanish",
    });
    expect(mockedTransformGeneratedSurvey.mock.calls[0]?.[0].output).toEqual(
      editedWriterOutput,
    );
  });
});
