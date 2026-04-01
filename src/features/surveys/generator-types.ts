export type SurveyLifecycleStatus = "draft" | "published" | "archived";

export type SurveyLanguageCode = string;

export type SurveyQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "rating_scale"
  | "free_text"
  | "numeric"
  | "boolean";

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
  type: "pii" | "semantic";
  message: string;
};

export type ContentValidationResult = {
  validated_at: string;
  content_hash: string;
  passed: boolean;
  issues: ContentValidationIssue[];
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

export type SurveyDefinition = {
  schema_version: 1;
  survey_meta: {
    default_language: SurveyLanguageCode;
    supported_languages: SurveyLanguageCode[];
    estimated_completion_minutes?: number;
    ontology_targets?: string[];
    validation_result?: ContentValidationResult;
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
      ontology_targets: [],
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
