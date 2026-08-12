"use client";

import { useMemo, useState } from "react";
import type { SurveyOverviewData } from "@/features/surveys/analytics/overview-v2";
import { OverviewPanel } from "./overview-panel";

type AnalyticsV2TabKey =
  | "overview"
  | "segments"
  | "selected-segment"
  | "comparison"
  | "diagnostics";

type AnalyticsV2WorkbenchProps = {
  surveyTitle: string;
  overviewData: SurveyOverviewData;
};

type AnalyticsV2TabDefinition = {
  key: AnalyticsV2TabKey;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
};

const ANALYTICS_V2_TABS: AnalyticsV2TabDefinition[] = [
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
    label: "Instrument Diagnostics",
    eyebrow: "Survey Health",
    title: "Survey functioning and instrument health",
    description:
      "This tab is the placeholder for checking whether the questionnaire is behaving properly: response quality, coverage, and instrument-level warnings.",
    bullets: [
      "Field completion, drop-off, and friction signals.",
      "Potential quality flags, suspicious patterns, or mapping readiness warnings.",
      "Eventually, psychometric and wording diagnostics separated from the operational overview.",
    ],
  },
];

export function AnalyticsV2Workbench({ surveyTitle, overviewData }: AnalyticsV2WorkbenchProps) {
  const [activeTab, setActiveTab] = useState<AnalyticsV2TabKey>("overview");

  const activeDefinition = useMemo(
    () => ANALYTICS_V2_TABS.find((tab) => tab.key === activeTab) ?? ANALYTICS_V2_TABS[0],
    [activeTab],
  );

  return (
    <div className="analytics-v2-workbench">
      <header className="analytics-v2-workbench__header">
        <div className="analytics-v2-workbench__title-block">
          <p className="analytics-content__eyebrow">Experimental workspace</p>
          <h1>{surveyTitle}</h1>
          <p>
            A new analytics surface for FlexPulse intelligence. The current analytics dashboard
            stays untouched while this v2 workspace evolves in parallel.
          </p>
        </div>

        <nav className="analytics-v2-tabbar" aria-label="Analytics 2 sections">
          {ANALYTICS_V2_TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                className={`analytics-v2-tabbar__tab${isActive ? " is-active" : ""}`}
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {activeTab === "overview" ? (
        <OverviewPanel data={overviewData} />
      ) : (
        <section className="analytics-v2-panel-grid">
          <article className="analytics-v2-hero-card">
            <div>
              <p className="analytics-v2-hero-card__eyebrow">{activeDefinition.eyebrow}</p>
              <h2>{activeDefinition.title}</h2>
              <p>{activeDefinition.description}</p>
            </div>
            <div className="analytics-v2-status-pill">Placeholder</div>
          </article>

          <article className="analytics-v2-card">
            <h3>What will live here</h3>
            <ul className="analytics-v2-list">
              {activeDefinition.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>

          <article className="analytics-v2-card analytics-v2-card--muted">
            <h3>Design intent</h3>
            <p>
              This route is intentionally isolated from the legacy analytics page so we can reshape
              navigation, information hierarchy, and visual language without destabilising the
              existing flow before launch.
            </p>
          </article>

          <article className="analytics-v2-card analytics-v2-card--accent">
            <h3>Next build target</h3>
            <p>
              This tab stays as a placeholder for now. Only <strong>Overview</strong> is wired to
              real data in this iteration.
            </p>
          </article>
        </section>
      )}
    </div>
  );
}
