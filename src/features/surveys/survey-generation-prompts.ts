import { GeneratorTargetConfig } from "./generator-config";
import {
  MeasurementPlanBaseBlueprint,
  MeasurementPlanBlueprint,
} from "./measurement-plan";
import {
  buildConceptMethodologyNotes,
  buildMethodologyRulesText,
} from "./survey-methodology";

type BuildSurveyGeneratorPromptInput = {
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  schemaTargets: string[];
  configs: GeneratorTargetConfig[];
  measurementPlanBlueprint: MeasurementPlanBlueprint;
};

type BuildMeasurementPlannerPromptInput = {
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  behaviouralConceptKeys: string[];
  schemaTargets: string[];
  configs: GeneratorTargetConfig[];
  baseMeasurementPlanBlueprint: MeasurementPlanBaseBlueprint;
  repairFeedback?: string[];
};

export type SurveyGeneratorPrompt = {
  system: string;
  user: string;
};

export type MeasurementPlannerPrompt = {
  system: string;
  user: string;
};

export function buildSurveyGeneratorPrompt(
  input: BuildSurveyGeneratorPromptInput,
): SurveyGeneratorPrompt {
  const targetRules = input.configs
    .map((config, index) => {
      return [
        `${index + 1}. ${config.ontology_target}`,
        `   - label: ${config.concept.label}`,
        `   - concept role: ${config.concept.concept_role}`,
        `   - dimension: ${config.concept.dimension}`,
        `   - compatible measurement approaches: ${config.allowed_measurement_types.join(", ")}`,
        `   - compatible question formats: ${config.allowed_question_types.join(", ") || "(planner decides no visible question)"}`,
        `   - expected mapped value type: ${config.expected_type}`,
        `   - priority: ${config.priority}`,
        `   - notes: ${config.prompt_notes}`,
        `   - methodology notes: ${buildConceptMethodologyNotes(config).join(" | ")}`,
      ].join("\n");
    })
    .join("\n");

  const blueprintRules = input.measurementPlanBlueprint.concepts
    .map((entry, index) => {
      return [
        `${index + 1}. ${entry.concept_key}`,
        `   - evidence source: ${entry.evidence_source}`,
        `   - measurement type: ${entry.measurement_type}`,
        `   - aggregation rule: ${entry.aggregation_rule}`,
        `   - minimum answers: ${entry.minimum_answer_count}`,
        `   - threshold profile: ${entry.threshold_profile}`,
        `   - slots: ${
          entry.question_slots.length > 0
            ? entry.question_slots
                .map((slot) => slot.slot_key)
                .join("; ")
            : "(no survey question slots)"
        }`,
      ].join("\n");
    })
    .join("\n");
  const methodologyRules = buildMethodologyRulesText();

  const system = [
    "You are a survey generation engine for FlexPulseEU.",
    "Realize an already-planned behavioural measurement instrument in the canonical language only.",
    "Return JSON only.",
    "Do not invent schema targets or slot keys outside the allowed list.",
    "Do not ask for direct personal identifiers.",
    "Keep wording neutral, clear, and suitable for real respondents.",
    "Avoid duplicate or near-duplicate questions.",
    "Optimize wording quality without changing the planner's semantic intent or burden logic.",
    "Use only these question types: single_choice, multiple_choice, rating_scale, numeric.",
    "For single_choice and multiple_choice questions, include options with ontology_value and is_truthy fields.",
    "For rating_scale questions, use a 1-5 scale unless the target notes strongly suggest otherwise.",
    "For rating_scale questions, each question must be a single complete statement or direct prompt that can be rated on its own.",
    "The title field must contain the full respondent-facing item text, not a short label, topic name, or metadata heading.",
    "A respondent must be able to answer the item by reading the title alone.",
    "Use description only for optional clarification, examples, or scope notes. Do not put the main question text in description.",
    "Do not use title text like 'Understanding home energy use', 'Willingness to shift appliance use', or other abstract labels in place of a real item.",
    "Do not use generic description text like 'Rate how true this is for you' as a substitute for an actual item.",
    "Do not generate matrix-style wording such as 'the following statements', 'each statement', or any question that implies hidden sub-items not present in the JSON.",
    "For numeric questions, include sensible bounds when possible.",
    "Generate one question for each slot in the measurement blueprint that comes from survey_questions.",
    "Reuse the exact slot_key provided for each generated question.",
    "Every respondent-facing question generated from the blueprint is mandatory by system design.",
    "Do not return a required field for questions; the system applies obligatoriness automatically.",
  ].join(" ");

  const user = [
    `Survey name: ${input.surveyName}`,
    `Canonical language: ${input.defaultLanguage}`,
    `Supported languages in the draft: ${input.supportedLanguages.join(", ")}`,
    `Existing survey description: ${input.surveyDescription || "(empty)"}`,
    `Selected behavioural schema targets: ${input.schemaTargets.join(", ")}`,
    "",
    methodologyRules,
    "",
    "Target-specific generation rules:",
    targetRules,
    "",
    "Measurement blueprint to realize:",
    blueprintRules,
    "",
    "Generation requirements:",
    "- Use only the selected behavioural schema targets.",
    "- Every generated question must point to exactly one ontology_target.",
    "- Every generated question must keep the slot_key from the blueprint.",
    "- Treat the blueprint as the accepted measurement design. Your job is to realize it faithfully.",
    "- The title must be the actual question or statement shown to the respondent.",
    "- The description must never carry the main semantic burden of the item.",
    "- When a concept blueprint contains multiple slots, generate separate questions for those slots. Never compress multiple statements into one question.",
    "- Do not use matrix wording like 'Please rate your agreement with the following statements' unless the actual statements are returned as separate questions.",
    "- Use multiple_choice for conditions, barriers, motivators, accepted scopes, or device lists.",
    "- Use single_choice for factual booleans or categorical preferences.",
    "- Use numeric for temperature setpoints or other direct numeric preferences.",
    "- Keep the survey short enough to be realistic for actual respondents.",
    "- survey_title must be suitable for respondents in the canonical language.",
    "- survey_description should briefly explain the survey purpose in the canonical language.",
    "- Do not include a required field in question objects.",
  ].join("\n");

  return {
    system,
    user,
  };
}

