export type SurveyLifecycleStatus = "draft" | "published" | "archived";

export type SurveyLanguageCode = string;

export type SurveyQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "rating_scale"
  | "free_text"
  | "numeric"
  | "boolean";

export type PlannerQuestionType = Extract<
  SurveyQuestionType,
  "single_choice" | "multiple_choice" | "rating_scale" | "numeric"
>;

export type MeasurementAggregationRule =
  | "identity"
  | "median"
  | "mean"
  | "set_union"
  | "context_passthrough";

export type MeasurementThresholdProfile =
  | "none"
  | "likert_1_5_low_mid_high"
  | "likert_1_5_low_mid_high_strict"
  | "numeric_temperature_window"
  | "enum_identity"
  | "asset_inventory";

export type SurveyQuestionOption = {
  option_key: string;
  value: string;
};

export type SurveyQuestionDefinition = {
  question_key: string;
  type: SurveyQuestionType;
  required: boolean;
  order: number;
  options?: SurveyQuestionOption[];
  scale?: {
    min: number;
    max: number;
    step?: number;
    min_label?: string;
    max_label?: string;
  };
  numeric?: {
    min?: number;
    max?: number;
    unit?: string;
  };
};

export type SurveyLanguageTranslations = {
  survey_title: string;
  survey_description?: string;
  questions: Record<
    string,
    {
      title: string;
      description?: string;
      options?: Record<string, string>;
    }
  >;
};

export type ContentValidationIssue = {
  question_key: string;
  type: "pii" | "semantic" | "quality" | "prompt_injection";
  message: string;
};

export type ContentValidationResult = {
  validated_at: string;
  content_hash: string;
  passed: boolean;
  issues: ContentValidationIssue[];
};

export type MultilingualValidationIssue = {
  language: SurveyLanguageCode;
  question_key?: string;
  type: "parity" | "quality" | "pii" | "cultural";
  message: string;
};

export type MultilingualValidationLanguageStatus = {
  language: SurveyLanguageCode;
  passed: boolean;
  issue_count: number;
};

export type MultilingualValidationResult = {
  validated_at: string;
  translation_hash: string;
  validated_languages: SurveyLanguageCode[];
  passed: boolean;
  issues: MultilingualValidationIssue[];
  language_statuses: MultilingualValidationLanguageStatus[];
};

export type SurveyValidationRules = {
  pii: {
    allow_direct_identifiers: boolean;
    allow_free_text: boolean;
  };
  multilingual: {
    require_complete_translations: boolean;
  };
};

export type SurveyResponseContextConfig = {
  collect_country_code: boolean;
  collect_postal_code: boolean;
  enrich_weather_context: boolean;
};

export type MeasurementPlanEntry = {
  concept_key: string;
  evidence_source:
    | "survey_questions"
    | "response_context"
    | "enrichment"
    | "pipeline_flags";
  measurement_type:
    | "single_item_direct"
    | "multi_item_likert_median"
    | "single_choice_enum"
    | "multi_choice_tag_set"
    | "numeric_direct"
    | "context_passthrough"
    | "quality_flag_passthrough";
  output_type: "number" | "boolean" | "string" | "string[]" | "enum";
  aggregation_rule:
    MeasurementAggregationRule;
  threshold_profile: MeasurementThresholdProfile;
  minimum_answer_count: number;
  question_keys: string[];
  required_question_keys: string[];
  question_intents?: {
    slot_key: string;
    question_key: string;
    facet: string;
    intent: string;
    polarity: "positive" | "negative" | "neutral";
  }[];
  source_paths?: string[];
};

export type MeasurementPlan = {
  schema_version: 1;
  schema_namespace: "flexpulse_behavioural_schema";
  concepts: MeasurementPlanEntry[];
};

export type SurveyDefinition = {
  schema_version: 1;
  survey_meta: {
    default_language: SurveyLanguageCode;
    supported_languages: SurveyLanguageCode[];
    estimated_completion_minutes?: number;
    behavioural_concept_keys?: string[];
    ontology_targets?: string[];
    measurement_plan_json?: MeasurementPlan;
    response_context?: SurveyResponseContextConfig;
    validation_result?: ContentValidationResult;
    multilingual_validation_result?: MultilingualValidationResult;
  };
  questions: SurveyQuestionDefinition[];
  translations: Record<SurveyLanguageCode, SurveyLanguageTranslations>;
  validation_rules: SurveyValidationRules;
};

