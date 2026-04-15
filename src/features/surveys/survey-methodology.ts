import type { FlexpulseDescriptorRole } from "@/features/ontology/flexpulse-behavioural-schema";
import type { GeneratorTargetConfig } from "./generator-config";

export const SURVEY_METHODOLOGY_CONTRACT = {
  objectives: [
    "Design a compact but defensible behavioural instrument rather than a generic questionnaire.",
    "Maximize useful behavioural profiling signal under realistic respondent burden.",
    "Preserve semantic traceability from question wording to mapping contract and final measurement plan.",
  ],
  hard_constraints: [
    "Every selected concept must end with an explicit measurement strategy or a justified non-question evidence source.",
    "Each survey question must measure one semantic intention only.",
    "The chosen question type must fit the measurement type and later aggregation logic.",
    "The design must compile cleanly into question-level mappings and construct-level aggregation rules.",
    "The total burden must remain realistic for an actual respondent session.",
    "Question wording must remain robust under multilingual translation and multicultural adaptation.",
    "Reject matrix-style compression, hidden sub-items, and nearly identical duplicates.",
  ],
  soft_optimization_goals: [
    "Maximize construct coverage.",
    "Maximize angle diversity when multiple items are used.",
    "Minimize respondent burden and avoid unnecessary length.",
    "Maximize downstream interpretability for profiling and mapping.",
    "Maximize robustness across languages and local contexts.",
    "Minimize manual post-generation corrections.",
  ],
  tradeoff_policy: [
    "Protect semantic validity first.",
    "Protect aggregation viability and behavioural profiling usefulness second.",
    "Optimize respondent burden third.",
    "Optimize surface simplicity and elegance last.",
  ],
  scorecard: [
    {
      metric: "construct_coverage",
      prompt:
        "Does each selected concept have enough evidence to support later interpretation?",
    },
    {
      metric: "angle_diversity",
      prompt:
        "When more than one item is used, do the items cover meaningfully different angles rather than paraphrasing each other?",
    },
    {
      metric: "measurement_fit",
      prompt:
        "Does the chosen question format fit the construct type and intended measurement semantics?",
    },
    {
      metric: "aggregation_viability",
      prompt:
        "Can the planned evidence be aggregated into an explainable concept-level descriptor without inventing semantics later?",
    },
    {
      metric: "respondent_burden",
      prompt:
        "Is the total length and cognitive effort realistic for an actual public survey respondent?",
    },
    {
      metric: "translation_robustness",
      prompt:
        "Is the wording stable enough for multilingual translation without hidden ambiguity?",
    },
    {
      metric: "semantic_traceability",
      prompt:
        "Does every planned question remain cleanly linked to stable keys, mappings and the final measurement plan?",
    },
    {
      metric: "profiling_usefulness",
      prompt:
        "Will the resulting instrument produce signals that are actually useful for behavioural profiling rather than vague opinions?",
    },
  ],
  wording_rules: [
    "Use respondent-facing language that is clear, neutral and culturally portable.",
    "Avoid double-barrelled items, matrix wording, hidden assumptions and trivial paraphrases.",
    "Keep scales directionally consistent unless a strong reason justifies otherwise.",
    "Prefer closed response formats for core profiling constructs.",
  ],
} as const;

function getRoleSpecificRules(role: FlexpulseDescriptorRole): string[] {
  switch (role) {
    case "primary_profile_axis":
      return [
        "Treat this as a core latent construct whose coverage should be justified, not assumed.",
        "If more than one item is used, vary the angle without creating near-duplicate items.",
      ];
    case "behavioural_modulator":
      return [
        "Use compact explanatory evidence that clarifies a main axis rather than replacing it.",
        "Extra items are acceptable only when they add distinct interpretive value.",
      ];
    case "applicability_factor":
      return [
        "Prefer factual closed questions over attitudinal phrasing.",
        "Optimize for clean segmentation and later filtering, not latent construct depth.",
      ];
    default:
      return [];
  }
}

export function buildMethodologyRulesText() {
  return [
    "Survey methodology contract:",
    ...SURVEY_METHODOLOGY_CONTRACT.objectives.map((rule) => `- objective: ${rule}`),
    "",
    "Hard constraints:",
    ...SURVEY_METHODOLOGY_CONTRACT.hard_constraints.map((rule) => `- ${rule}`),
    "",
    "Soft optimization goals:",
    ...SURVEY_METHODOLOGY_CONTRACT.soft_optimization_goals.map(
      (rule) => `- ${rule}`,
    ),
    "",
    "Trade-off policy:",
    ...SURVEY_METHODOLOGY_CONTRACT.tradeoff_policy.map((rule) => `- ${rule}`),
    "",
    "Methodology scorecard:",
    ...SURVEY_METHODOLOGY_CONTRACT.scorecard.map(
      (entry) => `- ${entry.metric}: ${entry.prompt}`,
    ),
    "",
    "Wording rules:",
    ...SURVEY_METHODOLOGY_CONTRACT.wording_rules.map((rule) => `- ${rule}`),
  ].join("\n");
}

export function buildConceptMethodologyNotes(
  config: Pick<GeneratorTargetConfig, "concept" | "prompt_notes">,
): string[] {
  return [
    "Treat generator priors as soft constraints, not mandatory templates.",
    ...getRoleSpecificRules(config.concept.descriptor_role),
    config.prompt_notes,
  ];
}
