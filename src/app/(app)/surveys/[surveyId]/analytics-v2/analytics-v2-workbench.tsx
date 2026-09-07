"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { SurveyOverviewData } from "@/features/surveys/analytics/overview-v2";
import {
  ANALYTICS_V2_TABS,
  type AnalyticsV2TabKey,
} from "@/features/surveys/analytics/analytics-v2-tabs";
import {
  SEGMENT_URL_PARAM,
  commitSegmentDefinition,
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
import { analyticsOnboardingGuide } from "@/components/onboarding/guides";
import { PageOnboardingGuide } from "@/components/onboarding/page-onboarding-guide";
import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";
import { OverviewPanel } from "./overview-panel";
import { InstrumentHealthPanel } from "./instrument-health-panel";
import { SegmentExplorerPanel } from "./segment-explorer-panel";
import { ComparisonPanel } from "./comparison-panel";

const POSTAL_AREA_KEY_FIELD = "geo.postal_area.area_key";

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
  const supportedPostalAreaValues = useMemo(
    () =>
      new Set(
        (catalog.geography.find((field) => field.field === POSTAL_AREA_KEY_FIELD)?.values ?? []).map((entry) => entry.value),
      ),
    [catalog.geography],
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
      const nextConditions = validated.definition.conditions.flatMap((condition) => {
        if (condition.kind !== "in" || condition.field !== POSTAL_AREA_KEY_FIELD) {
          return [condition];
        }
        const values = condition.values.filter(
          (value): value is string => typeof value === "string" && supportedPostalAreaValues.has(value),
        );
        return values.length > 0 ? [{ ...condition, values }] : [];
      });
      const sanitized = commitSegmentDefinition({
        next: { ...validated.definition, conditions: nextConditions },
        schema,
      });
      if (!sanitized.ok) {
        return { definition: emptyDefinition, notice: sanitized.message, preloaded: false };
      }
      const removedUnsupported =
        validated.definition.conditions
          .filter((condition) => condition.kind === "in" && condition.field === POSTAL_AREA_KEY_FIELD)
          .flatMap((condition) => (condition.kind === "in" ? condition.values : [])).length -
        sanitized.definition.conditions
          .filter((condition) => condition.kind === "in" && condition.field === POSTAL_AREA_KEY_FIELD)
          .flatMap((condition) => (condition.kind === "in" ? condition.values : [])).length;
      return {
        definition: sanitized.definition,
        notice:
          removedUnsupported > 0
            ? "Some postal areas in the URL are not supported by this survey map and were ignored."
            : null,
        preloaded: !isWholeSampleDefinition(sanitized.definition),
      };
    },
    [catalog.measurementHash, emptyDefinition, schema, supportedPostalAreaValues, surveyId],
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
    const committed = commitSegmentDefinition({ next, schema });
    if (!committed.ok) {
      setNotice(committed.message);
      return;
    }
    setDefinition(committed.definition);
    setNotice(null);
    setPreloaded(!isWholeSampleDefinition(committed.definition));
    replaceSegmentParam(
      isWholeSampleDefinition(committed.definition) ? null : encodeSegmentDefinition(committed.definition),
    );
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
          <div className="analytics-v2-workbench__title-row">
            <h1>{surveyTitle}</h1>
            <PageOnboardingGuide {...analyticsOnboardingGuide} theme="analytics" />
          </div>
        </div>

        <nav className="analytics-v2-tabbar" aria-label="Analytics 2 sections">
          {ANALYTICS_V2_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const label =
              tab.key === "comparison" ? `Compare ${comparisonTrayCount(tray)}/2` : tab.label;
            return (
              <button
                key={tab.key}
                type="button"
                className={`analytics-v2-tabbar__tab${isActive ? " is-active" : ""}`}
                aria-pressed={isActive}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setActiveTab(tab.key);
                }}
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

      <div
        hidden={activeTab !== "overview"}
        className={activeTab === "overview" ? undefined : "analytics-v2-tab-panel--inactive"}
      >
        <OverviewPanel data={overviewData} active={activeTab === "overview"} />
      </div>

      <div
        hidden={activeTab !== "segments"}
        className={activeTab === "segments" ? undefined : "analytics-v2-tab-panel--inactive"}
      >
        <SegmentExplorerPanel
          surveyId={surveyId}
          catalog={catalog}
          schema={schema}
          definition={definition}
          notice={notice}
          onDefinitionChange={handleDefinitionChange}
          onOpenComparison={() => setActiveTab("comparison")}
          onTrayChange={persistTray}
          active={activeTab === "segments"}
        />
      </div>

      <div
        hidden={activeTab !== "comparison"}
        className={activeTab === "comparison" ? undefined : "analytics-v2-tab-panel--inactive"}
        id="analytics-v2-compare-panel"
      >
        <ComparisonPanel
          surveyId={surveyId}
          catalog={catalog}
          schema={schema}
          tray={tray}
          storageReady
          onTrayChange={persistTray}
          onOpenInExplorer={handleOpenInExplorer}
          active={activeTab === "comparison"}
        />
      </div>

      <div
        hidden={activeTab !== "diagnostics"}
        className={activeTab === "diagnostics" ? undefined : "analytics-v2-tab-panel--inactive"}
      >
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
