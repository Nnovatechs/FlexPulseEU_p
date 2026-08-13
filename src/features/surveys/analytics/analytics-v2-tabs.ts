export type AnalyticsV2TabKey =
  | "overview"
  | "segments"
  | "selected-segment"
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
    eyebrow: "Future Lens",
    title: "Segment exploration workspace",
    description:
      "This tab is reserved for navigating the reference population, cohort filters, and profile slices without committing yet to the old rail-based interaction model.",
    bullets: [
      "Segment and cohort entry points.",
      "Population and benchmark switching.",
      "Drill-down cards for country, audience, and profile distributions.",
    ],
  },
  {
    key: "selected-segment",
    label: "Selected Segment",
    eyebrow: "Future Lens",
    title: "Focused segment readout",
    description:
      "This placeholder will hold the detailed analytical story for one selected group once the v2 interaction model is defined.",
    bullets: [
      "Profile signatures and behavioural deltas.",
      "Comparative readout against the chosen baseline.",
      "Notes area for future interpretive or strategic takeaways.",
    ],
  },
  {
    key: "comparison",
    label: "Comparison",
    eyebrow: "Future Lens",
    title: "Structured comparison space",
    description:
      "This area is kept for side-by-side benchmark views, so the v2 dashboard can compare populations without inheriting the current dashboard layout assumptions.",
    bullets: [
      "A vs B cohort comparison.",
      "Relative movement across selected constructs.",
      "Compact evidence framing for sample adequacy and caution signals.",
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
