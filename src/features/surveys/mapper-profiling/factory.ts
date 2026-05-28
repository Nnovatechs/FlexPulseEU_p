import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type MapperOutput,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";
import { compileMappingContract } from "@/features/surveys/generator-mapping";
import {
  mapSurveyResponseToOutput,
  type ResponseEnrichmentRecord,
} from "@/features/surveys/response-mapper";
import type { SubmittedSurveyAnswer } from "@/features/surveys/response-validation";
import type { NormalizedLocationLevel } from "@/features/surveys/response-enrichment";
import type { SurveyAnalyticsRecord } from "@/features/surveys/survey-analytics";

export type SyntheticPersonaId =
  | "high_trust_flexible"
  | "low_trust_control_oriented"
  | "price_sensitive_low_assets"
  | "comfort_protective"
  | "contradictory_responder"
  | "partial_response"
  | string;

type ExpectedProfileEntry = {
  value: number | string[] | null;
  tag?: "low" | "medium" | "high";
  facets?: Record<
    string,
    {
      value: number;
      evidence_count: number;
      evidence_level: "interpretive_signal" | "facet_subscore";
    }
  >;
};

export type SyntheticPersona = {
  id: SyntheticPersonaId;
  purpose: string;
  countryCode: string;
  submittedLanguage: string;
  audienceToken: string;
  answers: Record<string, SubmittedSurveyAnswer>;
  expectedProfile: Record<string, ExpectedProfileEntry>;
};

const mappingHash = "mapper_eval_mapping_hash_v1";
const measurementHash = "mapper_eval_measurement_hash_v1";

