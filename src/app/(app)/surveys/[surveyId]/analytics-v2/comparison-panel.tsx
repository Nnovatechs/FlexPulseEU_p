"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { runSegmentComparisonAction } from "@/features/surveys/segment-comparison-actions";
import {
  buildRadarGridPolygon,
  buildRadarPolygon,
  polarPoint,
} from "@/features/surveys/analytics/profile-explorer-utils";
import {
  buildSegmentComparisonExport,
  canExportSegmentComparison,
  canGenerateSegmentComparison,
  comparisonTrayCount,
  getComparisonContextVisibility,
  describeReadableConditions,
  getCompareActionLabel,
  hasSemanticComparisonN,
  isSegmentComparisonStale,
  isWholeSampleDefinition,
  removeComparisonSlot,
  type ComparisonInsight,
  type ComparisonOverlapRelation,
  type ComparisonScoreDifference,
  type ComparisonScoreKind,
  type ComparisonTrayState,
  type SegmentCatalog,
  type SegmentComparisonResult,
  type SegmentComparisonStatus,
  type SegmentDefinition,
} from "@/features/surveys/analytics/segments";
import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";
import { CompositionDifferencePlot, PairedScoreDifferencePlot } from "./comparison-plots";
import { InfoTip } from "./info-tip";
import { PostalAreaComparisonMap } from "./postal-area-comparison-map";

type ComparisonPanelProps = {
  surveyId: string;
  catalog: SegmentCatalog;
  schema: SurveyAnalyticsSchema;
  tray: ComparisonTrayState;
  storageReady: boolean;
  onTrayChange: (tray: ComparisonTrayState) => void;
  onOpenInExplorer: (definition: SegmentDefinition) => void;
  active?: boolean;
};

const SCORE_KIND_LABEL: Record<ComparisonScoreKind, string> = {
  primary_axis: "Primary axis",
  facet: "Facet",
  modulator: "Modulator",
  capability_module: "Capability module",
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatScore(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "n/a";
  }
  return value.toFixed(2);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "n/a";
  }
  return `${Math.round(value * 100)}%`;
}