export type MappingTransformStrategy =
  | {
      kind: "identity";
    }
  | {
      kind: "enum_lookup";
      option_to_value: Record<string, string>;
    }
  | {
      kind: "numeric_range";
      min?: number;
      max?: number;
      unit?: string;
    }
  | {
      kind: "boolean_lookup";
      truthy_option_keys: string[];
    };

export type SurveyMappingDefinition = {
  question_key: string;
  ontology_target: string;
  expected_type: "string" | "number" | "boolean" | "string[]" | "number[]";
  required_for_mapping: boolean;
  transform_strategy: MappingTransformStrategy;
  validation_constraints?: {
    allowed_values?: string[];
    min?: number;
    max?: number;
  };
};

export type MappingContract = {
  schema_version: 1;
  mappings: SurveyMappingDefinition[];
};

export type CompiledMappingContract = {
  schema_version: 1;
  by_question_key: Record<string, SurveyMappingDefinition>;
  question_keys: string[];
};

export type MapperProfileTag = "low" | "medium" | "high";

export type MapperProfileEntry = {
  value: string | number | boolean | string[] | number[] | null;
  tag?: MapperProfileTag;
};

export type MapperContextMetadata = {
  country_code: string | null;
  survey_language: string;
  location: {
    agg_code: string | null;
    label: string | null;
    granularity: string | null;
    centroid_lat: number | null;
    centroid_lon: number | null;
  } | null;
  climate: {
    provider: string | null;
    quality_flag: string | null;
    observed_at: string | null;
    temp_outdoor_c: number | null;
    humidity_pct: number | null;
  } | null;
};

export type MapperOutput = {
  profile: Record<string, MapperProfileEntry>;
  context_metadata: MapperContextMetadata;
  mapping_metadata: {
    mapping_hash: string | null;
    measurement_hash: string | null;
    mapping_hash_at_submission: string | null;
    measurement_hash_at_submission: string | null;
    mapper_version: string;
    threshold_profile_version: string;
  };
};

export type PersistedSurvey = {
  id: string;
  name: string;
  status: SurveyLifecycleStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  default_language: SurveyLanguageCode;
  supported_languages: SurveyLanguageCode[];
  definition_json: SurveyDefinition;
  mapping_contract_json: MappingContract;
  mapping_compiled_json: CompiledMappingContract | null;
  mapping_hash: string | null;
  measurement_hash?: string | null;
};

export type PersistedSurveyLink = {
  id: string;
  survey_id: string;
  link_token: string;
  audience_label: string;
  audience_token: string;
  is_active: boolean;
  created_at: string;
};

export type CreateSurveyDraftInput = {
  name: string;
  default_language: SurveyLanguageCode;
  supported_languages?: SurveyLanguageCode[];
};

export type UpdateSurveyDraftInput = {
  surveyId: string;
  name?: string;
  default_language?: SurveyLanguageCode;
  supported_languages?: SurveyLanguageCode[];
  definition_json?: SurveyDefinition;
  mapping_contract_json?: MappingContract;
};

export function normalizeSurveyResponseContextConfig(
  config?: Partial<SurveyResponseContextConfig> | null,
): SurveyResponseContextConfig {
  const collectPostalCode = config?.collect_postal_code === true;
  const enrichWeatherContext = config?.enrich_weather_context === true;
  const collectCountryCode =
    config?.collect_country_code === true || collectPostalCode || enrichWeatherContext;

  return {
    collect_country_code: collectCountryCode,
    collect_postal_code: collectPostalCode || enrichWeatherContext,
    enrich_weather_context: enrichWeatherContext,
  };
}

export function createInitialSurveyDefinition(
  defaultLanguage: SurveyLanguageCode,
  supportedLanguages: SurveyLanguageCode[],
): SurveyDefinition {
  const languages = Array.from(new Set(supportedLanguages));

  return {
    schema_version: 1,
    survey_meta: {
      default_language: defaultLanguage,
      supported_languages: languages,
      behavioural_concept_keys: [],
      ontology_targets: [],
      measurement_plan_json: {
        schema_version: 1,
        schema_namespace: "flexpulse_behavioural_schema",
        concepts: [],
      },
      response_context: normalizeSurveyResponseContextConfig(),
    },
    questions: [],
    translations: Object.fromEntries(
      languages.map((language) => [
        language,
        {
          survey_title: "",
          survey_description: "",
          questions: {},
        },
      ]),
    ),
    validation_rules: {
      pii: {
        allow_direct_identifiers: false,
        allow_free_text: false,
      },
      multilingual: {
        require_complete_translations: true,
      },
    },
  };
}

export function createInitialMappingContract(): MappingContract {
  return {
    schema_version: 1,
    mappings: [],
  };
}