export function buildMapperProfilingSurveyFixture(): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English"]);
  definition.survey_meta.response_context = {
    collect_country_code: true,
    collect_postal_code: true,
    enrich_weather_context: true,
  };
  definition.questions = [
    {
      question_key: "Q_TRUST_RELIABILITY_1",
      type: "rating_scale",
      required: true,
      order: 1,
      scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
    },
    {
      question_key: "Q_TRUST_RELIABILITY_2",
      type: "rating_scale",
      required: true,
      order: 2,
      scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
    },
    {
      question_key: "Q_TRUST_CONTROL_NEG",
      type: "rating_scale",
      required: true,
      order: 3,
      scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
    },
    {
      question_key: "Q_FLEX_DELAY",
      type: "rating_scale",
      required: true,
      order: 4,
      scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
    },
    {
      question_key: "Q_FLEX_FREQ_NEG",
      type: "rating_scale",
      required: true,
      order: 5,
      scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
    },
    {
      question_key: "Q_COMFORT_STRICT",
      type: "rating_scale",
      required: true,
      order: 6,
      scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
    },
    {
      question_key: "Q_TARIFF_SAVINGS",
      type: "rating_scale",
      required: true,
      order: 7,
      scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
    },
    {
      question_key: "Q_TARIFF_STABILITY",
      type: "rating_scale",
      required: true,
      order: 8,
      scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
    },
    {
      question_key: "Q_DER_ASSETS",
      type: "multiple_choice",
      required: false,
      order: 9,
      options: [
        { option_key: "ev", value: "ev" },
        { option_key: "battery", value: "battery" },
        { option_key: "heat_pump", value: "heat_pump" },
        { option_key: "thermal_storage", value: "thermal_storage" },
        { option_key: "pv", value: "pv" },
      ],
    },
  ];
  definition.translations.English.survey_title = "Mapper profiling eval survey";
  definition.translations.English.questions = Object.fromEntries(
    definition.questions.map((question) => [
      question.question_key,
      { title: question.question_key.replace(/_/g, " ") },
    ]),
  );
  definition.survey_meta.measurement_plan_json = {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: [
      {
        concept_key: "trust_in_automation",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_median",
        output_type: "number",
        aggregation_rule: "median",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 2,
        question_keys: [
          "Q_TRUST_RELIABILITY_1",
          "Q_TRUST_RELIABILITY_2",
          "Q_TRUST_CONTROL_NEG",
        ],
        required_question_keys: [
          "Q_TRUST_RELIABILITY_1",
          "Q_TRUST_RELIABILITY_2",
          "Q_TRUST_CONTROL_NEG",
        ],
        question_intents: [
          {
            slot_key: "SLOT_TRUST_RELIABILITY_1",
            question_key: "Q_TRUST_RELIABILITY_1",
            facet: "reliability",
            intent: "Trust that automation behaves reliably.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_TRUST_RELIABILITY_2",
            question_key: "Q_TRUST_RELIABILITY_2",
            facet: "reliability",
            intent: "Trust that automation remains predictable.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_TRUST_CONTROL_NEG",
            question_key: "Q_TRUST_CONTROL_NEG",
            facet: "control_concern",
            intent: "Discomfort with automation acting without intervention.",
            polarity: "negative",
          },
        ],
      },
      {
        concept_key: "flexibility_willingness",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_median",
        output_type: "number",
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 2,
        question_keys: ["Q_FLEX_DELAY", "Q_FLEX_FREQ_NEG"],
        required_question_keys: ["Q_FLEX_DELAY", "Q_FLEX_FREQ_NEG"],
        question_intents: [
          {
            slot_key: "SLOT_FLEX_DELAY",
            question_key: "Q_FLEX_DELAY",
            facet: "delay_tolerance",
            intent: "Willingness to delay a household task.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_FLEX_FREQ_NEG",
            question_key: "Q_FLEX_FREQ_NEG",
            facet: "event_frequency",
            intent: "Discomfort with frequent flexibility events.",
            polarity: "negative",
          },
        ],
      },
      {
        concept_key: "thermal_comfort_norms",
        evidence_source: "survey_questions",
        measurement_type: "single_item_direct",
        output_type: "number",
        aggregation_rule: "identity",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 1,
        question_keys: ["Q_COMFORT_STRICT"],
        required_question_keys: ["Q_COMFORT_STRICT"],
        question_intents: [
          {
            slot_key: "SLOT_COMFORT_STRICT",
            question_key: "Q_COMFORT_STRICT",
            facet: "comfort_protection",
            intent: "Strictness about preserving comfort.",
            polarity: "positive",
          },
        ],
      },
      {
        concept_key: "tariff_preference_orientation",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_median",
        output_type: "number",
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 2,
        question_keys: ["Q_TARIFF_SAVINGS", "Q_TARIFF_STABILITY"],
        required_question_keys: ["Q_TARIFF_SAVINGS", "Q_TARIFF_STABILITY"],
        question_intents: [
          {
            slot_key: "SLOT_TARIFF_SAVINGS",
            question_key: "Q_TARIFF_SAVINGS",
            facet: "savings_motivation",
            intent: "Preference for savings opportunities.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_TARIFF_STABILITY",
            question_key: "Q_TARIFF_STABILITY",
            facet: "bill_stability",
            intent: "Preference for stable bills.",
            polarity: "positive",
          },
        ],
      },
      {
        concept_key: "owned_der_assets",
        evidence_source: "survey_questions",
        measurement_type: "multi_choice_tag_set",
        output_type: "string[]",
        aggregation_rule: "set_union",
        threshold_profile: "asset_inventory",
        minimum_answer_count: 1,
        question_keys: ["Q_DER_ASSETS"],
        required_question_keys: ["Q_DER_ASSETS"],
        question_intents: [],
      },
    ],
  };

  const mappingContract = createInitialMappingContract();
  mappingContract.mappings = [
    ...definition.questions
      .filter((question) => question.type === "rating_scale")
      .map((question) => ({
        question_key: question.question_key,
        ontology_target: "flexpulse_behavioural_schema.synthetic_numeric",
        expected_type: "number" as const,
        required_for_mapping: true,
        transform_strategy: { kind: "numeric_range" as const, min: 1, max: 5 },
      })),
    {
      question_key: "Q_DER_ASSETS",
      ontology_target: "flexpulse_behavioural_schema.owned_der_assets",
      expected_type: "string[]" as const,
      required_for_mapping: false,
      transform_strategy: {
        kind: "enum_lookup" as const,
        option_to_value: {
          ev: "ev",
          battery: "battery_storage",
          heat_pump: "heat_pump",
          thermal_storage: "thermal_storage",
          pv: "pv_system",
        },
      },
    },
  ];

  return {
    id: "mapper_profiling_eval_survey",
    name: "Mapper profiling eval survey",
    status: "published",
    created_by: "eval_user",
    created_at: "2026-05-08T00:00:00.000Z",
    updated_at: "2026-05-08T00:00:00.000Z",
    published_at: "2026-05-08T00:00:00.000Z",
    default_language: "English",
    supported_languages: ["English"],
    definition_json: definition,
    mapping_contract_json: mappingContract,
    mapping_compiled_json: compileMappingContract(mappingContract),
    mapping_hash: mappingHash,
    measurement_hash: measurementHash,
  };
}