function formatPp(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "n/a";
  }
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded} pp`;
}

function overlapCopy(relation: ComparisonOverlapRelation) {
  switch (relation) {
    case "identical":
      return "These segments select the same responses. A comparison is not generated.";
    case "disjoint":
      return null;
    case "a_contains_b":
      return "Segment B sits entirely inside Segment A, so the groups are not independent. Differences stay descriptive.";
    case "b_contains_a":
      return "Segment A sits entirely inside Segment B, so the groups are not independent. Differences stay descriptive.";
    case "overlap":
      return "These segments share some of the same responses, so the groups are not independent. Differences stay descriptive.";
  }
}

function slotTitle(definition: SegmentDefinition | null, label: "A" | "B") {
  if (!definition) {
    return `Segment ${label}`;
  }
  if (isWholeSampleDefinition(definition)) {
    return `Segment ${label} · Whole analysed sample`;
  }
  return `Segment ${label}`;
}

function RankedTable<T>({
  items,
  columns,
  initial = 5,
}: {
  items: T[];
  columns: Array<{ key: string; header: string; render: (item: T) => string }>;
  initial?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) {
    return <p className="analytics-v2-seg-empty">No comparable differences in this group.</p>;
  }
  const visible = expanded ? items : items.slice(0, initial);
  return (
    <>
      <div className="analytics-v2-compare-table-wrap">
        <table className="analytics-v2-compare-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item, index) => (
              <tr key={columns.map((column) => column.render(item)).join("|") + index}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(item)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > initial ? (
        <button type="button" className="button button--ghost" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Show fewer" : `Show all (${formatCount(items.length)})`}
        </button>
      ) : null}
    </>
  );
}

function CompareRadar({ axes }: { axes: SegmentComparisonResult["profileAxes"] }) {
  if (axes.length < 3) {
    return <p className="analytics-v2-seg-empty">A radar signature needs at least three scored primary axes.</p>;
  }
  const cx = 168;
  const cy = 160;
  const radius = 108;
  return (
    <div className="analytics-v2-radar analytics-v2-seg-radar">
      <svg viewBox="0 0 336 320" role="img" aria-label="Segment A and B profile signature">
        {[0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={buildRadarGridPolygon(axes.length, cx, cy, radius * ratio)}
            className="analytics-v2-radar__grid"
          />
        ))}
        {axes.map((axis, index) => {
          const angle = -Math.PI / 2 + (index / axes.length) * Math.PI * 2;
          const end = polarPoint(cx, cy, radius, angle);
          const labelPoint = polarPoint(cx, cy, radius + 22, angle);
          return (
            <g key={axis.conceptKey}>
              <title>
                {axis.label}: A {formatScore(axis.medianA)} (n={formatCount(axis.applicableNA)}) · B{" "}
                {formatScore(axis.medianB)} (n={formatCount(axis.applicableNB)})
                {axis.directionNote ? ` · ${axis.directionNote}` : ""}
              </title>
              <line x1={cx} y1={cy} x2={end.x} y2={end.y} className="analytics-v2-radar__axis" />
              <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" className="analytics-v2-radar__label">
                {axis.label}
              </text>
            </g>
          );
        })}
        <polygon
          points={buildRadarPolygon(
            axes.map((axis) => axis.medianB),
            cx,
            cy,
            radius,
          )}
          className="analytics-v2-seg-radar__b"
        />
        <polygon
          points={buildRadarPolygon(
            axes.map((axis) => axis.medianA),
            cx,
            cy,
            radius,
          )}
          className="analytics-v2-seg-radar__segment"
        />
      </svg>
      <small className="analytics-v2-seg-identity__meta">Solid line: A · dashed line: B.</small>
    </div>
  );
}

function CompareSection({
  title,
  tip,
  children,
}: {
  title: string;
  tip: string;
  children: ReactNode;
}) {
  return (
    <section className="analytics-v2-panel analytics-v2-compare-section">
      <header className="analytics-v2-panel__head">
        <h3>
          {title}
          <InfoTip text={tip} />
        </h3>
      </header>
      {children}
    </section>
  );
}

function InsightsBlock({ items }: { items: ComparisonInsight[] }) {
  return (
    <CompareSection
      title="Semantic comparison insights"
      tip="At most three evidence-linked readings from the largest non-defining differences. They are not causal effects. Full comparative readings need disjoint samples and at least five applicable responses on each side."
    >
      {items.length === 0 ? (
        <p className="analytics-v2-insight-empty">
          No comparison insights met the selection rules for these segments.
        </p>
      ) : (
        <div className="analytics-v2-seg-insight-list">
          {items.map((item) => (
            <article
              key={`${item.kind}:${item.conceptKeys.join(",")}:${item.observedPattern}`}
              className="analytics-v2-seg-insight"
            >
              <p>
                <strong>Observed.</strong> {item.observedPattern}
              </p>
              {item.kind !== "none" && item.kind !== "descriptive" && item.potentialReading ? (
                <p>
                  <strong>Potential reading.</strong> {item.potentialReading}
                </p>
              ) : null}
              {item.kind !== "none" && item.kind !== "descriptive" && item.worthExamining ? (
                <p>
                  <strong>Worth examining.</strong> {item.worthExamining}
                </p>
              ) : null}
              {item.evidence ? (
                <small>
                  Evidence: A {item.evidence.selectedValue == null ? "n/a" : item.evidence.selectedValue} (n=
                  {formatCount(item.evidence.selectedN)})
                  {item.evidence.outsideN == null
                    ? ""
                    : ` · B ${item.evidence.outsideValue == null ? "n/a" : item.evidence.outsideValue} (n=${formatCount(item.evidence.outsideN)})`}
                  {item.evidence.delta == null ? "" : ` · Δ ${item.evidence.delta}`}
                  {item.evidence.cliffsDelta == null ? "" : ` · δ=${item.evidence.cliffsDelta.toFixed(2)}`}
                </small>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </CompareSection>
  );
}

function downloadComparisonExport(result: SegmentComparisonResult, schema: SurveyAnalyticsSchema) {
  const file = buildSegmentComparisonExport({ comparison: result, schema });
  const blob = new Blob([file.body], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatCliffs(row: { applicableNA: number; applicableNB: number; cliffsDelta: number | null }) {
  if (!hasSemanticComparisonN(row.applicableNA, row.applicableNB)) {
    return "Descriptive only";
  }
  return row.cliffsDelta == null ? "n/a" : row.cliffsDelta.toFixed(2);
}

function scoreDirection(row: ComparisonScoreDifference) {
  if (row.medianDelta === 0) {
    return "Same median";
  }
  return row.medianDelta > 0 ? "A higher" : "B higher";
}

export function ComparisonPanel({
  surveyId,
  catalog,
  schema,
  tray,
  storageReady,
  onTrayChange,
  onOpenInExplorer,
  active = true,
}: ComparisonPanelProps) {
  const count = comparisonTrayCount(tray);
  const definitionA = tray.slots[0];
  const definitionB = tray.slots[1];
  const [status, setStatus] = useState<SegmentComparisonStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SegmentComparisonResult | null>(null);
  const requestRef = useRef(0);
  const stale = isSegmentComparisonStale({
    trayA: definitionA,
    trayB: definitionB,
    generatedA: result?.definitionA ?? null,
    generatedB: result?.definitionB ?? null,
    analysedN: catalog.analysedN,
    generatedAnalysedN: result?.sample.analysedN ?? null,
  });
  const generateInput = {
    trayA: definitionA,
    trayB: definitionB,
    generatedA: result?.definitionA ?? null,
    generatedB: result?.definitionB ?? null,
    analysedN: catalog.analysedN,
    generatedAnalysedN: result?.sample.analysedN ?? null,
    status,
  };
  const canGenerate = canGenerateSegmentComparison(generateInput);
  const canExport = canExportSegmentComparison(status, stale, result);
  const actionLabel = getCompareActionLabel(generateInput);
  const overlapMessage = result ? overlapCopy(result.sample.relation) : null;
  const contextVisibility = result ? getComparisonContextVisibility(result) : null;
  const labelA = result ? slotTitle(result.definitionA, "A") : "Segment A";
  const labelB = result ? slotTitle(result.definitionB, "B") : "Segment B";
  const chipsA = useMemo(
    () => (definitionA ? describeReadableConditions(definitionA, schema) : []),
    [definitionA, schema],
  );
  const chipsB = useMemo(
    () => (definitionB ? describeReadableConditions(definitionB, schema) : []),
    [definitionB, schema],
  );

  const handleGenerate = () => {
    if (!definitionA || !definitionB) {
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setStatus("loading");
    setError(null);
    void runSegmentComparisonAction(surveyId, definitionA, definitionB)
      .then((next) => {
        if (requestRef.current !== requestId) {
          return;
        }
        setResult(next);
        setStatus("ready");
      })
      .catch((caught: unknown) => {
        if (requestRef.current !== requestId) {
          return;
        }
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "The comparison could not be generated.");
      });
  };

  return (
    <div className="analytics-v2-segment analytics-v2-compare">
      <section className="analytics-v2-panel analytics-v2-compare-tray">
        <div className="analytics-v2-panel__head">
          <div className="analytics-v2-panel__title">
            <h3>
              Compare {count}/2
              <InfoTip text="Compare two segment definitions created in Segment Explorer. Generate explicitly. The result ranks the largest differences; it does not repeat full profiles." />
            </h3>
            <p>
              {storageReady
                ? "Add two segment definitions created in Segment Explorer, then generate the comparison."
                : "Loading the comparison tray…"}
            </p>
          </div>
          <div className="analytics-v2-seg-result-actions">
            <button
              type="button"
              className="button button--ghost"
              disabled={!canExport}
              onClick={() => {
                if (!result || !canExport) {
                  return;
                }
                downloadComparisonExport(result, schema);
              }}
            >
              Export comparison analysis
            </button>
          </div>
        </div>

        <div className="analytics-v2-comparison-slots">
          {(["A", "B"] as const).map((label, index) => {
            const slot = index as 0 | 1;
            const definition = tray.slots[slot];
            const chips = label === "A" ? chipsA : chipsB;
            const sampleN = result && !stale ? (label === "A" ? result.sample.nA : result.sample.nB) : null;
            const sampleShare = result && !stale ? (label === "A" ? result.sample.shareA : result.sample.shareB) : null;
            return (
              <article key={label} className="analytics-v2-seg-slot analytics-v2-compare-card">
                <div>
                  <span>{slotTitle(definition, label)}</span>
                  <strong>
                    {definition
                      ? isWholeSampleDefinition(definition)
                        ? "Whole analysed sample"
                        : `${definition.conditions.length} condition${definition.conditions.length === 1 ? "" : "s"}`
                      : "Empty slot"}
                  </strong>
                  {chips.length > 0 ? (
                    <div className="analytics-v2-seg-toolbar__chips">
                      {chips.map((condition, chipIndex) => (
                        <span key={`${condition.field}:${chipIndex}`} className="analytics-v2-seg-chip is-active">
                          {condition.label}: {condition.detail}
                        </span>
                      ))}
                    </div>
                  ) : definition ? (
                    <small>No filters applied.</small>
                  ) : null}
                  <small>
                    N {sampleN == null ? "—" : formatCount(sampleN)}
                    {sampleShare == null ? "" : ` · ${formatPercent(sampleShare)} of survey`}
                  </small>
                </div>
                <div className="analytics-v2-seg-toolbar__actions">
                  <button
                    type="button"
                    className="button button--ghost"
                    disabled={!definition}
                    onClick={() => definition && onOpenInExplorer(definition)}
                  >
                    Open in Explorer
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    disabled={!definition}
                    onClick={() => onTrayChange(removeComparisonSlot(tray, slot))}
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="analytics-v2-seg-analyse-bar">
          <button
            type="button"
            className="analytics-v2-seg-analyse"
            disabled={!canGenerate}
            aria-busy={status === "loading"}
            onClick={handleGenerate}
          >
            {actionLabel}
          </button>
        </div>
      </section>

      {status === "idle" && !result ? (
        <section className="analytics-v2-empty-card">
          <h3>No comparison yet</h3>
          <p>Place two segment definitions created in Segment Explorer in the tray, then generate the comparison.</p>
        </section>
      ) : null}
      {status === "loading" && !result ? (
        <section className="analytics-v2-empty-card">
          <h3>Generating the comparison</h3>
          <p>The ranked differences will appear here when the comparison is ready.</p>
        </section>
      ) : null}
      {status === "error" ? (
        <section className="analytics-v2-empty-card">
          <h3>Comparison could not be generated</h3>
          <p>{error}</p>
        </section>
      ) : null}

      {result ? (
        <>
          {stale ? (
            <p className="analytics-v2-segment-notice" role="status">
              The tray or the available population has changed. The results below describe the last generated
              comparison. Update the comparison to apply the current segments.
            </p>
          ) : null}

          {overlapMessage ? (
            <p className="analytics-v2-compare-overlap" role="status">
              {overlapMessage}
            </p>
          ) : null}

          {result.blockedReason === "identical" ? (
            <section className="analytics-v2-empty-card">
              <h3>No difference analysis</h3>
              <p>The two definitions select the same responses, so a difference analysis is not generated.</p>
            </section>
          ) : (
            <>
              <CompareSection
                title="Compact profile"
                tip="Primary-axis medians only. Facets and modulators stay in Score differences so the signature remains readable as the schema grows."
              >
                <CompareRadar axes={result.profileAxes} />
              </CompareSection>

              <InsightsBlock items={result.insights} />

              <CompareSection
                title="Score differences"
                tip="Score differences with at least five applicable responses on both sides are listed first, ranked by absolute Cliff’s delta when the samples are disjoint, with median difference as the tie-break. Smaller-n rows stay available via Show all. Each row places Segment A and Segment B on the same 1–5 scale. Points show medians and horizontal intervals show the interquartile range. Cliff’s delta is available only for disjoint segments and is descriptive, not causal."
              >
                <PairedScoreDifferencePlot items={result.scoreDifferences} />
                <details className="analytics-v2-compare-details">
                  <summary>View exact score values</summary>
                  <RankedTable
                    items={result.scoreDifferences}
                    columns={[
                      { key: "type", header: "Type", render: (row) => SCORE_KIND_LABEL[row.kind] },
                      { key: "name", header: "Name", render: (row) => row.label },
                      { key: "a", header: "Median A", render: (row) => formatScore(row.medianA) },
                      { key: "b", header: "Median B", render: (row) => formatScore(row.medianB) },
                      { key: "delta", header: "Δ median", render: (row) => formatScore(row.medianDelta) },
                      {
                        key: "cliffs",
                        header: "Cliff’s δ",
                        render: (row) => formatCliffs(row),
                      },
                      {
                        key: "n",
                        header: "N A / B",
                        render: (row) => `${formatCount(row.applicableNA)} / ${formatCount(row.applicableNB)}`,
                      },
                      { key: "dir", header: "Direction", render: scoreDirection },
                      { key: "evidence", header: "Evidence", render: (row) => row.evidenceLabel ?? "—" },
                    ]}
                  />
                </details>
              </CompareSection>

              <CompareSection
                title="Composition differences"
                tip="Composition differences are ranked by absolute percentage-point gap. Bars show the percentage-point difference in category prevalence, calculated as Segment A minus Segment B. Bars to the right are more common in A; bars to the left are more common in B. Percentages use the applicable population for each field. Suppressed cells are not plotted."
              >
                <CompositionDifferencePlot items={result.compositionDifferences} />
                <details className="analytics-v2-compare-details">
                  <summary>View exact composition values</summary>
                  <RankedTable
                    items={result.compositionDifferences.filter((row) => row.family !== "geography")}
                    columns={[
                      { key: "name", header: "Name", render: (row) => `${row.label}: ${row.valueLabel}` },
                      { key: "a", header: "% A", render: (row) => formatPercent(row.shareA) },
                      { key: "b", header: "% B", render: (row) => formatPercent(row.shareB) },
                      { key: "pp", header: "Δ pp", render: (row) => formatPp(row.deltaPercentagePoints) },
                      {
                        key: "n",
                        header: "N A / B",
                        render: (row) => `${formatCount(row.applicableNA)} / ${formatCount(row.applicableNB)}`,
                      },
                    ]}
                  />
                </details>
              </CompareSection>

              {result.householdConditions ? (
                <CompareSection
                  title={result.householdConditions.label}
                  tip="Factual household conditions and stated settings. Medians and shares use applicable n; missing answers are listed separately. These rows are descriptive context, not evidence that one segment is better. Interested assets are not treated as owned inventory."
                >
                  {result.householdConditions.numerics.length > 0 ? (
                    <RankedTable
                      items={result.householdConditions.numerics}
                      columns={[
                        { key: "name", header: "Setting", render: (row) => row.label },
                        {
                          key: "a",
                          header: "Median A",
                          render: (row) =>
                            row.medianA == null ? "n/a" : `${row.medianA.toFixed(0)}${row.unit ? ` ${row.unit}` : ""}`,
                        },
                        {
                          key: "b",
                          header: "Median B",
                          render: (row) =>
                            row.medianB == null ? "n/a" : `${row.medianB.toFixed(0)}${row.unit ? ` ${row.unit}` : ""}`,
                        },
                        {
                          key: "iqr",
                          header: "IQR A / B",
                          render: (row) =>
                            `${row.q1A == null || row.q3A == null ? "n/a" : `${row.q1A.toFixed(0)}–${row.q3A.toFixed(0)}`} / ${row.q1B == null || row.q3B == null ? "n/a" : `${row.q1B.toFixed(0)}–${row.q3B.toFixed(0)}`}`,
                        },
                        {
                          key: "n",
                          header: "Applicable / missing A · B",
                          render: (row) =>
                            `${formatCount(row.applicableNA)}/${formatCount(row.missingNA)} · ${formatCount(row.applicableNB)}/${formatCount(row.missingNB)}`,
                        },
                      ]}
                    />
                  ) : null}
                  {result.householdConditions.categories.map((group) => (
                    <div key={group.field} className="analytics-v2-seg-stack">
                      <strong>{group.label}</strong>
                      <small>
                        applicable n A/B {formatCount(group.applicableNA)}/{formatCount(group.applicableNB)} ·
                        missing/no answer {formatCount(group.missingNA)}/{formatCount(group.missingNB)}
                      </small>
                      <RankedTable
                        items={group.values}
                        columns={[
                          { key: "name", header: "Value", render: (row) => row.valueLabel },
                          { key: "a", header: "% A", render: (row) => formatPercent(row.shareA) },
                          { key: "b", header: "% B", render: (row) => formatPercent(row.shareB) },
                          { key: "pp", header: "Δ pp", render: (row) => formatPp(row.deltaPercentagePoints) },
                        ]}
                      />
                    </div>
                  ))}
                </CompareSection>
              ) : null}

              {result.definitionDifferences.length > 0 ? (
                <CompareSection
                  title="Definition-linked differences"
                  tip="These dimensions were used directly in the segment filters or belong to the same filtered construct. Their differences are expected from the segment definition and are not treated as new findings."
                >
                  <RankedTable
                    items={result.definitionDifferences}
                    columns={[
                      { key: "type", header: "Type", render: (row) => SCORE_KIND_LABEL[row.kind] },
                      { key: "name", header: "Name", render: (row) => row.label },
                      { key: "a", header: "Median A", render: (row) => formatScore(row.medianA) },
                      { key: "b", header: "Median B", render: (row) => formatScore(row.medianB) },
                      { key: "delta", header: "Δ median", render: (row) => formatScore(row.medianDelta) },
                      {
                        key: "n",
                        header: "N A / B",
                        render: (row) => `${formatCount(row.applicableNA)} / ${formatCount(row.applicableNB)}`,
                      },
                    ]}
                  />
                </CompareSection>
              ) : null}

              {result.dfc ? (
                <CompareSection
                  title={result.dfc.label}
                  tip="Comparable modules use their own applicable populations. The overall summary is not ranked as a main difference when asset composition differs."
                >
                  {result.dfc.assetCompositionDiffers ? (
                    <small>
                      Asset composition differs, so the overall summary stays secondary to comparable modules.
                    </small>
                  ) : null}
                  <p>
                    Overall: A {formatScore(result.dfc.overall.medianA)} (n=
                    {formatCount(result.dfc.overall.applicableNA)}) · B {formatScore(result.dfc.overall.medianB)} (n=
                    {formatCount(result.dfc.overall.applicableNB)})
                  </p>
                  <RankedTable
                    items={result.dfc.modules}
                    columns={[
                      { key: "name", header: "Module", render: (row) => row.label },
                      {
                        key: "app",
                        header: "Applicable A / B",
                        render: (row) => `${formatCount(row.applicableNA)} / ${formatCount(row.applicableNB)}`,
                      },
                      {
                        key: "rate",
                        header: "Applicability",
                        render: (row) => `${formatPercent(row.applicabilityRateA)} / ${formatPercent(row.applicabilityRateB)}`,
                      },
                      { key: "a", header: "Median A", render: (row) => formatScore(row.medianA) },
                      { key: "b", header: "Median B", render: (row) => formatScore(row.medianB) },
                      { key: "delta", header: "Δ median", render: (row) => formatScore(row.medianDelta) },
                      {
                        key: "iqr",
                        header: "IQR A / B",
                        render: (row) =>
                          `${formatScore(row.q1A)}–${formatScore(row.q3A)} / ${formatScore(row.q1B)}–${formatScore(row.q3B)}`,
                      },
                      {
                        key: "cliffs",
                        header: "Cliff’s δ",
                        render: (row) => formatCliffs(row),
                      },
                    ]}
                  />
                </CompareSection>
              ) : null}

              {result.postalMap && result.postalMap.areas.length > 0 ? (
                <CompareSection
                  title="Geographic distribution"
                  tip="A descriptive comparison of relative geographic composition. Colours show where each segment has a larger share of its mapped responses, normalised by the mapped total of that segment."
                >
                  <PostalAreaComparisonMap
                    comparison={result.postalMap}
                    active={active}
                    labelA={labelA}
                    labelB={labelB}
                  />
                </CompareSection>
              ) : null}

              {contextVisibility?.hasContext ? (
                <CompareSection
                  title="Where these segments differ"
                  tip="Country shares only. Finer location, labels and postal codes stay out of this comparison. Weather is outdoor context around the response time, not a causal explanation."
                >
                  {contextVisibility.hasGeographyContext ? (
                    <RankedTable
                      items={result.geography}
                      columns={[
                        { key: "name", header: "Area", render: (row) => row.label },
                        { key: "a", header: "% A", render: (row) => formatPercent(row.shareA) },
                        { key: "b", header: "% B", render: (row) => formatPercent(row.shareB) },
                        { key: "pp", header: "Δ pp", render: (row) => formatPp(row.deltaPercentagePoints) },
                        {
                          key: "n",
                          header: "N area",
                          render: (row) => formatCount(row.analysedCount),
                        },
                      ]}
                    />
                  ) : null}
                  {contextVisibility.hasWeatherContext ? (
                    <ul className="analytics-v2-compare-weather">
                      {result.weather.map((series) => (
                        <li key={series.field}>
                          {series.label}: A {formatScore(series.medianA)} {series.unit} (n={formatCount(series.nA)}) · B{" "}
                          {formatScore(series.medianB)} {series.unit} (n={formatCount(series.nB)}). Outdoor context, not a
                          causal explanation.
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </CompareSection>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
