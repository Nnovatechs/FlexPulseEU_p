import type { FlexpulseConceptRole } from "@/features/ontology/flexpulse-behavioural-schema";
import type { GeneratorTargetConfig } from "./generator-config";

export const SURVEY_METHODOLOGY_CONTRACT = {
  objectives: [
    "Design a compact but defensible behavioural instrument rather than a generic questionnaire.",
    "Prioritize useful behavioural profiling signal over making the shortest possible survey.",
    "Preserve semantic traceability from question wording to mapping contract and final measurement plan.",
  ],
  hard_constraints: [
    "Every selected concept must end with an explicit measurement strategy or a justified non-question evidence source.",
    "Each survey question must measure one semantic intention only.",
    "The chosen question type must fit the measurement type and later aggregation logic.",
    "The design must compile cleanly into question-level mappings and construct-level aggregation rules.",
    "The total burden must remain acceptable, but under-measuring core constructs is a worse failure than adding a few useful items.",
    "Respondent-facing wording must be natural, unambiguous and publishable in the selected canonical language. Additional language versions are handled by the later translation workflow.",
    "Reject matrix-style compression, hidden sub-items, and nearly identical duplicates.",
  ],
  soft_optimization_goals: [
    "Maximize construct coverage.",
    "Maximize measurement depth when depth materially improves profiling usefulness.",
    "Maximize angle diversity when multiple items are used.",
    "Keep respondent burden proportionate instead of minimizing length at all costs.",
    "Maximize downstream interpretability for profiling and mapping.",
    "Minimize manual post-generation corrections.",
  ],
  tradeoff_policy: [
    "Protect semantic validity first.",
    "Protect aggregation viability and behavioural profiling usefulness second.",
    "Protect sufficient measurement depth for central constructs third.",
    "Optimize respondent burden fourth.",
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
      metric: "measurement_depth",
      prompt:
        "Is the number of planned items sufficient for the construct role and the survey purpose, avoiding weak one-item proxies for central behavioural signals?",
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
        "Is the total length and cognitive effort proportionate to the measurement purpose?",
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

function getRoleSpecificRules(role: FlexpulseConceptRole): string[] {
  switch (role) {
    case "primary_profile_axis":
      return [
        "Treat this as a core profile construct. Justify its coverage according to its operational definition; do not assume that every primary profile axis is a reflective latent scale.",
        "Prefer multi-item coverage with distinct facets when this axis is central to the survey purpose.",
        "Use single-item coverage only when the survey purpose makes this concept clearly peripheral or the construct is intentionally lightweight.",
        "If more than one item is used, vary the angle without creating near-duplicate items.",
      ];
    case "behavioural_modulator":
      return [
        "Use compact explanatory evidence that clarifies a main axis rather than replacing it.",
        "If this modulator is central to the survey brief or needed to distinguish profiles, prefer 2-3 distinct items over a fragile single-item proxy.",
        "If it is peripheral, a single clear item is acceptable.",
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
    ...getRoleSpecificRules(config.concept.concept_role),
    config.prompt_notes,
  ];
}
