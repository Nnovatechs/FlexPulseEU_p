"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { SurveyOverviewData } from "@/features/surveys/analytics/overview-v2";
import {
  ANALYTICS_V2_TABS,
  type AnalyticsV2TabKey,
} from "@/features/surveys/analytics/analytics-v2-tabs";
import {
  SEGMENT_URL_PARAM,
  comparisonTrayCount,
  decodeSegmentDefinition,
  emptyComparisonTray,
  emptySegmentDefinition,
  encodeSegmentDefinition,
  getComparisonTraySnapshot,
  isWholeSampleDefinition,
  subscribeSegmentStorage,
  validateSegmentDefinition,
  writeComparisonTray,
  type ComparisonTrayState,
  type SegmentCatalog,
  type SegmentDefinition,
} from "@/features/surveys/analytics/segments";
import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";
import { OverviewPanel } from "./overview-panel";
import { InstrumentHealthPanel } from "./instrument-health-panel";
import { SegmentExplorerPanel } from "./segment-explorer-panel";
import { ComparisonPanel } from "./comparison-panel";

type AnalyticsV2WorkbenchProps = {
  surveyId: string;
  surveyTitle: string;
  overviewData: SurveyOverviewData;
  catalog: SegmentCatalog;
  schema: SurveyAnalyticsSchema;
  initialSegmentParam: string | null;
};

function readSegmentParam() {
  if (typeof window === "undefined") {
    return null;
  }
  return new URL(window.location.href).searchParams.get(SEGMENT_URL_PARAM);
}

function replaceSegmentParam(payload: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  if (payload) {
    url.searchParams.set(SEGMENT_URL_PARAM, payload);
  } else {
    url.searchParams.delete(SEGMENT_URL_PARAM);
  }
  window.history.replaceState(window.history.state, "", url);
}

export function AnalyticsV2Workbench({
  surveyId,
  surveyTitle,
  overviewData,
  catalog,
  schema,
  initialSegmentParam,
}: AnalyticsV2WorkbenchProps) {
  const [activeTab, setActiveTab] = useState<AnalyticsV2TabKey>("overview");
  const emptyDefinition = useMemo(
    () =>
      emptySegmentDefinition({
        surveyId,
        schemaNamespace: catalog.schemaNamespace,
        measurementHash: catalog.measurementHash,
      }),
    [catalog.measurementHash, catalog.schemaNamespace, surveyId],
  );

  const resolveParam = useCallback(
    (param: string | null) => {
      if (!param) {
        return { definition: emptyDefinition, notice: null as string | null, preloaded: false };
      }
      const decoded = decodeSegmentDefinition(param);
      if (!decoded.ok) {
        return { definition: emptyDefinition, notice: decoded.message, preloaded: false };
      }
      const validated = validateSegmentDefinition(decoded.definition, schema, {
        surveyId,
        measurementHash: catalog.measurementHash,
      });
      if (!validated.ok) {
        return { definition: emptyDefinition, notice: validated.message, preloaded: false };
      }
      return { definition: validated.definition, notice: null, preloaded: !isWholeSampleDefinition(validated.definition) };
    },
    [catalog.measurementHash, emptyDefinition, schema, surveyId],
  );

  const initial = useMemo(() => resolveParam(initialSegmentParam), [initialSegmentParam, resolveParam]);
  const [definition, setDefinition] = useState<SegmentDefinition>(initial.definition);
  const [notice, setNotice] = useState<string | null>(initial.notice);
  const [preloaded, setPreloaded] = useState(initial.preloaded);
  const tray = useSyncExternalStore(
    subscribeSegmentStorage,
    () => getComparisonTraySnapshot(surveyId, catalog.measurementHash, schema),
    emptyComparisonTray,
  );
  const persistTray = (next: ComparisonTrayState) => {
    writeComparisonTray(surveyId, catalog.measurementHash, next);
  };

  useEffect(() => {
    function onPopState() {
      const resolved = resolveParam(readSegmentParam());
      setDefinition(resolved.definition);
      setNotice(resolved.notice);
      setPreloaded(resolved.preloaded);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [resolveParam]);

  const handleDefinitionChange = (next: SegmentDefinition) => {
    setDefinition(next);
    setNotice(null);
    setPreloaded(!isWholeSampleDefinition(next));
    replaceSegmentParam(isWholeSampleDefinition(next) ? null : encodeSegmentDefinition(next));
  };

  const handleOpenInExplorer = (next: SegmentDefinition) => {
    handleDefinitionChange(next);
    setActiveTab("segments");
  };

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
            const isActive = activeTab === tab.key;
            const label =
              tab.key === "comparison" ? `Comparison ${comparisonTrayCount(tray)}/2` : tab.label;
            return (
              <button
                key={tab.key}
                type="button"
                className={`analytics-v2-tabbar__tab${isActive ? " is-active" : ""}`}
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.key)}
              >
                {label}
                {tab.key === "segments" && preloaded ? (
                  <span className="analytics-v2-tabbar__dot" aria-label="A segment is preloaded" />
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>

      <div hidden={activeTab !== "overview"}>
        <OverviewPanel data={overviewData} />
      </div>

      <div hidden={activeTab !== "segments"}>
        <SegmentExplorerPanel
          surveyId={surveyId}
          catalog={catalog}
          schema={schema}
          definition={definition}
          notice={notice}
          onDefinitionChange={handleDefinitionChange}
          onOpenComparison={() => setActiveTab("comparison")}
          onTrayChange={persistTray}
        />
      </div>

      <div hidden={activeTab !== "comparison"}>
        <ComparisonPanel
          tray={tray}
          storageReady
          onTrayChange={persistTray}
          onOpenInExplorer={handleOpenInExplorer}
        />
      </div>

      <div hidden={activeTab !== "diagnostics"}>
        <InstrumentHealthPanel
          surveyId={surveyId}
          currentCollectedN={overviewData.context.collectedResponseCount}
        />
      </div>

      {activeTab !== "overview" &&
      activeTab !== "diagnostics" &&
      activeTab !== "segments" &&
      activeTab !== "comparison" ? (
        <section className="analytics-v2-panel-grid">
          <article className="analytics-v2-hero-card">
            <h2>{activeDefinition.title}</h2>
            <p>{activeDefinition.description}</p>
          </article>
        </section>
      ) : null}
    </div>
  );
}
