export type AnalyticsV2TabKey =
  | "overview"
  | "segments"
  | "comparison"
  | "diagnostics";

export type AnalyticsV2TabDefinition = {
  key: AnalyticsV2TabKey;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
};

export const ANALYTICS_V2_TABS: AnalyticsV2TabDefinition[] = [
  {
    key: "overview",
    label: "Overview",
    eyebrow: "Analytics 2",
    title: "Survey intelligence overview",
    description:
      "This placeholder will become the entry point for the new analytical workflow: high-signal summary blocks, headline cohort shifts, and a fast read of what matters now.",
    bullets: [
      "Executive summary cards for sample size, rollout health, and dominant behavioural signals.",
      "A cleaner path into deeper analytical lenses without exposing the legacy dashboard structure.",
      "Space for opinionated, decision-oriented insight instead of a raw data dump.",
    ],
  },
  {
    key: "segments",
    label: "Segment Explorer",
    eyebrow: "Explore",
    title: "Segment Explorer",
    description:
      "Build a transparent filter set, inspect the matching profile, save the definition in this browser, or send it to Comparison.",
    bullets: [
      "Dynamic filters from the analytics schema.",
      "AND-only conditions with a readable active set.",
      "Named segments and a two-slot comparison tray stored locally.",
    ],
  },
  {
    key: "comparison",
    label: "Comparison",
    eyebrow: "Compare",
    title: "Comparison tray",
    description:
      "Hold up to two segment definitions side by side. Full A/B analysis will arrive in a later iteration.",
    bullets: [
      "Add the current explorer segment or a saved definition.",
      "Whole sample occupies a normal slot when added explicitly.",
      "Open either slot back in Segment Explorer without losing the other.",
    ],
  },
  {
    key: "diagnostics",
    label: "Instrument Health",
    eyebrow: "Survey Health",
    title: "Instrument functioning and evidence",
    description:
      "Check how the questionnaire is behaving before interpreting or publishing scores: scoring integrity, item behaviour, and construct-level limitations.",
    bullets: [
      "Scoring reproduction against the mapper, version consistency, and answer validity.",
      "Item analysis, internal consistency only where the measurement role allows it, and DFC coverage by asset.",
      "Response-pattern checks and multilingual notes without inventing CFA or invariance results.",
    ],
  },
];
