import { GeneratorTargetConfig } from "./generator-config";

type BuildSurveyGeneratorPromptInput = {
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  ontologyTargets: string[];
  configs: GeneratorTargetConfig[];
};

export type SurveyGeneratorPrompt = {
  system: string;
  user: string;
  recommendedQuestionBudget: number;
};

function computeRecommendedQuestionBudget(configs: GeneratorTargetConfig[]) {
  const total = configs.reduce(
    (sum, config) => sum + config.item_count_default,
    0,
  );

  return Math.max(6, Math.min(28, total));
}

export function buildSurveyGeneratorPrompt(
  input: BuildSurveyGeneratorPromptInput,
): SurveyGeneratorPrompt {
  const recommendedQuestionBudget = computeRecommendedQuestionBudget(
    input.configs,
  );

  const targetRules = input.configs
    .map((config, index) => {
      return [
        `${index + 1}. ${config.ontology_target}`,
        `   - family: ${config.measurement_family}`,
        `   - required question type: ${config.question_type}`,
        `   - expected mapped value type: ${config.expected_type}`,
        `   - preferred item count: ${config.item_count_default}`,
        `   - minimum item count: ${config.item_count_min}`,
        `   - priority: ${config.priority}`,
        `   - threshold policy: ${config.threshold_policy}`,
        `   - notes: ${config.prompt_notes}`,
      ].join("\n");
    })
    .join("\n");

  const system = [
    "You are a survey generation engine for FlexPulseEU.",
    "Generate a concise, methodologically coherent survey in the canonical language only.",
    "Return JSON only.",
    "Do not invent ontology targets outside the allowed list.",
    "Do not ask for direct personal identifiers.",
    "Keep wording neutral, clear, and suitable for real respondents.",
    "Avoid duplicate or near-duplicate questions.",
    "Prefer compact surveys while preserving stronger measurement for high-priority latent constructs.",
    "Use only these question types: single_choice, multiple_choice, rating_scale, numeric.",
    "For single_choice and multiple_choice questions, include options with ontology_value and is_truthy fields.",
    "For rating_scale questions, use a 1-5 scale unless the target notes strongly suggest otherwise.",
    "For numeric questions, include sensible bounds when possible.",
  ].join(" ");

  const user = [
    `Survey name: ${input.surveyName}`,
    `Canonical language: ${input.defaultLanguage}`,
    `Supported languages in the draft: ${input.supportedLanguages.join(", ")}`,
    `Existing survey description: ${input.surveyDescription || "(empty)"}`,
    `Selected ontology targets: ${input.ontologyTargets.join(", ")}`,
    `Recommended visible question budget: around ${recommendedQuestionBudget} questions.`,
    "",
    "Target-specific generation rules:",
    targetRules,
    "",
    "Generation requirements:",
    "- Use only the selected ontology targets.",
    "- Every generated question must point to exactly one ontology_target.",
    "- Include 2-3 items only for the highest-priority latent constructs when budget allows.",
    "- Use single direct items for secondary ordinal constructs.",
    "- Use multiple_choice for conditions, barriers, motivators, accepted scopes, or device lists.",
    "- Use single_choice for factual booleans or categorical preferences.",
    "- Use numeric for temperature setpoints or other direct numeric preferences.",
    "- Keep the survey short enough to be realistic for actual respondents.",
    "- survey_title must be suitable for respondents in the canonical language.",
    "- survey_description should briefly explain the survey purpose in the canonical language.",
  ].join("\n");

  return {
    system,
    user,
    recommendedQuestionBudget,
  };
}
