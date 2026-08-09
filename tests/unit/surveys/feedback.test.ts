import { describe, expect, it } from "vitest";
import type { PersistedSurvey } from "@/features/surveys/generator-types";
import { buildSurveyFeedbackQuestionReferences } from "@/features/surveys/feedback";

function buildSurvey(): PersistedSurvey {
  return {
    id: "survey-1",
    name: "Pilot survey",
    status: "published",
    created_by: "user-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    default_language: "English",
    supported_languages: ["English"],
    definition_json: {
      schema_version: 1,
      survey_meta: {
        default_language: "English",
        supported_languages: ["English"],
        response_context: {
          collect_country_code: false,
          collect_postal_code: false,
          enrich_weather_context: false,
          postal_collection_mode: "full",
        },
      },
      questions: [
        {
          question_key: "Q_CORE",
          type: "multiple_choice",
          required: true,
          order: 1,
          options: [{ option_key: "ev", value: "ev" }],
        },
        {
          question_key: "Q_FOLLOWUP",
          type: "rating_scale",
          required: true,
          order: 2,
          scale: { min: 1, max: 5 },
          visibility_rule: {
            source_question_key: "Q_CORE",
            operator: "contains_any",
            values: ["ev"],
          },
        },
      ],
      validation_rules: {
        pii: {
          allow_direct_identifiers: false,
          allow_free_text: false,
        },
        multilingual: {
          require_complete_translations: false,
        },
      },
      translations: {
        English: {
          survey_title: "Pilot survey",
          survey_description: "",
          questions: {
            Q_CORE: { title: "Which flexible assets do you have?" },
            Q_FOLLOWUP: { title: "How comfortable are you with EV charging shifts?" },
          },
        },
      },
    },
    mapping_contract_json: { schema_version: 1, mappings: [] },
    mapping_compiled_json: null,
    mapping_hash: "hash-1",
    measurement_hash: null,
  };
}

describe("survey feedback helpers", () => {
  it("builds references in visible answered order", () => {
    const survey = buildSurvey();
    const references = buildSurveyFeedbackQuestionReferences({
      survey,
      submittedLanguage: "English",
      answers: {
        Q_CORE: ["ev"],
        Q_FOLLOWUP: 4,
      },
    });

    expect(references).toEqual([
      {
        questionKey: "Q_CORE",
        index: 1,
        title: "Which flexible assets do you have?",
      },
      {
        questionKey: "Q_FOLLOWUP",
        index: 2,
        title: "How comfortable are you with EV charging shifts?",
      },
    ]);
  });

  it("omits questions without stored answers", () => {
    const survey = buildSurvey();
    const references = buildSurveyFeedbackQuestionReferences({
      survey,
      submittedLanguage: "English",
      answers: {
        Q_CORE: [],
      },
    });

    expect(references).toEqual([]);
  });
});