export const syntheticPersonas: SyntheticPersona[] = [
  {
    id: "high_trust_flexible",
    purpose: "High trust and high flexibility with EV and battery assets.",
    countryCode: "ES",
    submittedLanguage: "Spanish",
    audienceToken: "pilot",
    answers: {
      Q_TRUST_RELIABILITY_1: 5,
      Q_TRUST_RELIABILITY_2: 4,
      Q_TRUST_CONTROL_NEG: 1,
      Q_FLEX_DELAY: 5,
      Q_FLEX_FREQ_NEG: 1,
      Q_COMFORT_STRICT: 2,
      Q_TARIFF_SAVINGS: 4,
      Q_TARIFF_STABILITY: 3,
      Q_DER_ASSETS: ["ev", "battery"],
    },
    expectedProfile: {
      trust_in_automation: {
        value: 5,
        tag: "high",
        facets: {
          reliability: {
            value: 4.5,
            evidence_count: 2,
            evidence_level: "facet_subscore",
          },
          control_concern: {
            value: 5,
            evidence_count: 1,
            evidence_level: "interpretive_signal",
          },
        },
      },
      flexibility_willingness: { value: 5, tag: "high" },
      thermal_comfort_norms: { value: 2, tag: "low" },
      tariff_preference_orientation: { value: 3.5, tag: "medium" },
      owned_der_assets: { value: ["ev", "battery_storage"] },
    },
  },
  {
    id: "low_trust_control_oriented",
    purpose: "Low trust, low flexibility and strong comfort protection.",
    countryCode: "HR",
    submittedLanguage: "Croatian",
    audienceToken: "control",
    answers: {
      Q_TRUST_RELIABILITY_1: 1,
      Q_TRUST_RELIABILITY_2: 2,
      Q_TRUST_CONTROL_NEG: 5,
      Q_FLEX_DELAY: 2,
      Q_FLEX_FREQ_NEG: 5,
      Q_COMFORT_STRICT: 5,
      Q_TARIFF_SAVINGS: 2,
      Q_TARIFF_STABILITY: 5,
      Q_DER_ASSETS: [],
    },
    expectedProfile: {
      trust_in_automation: { value: 1, tag: "low" },
      flexibility_willingness: { value: 1.5, tag: "low" },
      thermal_comfort_norms: { value: 5, tag: "high" },
      tariff_preference_orientation: { value: 3.5, tag: "medium" },
      owned_der_assets: { value: [] },
    },
  },
  {
    id: "price_sensitive_low_assets",
    purpose: "Price-sensitive respondent with one flexible asset.",
    countryCode: "FR",
    submittedLanguage: "French",
    audienceToken: "default",
    answers: {
      Q_TRUST_RELIABILITY_1: 3,
      Q_TRUST_RELIABILITY_2: 3,
      Q_TRUST_CONTROL_NEG: 3,
      Q_FLEX_DELAY: 4,
      Q_FLEX_FREQ_NEG: 2,
      Q_COMFORT_STRICT: 3,
      Q_TARIFF_SAVINGS: 5,
      Q_TARIFF_STABILITY: 2,
      Q_DER_ASSETS: ["heat_pump"],
    },
    expectedProfile: {
      trust_in_automation: { value: 3, tag: "medium" },
      flexibility_willingness: { value: 4, tag: "high" },
      thermal_comfort_norms: { value: 3, tag: "medium" },
      tariff_preference_orientation: { value: 3.5, tag: "medium" },
      owned_der_assets: { value: ["heat_pump"] },
    },
  },
  {
    id: "comfort_protective",
    purpose: "Comfort-protective respondent with low flexibility willingness.",
    countryCode: "IE",
    submittedLanguage: "English",
    audienceToken: "comfort",
    answers: {
      Q_TRUST_RELIABILITY_1: 3,
      Q_TRUST_RELIABILITY_2: 4,
      Q_TRUST_CONTROL_NEG: 4,
      Q_FLEX_DELAY: 2,
      Q_FLEX_FREQ_NEG: 4,
      Q_COMFORT_STRICT: 5,
      Q_TARIFF_SAVINGS: 3,
      Q_TARIFF_STABILITY: 4,
      Q_DER_ASSETS: ["thermal_storage"],
    },
    expectedProfile: {
      trust_in_automation: { value: 3, tag: "medium" },
      flexibility_willingness: { value: 2, tag: "low" },
      thermal_comfort_norms: { value: 5, tag: "high" },
      tariff_preference_orientation: { value: 3.5, tag: "medium" },
      owned_der_assets: { value: ["thermal_storage"] },
    },
  },
  {
    id: "contradictory_responder",
    purpose: "High reliability trust but low control comfort, visible in facets.",
    countryCode: "ES",
    submittedLanguage: "Spanish",
    audienceToken: "pilot",
    answers: {
      Q_TRUST_RELIABILITY_1: 5,
      Q_TRUST_RELIABILITY_2: 5,
      Q_TRUST_CONTROL_NEG: 5,
      Q_FLEX_DELAY: 5,
      Q_FLEX_FREQ_NEG: 5,
      Q_COMFORT_STRICT: 5,
      Q_TARIFF_SAVINGS: 5,
      Q_TARIFF_STABILITY: 5,
      Q_DER_ASSETS: ["pv", "ev"],
    },
    expectedProfile: {
      trust_in_automation: {
        value: 5,
        tag: "high",
        facets: {
          reliability: {
            value: 5,
            evidence_count: 2,
            evidence_level: "facet_subscore",
          },
          control_concern: {
            value: 1,
            evidence_count: 1,
            evidence_level: "interpretive_signal",
          },
        },
      },
      flexibility_willingness: { value: 3, tag: "medium" },
      thermal_comfort_norms: { value: 5, tag: "high" },
      tariff_preference_orientation: { value: 5, tag: "high" },
      owned_der_assets: { value: ["pv_system", "ev"] },
    },
  },
  {
    id: "partial_response",
    purpose: "Incomplete answer set used to validate minimum-answer handling.",
    countryCode: "HR",
    submittedLanguage: "Croatian",
    audienceToken: "partial",
    answers: {
      Q_TRUST_RELIABILITY_1: 4,
      Q_FLEX_DELAY: 4,
    },
    expectedProfile: {
      trust_in_automation: { value: null },
      flexibility_willingness: { value: null },
      thermal_comfort_norms: { value: null },
      tariff_preference_orientation: { value: null },
      owned_der_assets: { value: null },
    },
  },
];