export function buildMeasurementPlannerPrompt(
  input: BuildMeasurementPlannerPromptInput,
): MeasurementPlannerPrompt {
  const conceptRules = input.configs
    .map((config, index) =>
      [
        `${index + 1}. ${config.concept.concept_key}`,
        `   - schema target: ${config.ontology_target}`,
        `   - label: ${config.concept.label}`,
        `   - description: ${config.concept.description}`,
        `   - concept role: ${config.concept.concept_role}`,
        `   - dimension: ${config.concept.dimension}`,
        `   - compatible measurement approaches: ${config.allowed_measurement_types.join(", ")}`,
        `   - compatible question formats: ${config.allowed_question_types.join(", ") || "(no visible question)"}`,
        `   - expected output type: ${config.expected_type}`,
        `   - visible question capacity: up to ${config.slot_capacity_max} slot(s) if you decide the concept needs survey questions`,
        `   - planner context notes: ${buildConceptMethodologyNotes(config).join(" | ")}`,
      ].join("\n"),
    )
    .join("\n");
  const blueprintRules = input.baseMeasurementPlanBlueprint.concepts
    .map((entry, index) => {
      return [
        `${index + 1}. ${entry.concept_key}`,
        `   - evidence source: ${entry.evidence_source}`,
        `   - slot capacity max: ${entry.slot_capacity_max}`,
        `   - output type: ${entry.output_type}`,
      ].join("\n");
    })
    .join("\n");
  const methodologyRules = buildMethodologyRulesText();

  const system = [
    "Identity:",
    "You are the Survey Measurement Planning Agent for FlexPulseEU.",
    "",
    "Mission:",
    "Decide how each selected behavioural concept should be measured so downstream components can generate surveys and later map responses into structured participant profiles.",
    "",
    "Limits:",
    "- You are not a survey writer.",
    "- You do not produce final question wording.",
    "- You do not produce mapping_contract_json directly.",
    "- You do not compute participant scores from real responses.",
    "",
    "System context:",
    "- This system studies household energy behaviour, flexibility, comfort, tariffs, automation trust and DER-related patterns.",
    "- Surveys may later be translated, but this planning step optimizes the canonical measurement design first.",
    "- Low semantic noise and clean construct separation are important.",
    "- Your output is consumed by survey generation, mapping and profiling components, not by end users.",
    "- The planning goal is a statistically and behaviourally defensible measurement strategy, not the shortest possible questionnaire.",
    "",
    "Decision principles:",
    "- Use the provided ontology concepts and system context to choose the most appropriate measurement approach.",
    "- Treat capability envelopes as operational limits, not hidden recommendations about the right number of items.",
    "- Prefer practical and defensible designs over unnecessary complexity.",
    "- Consider downstream mapping clarity and profiling usefulness.",
    "- Use multiple angles or modest redundancy when they materially improve construct separation, interpretability, or profiling usefulness.",
    "- Avoid plans that are fragile, ambiguous or hard to compile operationally.",
    "- You must decide item count per concept yourself; the system is not providing a recommended total question budget.",
    "- Do not under-measure central behavioural constructs just to keep the survey very short.",
    "",
    "Output contract:",
    "- Return JSON only.",
    "- Cover every selected concept.",
    "- Use only the provided concept_key values and supported system measurement types.",
    "- Keep the plan specific enough for downstream compilation.",
    "",
    "Completion criterion:",
    "The task is complete only when every selected concept has one valid planning entry and the output satisfies the required schema.",
  ].join("\n");

  const user = [
    "Dynamic input:",
    `Survey name: ${input.surveyName}`,
    `Canonical language: ${input.defaultLanguage}`,
    `Supported languages in the draft: ${input.supportedLanguages.join(", ")}`,
    `Existing survey description: ${input.surveyDescription || "(empty)"}`,
    `Selected behavioural concept keys: ${input.behaviouralConceptKeys.join(", ")}`,
    `Reference schema targets for downstream mapping context: ${input.schemaTargets.join(", ")}`,
    "",
    "Application context:",
    "- Purpose: generate multilingual surveys for energy-behaviour concepts and later map responses into structured participant profiles.",
    "- Important constraints: low semantic noise, clean construct separation, downstream mapping clarity.",
    "- Downstream artifacts: your plan will later feed survey writing, mapping_contract_json compilation and measurement_plan_json materialization.",
    "",
    methodologyRules,
    "",
    "Server-provided planning envelope:",
    blueprintRules,
    "",
    "Concept-specific planning rules:",
    conceptRules,
    "",
    "Planner mission:",
    "- Design the best instrument you can under the methodology contract while keeping respondent burden proportionate.",
    "- Decide how each concept should be measured inside the compatible measurement envelope for that concept.",
    "- Decide how many question slots each survey-question concept needs; the listed slot capacity is only the operational ceiling.",
    "- Prefer non-question evidence sources to stay slot-free.",
    "- Treat unnecessary redundancy as a defect, but treat under-measurement of central constructs as a more serious defect.",
    "- For core profile axes, prefer multi-item coverage with distinct facets when the survey purpose depends on that axis.",
    "- For behavioural modulators, use one item when peripheral and 2-3 distinct items when the modulator is central to the brief or needed to distinguish profiles.",
    "- For factual applicability factors, prefer one clean closed item unless the concept genuinely requires more structure.",
    "",
    "Return exactly one planning entry per selected concept.",
    "Do not omit any selected concept.",
    "Do not return extra concepts beyond the selected set.",
    "The concept_key field in the JSON output must exactly match one of the selected behavioural concept keys.",
    "Do not use schema targets such as flexpulse_behavioural_schema.* as concept_key values.",
    "For each concept decide the measurement_type, aggregation_rule, threshold_profile and slot_count yourself.",
    "The system will generate deterministic slot_key names later. You must not plan concrete slot identifiers yourself.",
    "Question obligatoriness is decided by the system. All respondent-facing survey questions are treated as required.",
    "For context-only or quality-only concepts, return slot_count 0.",
    "For survey-question concepts, choose slot_count according to methodological need, not by copying a system default.",
    ...(input.repairFeedback && input.repairFeedback.length > 0
      ? [
          "",
          "Feedback from the previous invalid planning attempt:",
          ...input.repairFeedback.map((issue) => `- ${issue}`),
          "Fix those issues while preserving the selected concepts and overall mission.",
        ]
      : []),
  ].join("\n");

  return { system, user };
}
