import OpenAI from "openai";
import { getOpenAIEnv } from "@/lib/llm/env";
import { getFlexpulseBehaviouralConcept } from "@/features/ontology/flexpulse-behavioural-schema";
import type { GeneratedSurveyDraftProposal } from "@/features/surveys/survey-generation-flow";
import type { GeneratorEvalFixture } from "../../../fixtures/surveys/generator/generator-eval-fixtures";

// The methodology rubric is the qualitative layer of the generator eval.
// Deterministic scoring can tell us that the survey is structurally valid; this
// rubric asks whether the generated items are good enough for behavioural or
// psychological profiling: clear, aligned to constructs, not double-barrelled,
// analyzable, and reasonably cross-cultural.
export type GeneratorMethodologyRubricScore = {
  constructAlignment: number;
  measurementDepthAdequacy: number;
  questionClarity: number;
  doubleBarrelSafety: number;
  responseFormatFit: number;
  profilingUsefulness: number;
  overall: number;
  verdict: "pass" | "warning" | "fail";
  strengths: string[];
  risks: string[];
  recommendations: string[];
};

// The schema keeps the reviewer output stable so the report can be compared
// across runs. Scores are 1-5 and the free-text fields explain why the model
// considered the instrument strong, risky, or worth improving.
const methodologyRubricJsonSchema = {
  name: "survey_generator_methodology_rubric",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      constructAlignment: { type: "number", minimum: 1, maximum: 5 },
      measurementDepthAdequacy: { type: "number", minimum: 1, maximum: 5 },
      questionClarity: { type: "number", minimum: 1, maximum: 5 },
      doubleBarrelSafety: { type: "number", minimum: 1, maximum: 5 },
      responseFormatFit: { type: "number", minimum: 1, maximum: 5 },
      profilingUsefulness: { type: "number", minimum: 1, maximum: 5 },
      overall: { type: "number", minimum: 1, maximum: 5 },
      verdict: { type: "string", enum: ["pass", "warning", "fail"] },
      strengths: {
        type: "array",
        items: { type: "string" },
      },
      risks: {
        type: "array",
        items: { type: "string" },
      },
      recommendations: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "constructAlignment",
      "measurementDepthAdequacy",
      "questionClarity",
      "doubleBarrelSafety",
      "responseFormatFit",
      "profilingUsefulness",
      "overall",
      "verdict",
      "strengths",
      "risks",
      "recommendations",
    ],
  },
} as const;

// The reviewer should see the instrument as a human methodologist would: survey
// title, respondent-facing items, response formats, mapped targets, and the
// measurement plan. It does not need every internal implementation detail.
function summarizeProposal(proposal: GeneratedSurveyDraftProposal) {
  const defaultLanguage = proposal.definition.survey_meta.default_language;
  const translations = proposal.definition.translations[defaultLanguage];

  return {
    survey_title: translations?.survey_title ?? "",
    survey_description: translations?.survey_description ?? "",
    questions: proposal.definition.questions.map((question) => ({
      question_key: question.question_key,
      type: question.type,
      title: translations?.questions[question.question_key]?.title ?? "",
      description: translations?.questions[question.question_key]?.description ?? "",
      scale: question.scale,
      options: question.options,
      mapped_target: proposal.mappingContract.mappings.find(
        (mapping) => mapping.question_key === question.question_key,
      )?.ontology_target,
    })),
    measurement_plan: proposal.measurementPlan.concepts.map((concept) => ({
      concept_key: concept.concept_key,
      concept_role: getFlexpulseBehaviouralConcept(concept.concept_key)?.concept_role,
      measurement_type: concept.measurement_type,
      question_keys: concept.question_keys,
      question_intents: concept.question_intents ?? [],
      aggregation_rule: concept.aggregation_rule,
    })),
  };
}

function parseRubric(content: string): GeneratorMethodologyRubricScore {
  const parsed = JSON.parse(content) as GeneratorMethodologyRubricScore;
  return parsed;
}

export async function evaluateGeneratedSurveyMethodology(input: {
  fixture: GeneratorEvalFixture;
  proposal: GeneratedSurveyDraftProposal;
}): Promise<GeneratorMethodologyRubricScore> {
  const { env, client } = (() => {
    const llmEnv = getOpenAIEnv();
    return {
      env: llmEnv,
      client: new OpenAI({ apiKey: llmEnv.apiKey }),
    };
  })();

  const completion = await client.chat.completions.create({
    model: env.model,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: [
          "You are an expert survey methodology reviewer.",
          "Evaluate generated surveys for behavioural and psychological profiling.",
          "Be strict but practical for an early product eval.",
          "Score each category from 1 to 5.",
          "The survey is evaluated in its canonical language only; do not score translation or multicultural adaptation in this rubric.",
          "Do not reward structural validity alone; focus on whether the survey items are good enough to support a defensible profiling workflow.",
          "Penalize vague pseudo-technical wording, circular 'I understand the idea' items, and questions whose purpose is not obvious to a non-expert respondent.",
          "Return JSON only.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            // The fixture explains what this generated survey was supposed to
            // prove. The rubric can then judge quality relative to that product
            // scenario, not in the abstract.
            eval_fixture: {
              id: input.fixture.id,
              purpose: input.fixture.purpose,
              selected_concepts: input.fixture.behaviouralConceptKeys,
              supported_languages: input.fixture.supportedLanguages,
            },
            // These are deliberately plain-language criteria. The goal is to
            // make the methodology judgement inspectable by engineers and
            // product reviewers, not only by survey-methodology specialists.
            scoring_guidance: {
              constructAlignment:
                "Do items measure the intended construct rather than adjacent constructs?",
              measurementDepthAdequacy:
                "Does each behavioural or psychological construct have enough distinct items for a defensible profiling signal, considering the fixture purpose? Do not penalize a factual applicability_factor or enum preference for being single-item if the option wording is clear and analyzable.",
              questionClarity:
                "Are respondent-facing items concrete, clear, non-technical, naturally worded in the canonical language, and answerable? Penalize vague phrases like 'some electricity use', 'certain uses', 'when needed', or items whose measurement purpose is not obvious to a non-expert respondent.",
              doubleBarrelSafety:
                "High score means low double-barrel risk; each item asks one thing.",
              responseFormatFit:
                "Do scales/options fit the item and produce analyzable data?",
              profilingUsefulness:
                "Would the resulting answers help distinguish meaningful behavioural profiles rather than vague opinions?",
            },
            generated_survey: summarizeProposal(input.proposal),
          },
          null,
          2,
        ),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: methodologyRubricJsonSchema,
    },
  });

  const message = completion.choices[0]?.message;
  if (message?.refusal) {
    throw new Error(`OpenAI refused methodology rubric: ${message.refusal}`);
  }
  if (!message?.content) {
    throw new Error("OpenAI returned an empty methodology rubric response.");
  }

  return parseRubric(message.content);
}
