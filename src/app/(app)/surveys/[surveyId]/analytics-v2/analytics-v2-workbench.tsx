"use client";

import { useMemo, useState } from "react";
import type { SurveyOverviewData } from "@/features/surveys/analytics/overview-v2";
import {
  ANALYTICS_V2_TABS,
  type AnalyticsV2TabKey,
} from "@/features/surveys/analytics/analytics-v2-tabs";
import { OverviewPanel } from "./overview-panel";
import { InstrumentHealthPanel } from "./instrument-health-panel";

type AnalyticsV2WorkbenchProps = {
  surveyId: string;
  surveyTitle: string;
  overviewData: SurveyOverviewData;
};

export function AnalyticsV2Workbench({
  surveyId,
  surveyTitle,
  overviewData,
}: AnalyticsV2WorkbenchProps) {
  const [activeTab, setActiveTab] = useState<AnalyticsV2TabKey>("overview");

  const activeDefinition = useMemo(
    () => ANALYTICS_V2_TABS.find((tab) => tab.key === activeTab) ?? ANALYTICS_V2_TABS[0],
    [activeTab],
  );

  return (
    <div className="analytics-v2-workbench">
      <header className="analytics-v2-workbench__header">
        <div className="analytics-v2-workbench__title-block">
          <p className="analytics-content__eyebrow">Analytics dashboard</p>
          <h1>{surveyTitle}</h1>
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

      <div hidden={activeTab !== "overview"}>
        <OverviewPanel data={overviewData} />
      </div>

      <div hidden={activeTab !== "diagnostics"}>
        <InstrumentHealthPanel
          surveyId={surveyId}
          currentCollectedN={overviewData.context.collectedResponseCount}
        />
      </div>

      {activeTab !== "overview" && activeTab !== "diagnostics" ? (
        <section className="analytics-v2-panel-grid">
          <article className="analytics-v2-hero-card">
            <div>
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
              This tab stays as a placeholder for now. Overview and Instrument Health are wired in
              this iteration.
            </p>
          </article>
        </section>
      ) : null}
    </div>
  );
}
