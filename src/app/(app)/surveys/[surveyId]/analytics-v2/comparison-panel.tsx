"use client";

import { useMemo, useRef, useState } from "react";
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
import { InfoTip } from "./info-tip";

type ComparisonPanelProps = {
  surveyId: string;
  catalog: SegmentCatalog;
  schema: SurveyAnalyticsSchema;
  tray: ComparisonTrayState;
  storageReady: boolean;
  onTrayChange: (tray: ComparisonTrayState) => void;
  onOpenInExplorer: (definition: SegmentDefinition) => void;
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

function InsightsBlock({ items }: { items: ComparisonInsight[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="analytics-v2-seg-analysis-block">
      <h4>
        Semantic comparison insights
        <InfoTip text="At most three evidence-linked readings from the largest non-defining differences. They are not causal effects. Full comparative readings need disjoint samples and at least five applicable responses on each side." />
      </h4>
      <div className="analytics-v2-seg-insight-list">
        {items.map((item) => (
          <article key={`${item.kind}:${item.conceptKeys.join(",")}:${item.observedPattern}`} className="analytics-v2-seg-insight">
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
    </div>
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
    <div className="analytics-v2-segment">
      <section className="analytics-v2-panel">
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

      <section className={`analytics-v2-panel analytics-v2-seg-result${stale && result ? " is-stale" : ""}`}>
        <div className="analytics-v2-panel__head">
          <div className="analytics-v2-panel__title">
            <h3>Comparison analysis</h3>
          </div>
        </div>

        {status === "idle" && !result ? (
          <p className="analytics-v2-seg-empty">
            Place two segment definitions created in Segment Explorer in the tray, then generate the comparison.
          </p>
        ) : null}
        {status === "loading" && !result ? <p className="analytics-v2-seg-empty">Generating the comparison…</p> : null}
        {status === "error" ? <p className="analytics-v2-seg-empty">{error}</p> : null}

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
              <p className="analytics-v2-seg-empty">
                The two definitions select the same responses, so a difference analysis is not generated.
              </p>
            ) : (
              <>
                <div className="analytics-v2-seg-analysis-block">
                  <h4>
                    Compact profile
                    <InfoTip text="Primary-axis medians only. Facets and modulators stay in Largest differences so the signature remains readable as the schema grows." />
                  </h4>
                  <CompareRadar axes={result.profileAxes} />
                </div>

                <div className="analytics-v2-seg-analysis-block">
                  <h4>
                    Largest differences
                    <InfoTip text="Score differences with at least five applicable responses on both sides are listed first, ranked by absolute Cliff’s delta when the samples are disjoint, with median difference as the tie-break. Smaller-n rows stay available via Show all. Composition differences are ranked separately by absolute percentage-point gap." />
                  </h4>
                  <h5>Score differences</h5>
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
                  <h5>Composition differences</h5>
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
                </div>

                {result.definitionDifferences.length > 0 ? (
                  <div className="analytics-v2-seg-analysis-block">
                    <h4>
                      Definition-linked differences
                      <InfoTip text="These dimensions were used directly in the segment filters or belong to the same filtered construct. Their differences are expected from the segment definition and are not treated as new findings." />
                    </h4>
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
                  </div>
                ) : null}

                {result.dfc ? (
                  <div className="analytics-v2-seg-analysis-block">
                    <h4>
                      {result.dfc.label}
                      <InfoTip text="Comparable modules use their own applicable populations. The overall summary is not ranked as a main difference when asset composition differs." />
                    </h4>
                    {result.dfc.assetCompositionDiffers ? (
                      <small>Asset composition differs, so the overall summary stays secondary to comparable modules.</small>
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
                  </div>
                ) : null}

                <div className="analytics-v2-seg-analysis-block">
                  <h4>
                    Where these segments differ
                    <InfoTip text="Country shares only. Finer location, labels and postal codes stay out of this comparison. Weather is outdoor context around the response time, not a causal explanation." />
                  </h4>
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
                  {result.weather.length > 0 ? (
                    <ul className="analytics-v2-compare-weather">
                      {result.weather.map((series) => (
                        <li key={series.field}>
                          {series.label}: A {formatScore(series.medianA)} {series.unit} (n={formatCount(series.nA)}) · B{" "}
                          {formatScore(series.medianB)} {series.unit} (n={formatCount(series.nB)}). Outdoor context, not a
                          causal explanation.
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <small>No usable weather context in these segments.</small>
                  )}
                </div>

                <InsightsBlock items={result.insights} />
              </>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