export function buildEnrichmentForPersona(
  persona: SyntheticPersona,
): ResponseEnrichmentRecord {
  return {
    provider: "synthetic",
    normalized_country_code: persona.countryCode,
    location_agg_code: `${persona.countryCode}:city:${persona.id}`,
    location_agg_label: `${persona.countryCode} synthetic city`,
    location_granularity: "city",
    centroid_lat: 40,
    centroid_lon: -3,
    normalized_location_json: {
      provider: "synthetic",
      levels: buildLocationLevelsForPersona(persona),
    },
    temp_outdoor_c: persona.countryCode === "ES" ? 22 : 12,
    humidity_pct: 50,
    observed_at: "2026-05-08T10:00:00.000Z",
    quality_flag: "synthetic",
  };
}

export function buildLocationLevelsForPersona(
  persona: SyntheticPersona,
): NormalizedLocationLevel[] {
  return [
    {
      kind: "country",
      code: persona.countryCode,
      label: persona.countryCode,
      providerId: null,
      centroidLat: null,
      centroidLon: null,
    },
    {
      kind: "region",
      code: `${persona.countryCode}:region:synthetic`,
      label: `${persona.countryCode} synthetic region`,
      providerId: null,
      centroidLat: null,
      centroidLon: null,
    },
    {
      kind: "city",
      code: `${persona.countryCode}:city:${persona.id}`,
      label: `${persona.countryCode} synthetic city`,
      providerId: null,
      centroidLat: 40,
      centroidLon: -3,
    },
  ];
}

export function mapSyntheticPersona(
  survey: PersistedSurvey,
  persona: SyntheticPersona,
): MapperOutput {
  return mapSurveyResponseToOutput({
    survey,
    answers: persona.answers,
    submittedLanguage: persona.submittedLanguage,
    countryCodeRaw: persona.countryCode.toLowerCase(),
    mappingHashAtSubmission: mappingHash,
    measurementHashAtSubmission: measurementHash,
    enrichment: buildEnrichmentForPersona(persona),
  });
}

export function buildAnalyticsRecordForPersona(
  survey: PersistedSurvey,
  persona: SyntheticPersona,
): SurveyAnalyticsRecord {
  return {
    response_id: `response_${persona.id}`,
    responded_at: "2026-05-08T10:00:00.000Z",
    audience_token: persona.audienceToken,
    audience_label: persona.audienceToken,
    mapper_output: mapSyntheticPersona(survey, persona),
    location_levels: buildLocationLevelsForPersona(persona),
  };
}
