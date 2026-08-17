"use client";

import { useState } from "react";
import {
  getFieldBand,
  hasTraceShare,
  isWholeSampleDefinition,
  percentageBarWidth,
  buildSegmentAnalysisExport,
  canExportSegmentAnalysis,
  type SegmentAnalysisProfileAxis,
  type SegmentAnalysisResult,
  type SegmentAssetPenetration,
  type SegmentAssociation,
  type SegmentBandKey,
  type SegmentCategoryDifferentiator,
  type SegmentConditionalModule,
  type SegmentConditionalSummary,
  type SegmentDefinition,
  type SegmentFacetSignal,
  type SegmentGeographyRow,
  type SegmentInternalVariation,
  type SegmentScoreDifferentiator,
  type SegmentSemanticInsight,
  type SegmentSupportingFactorAxis,
  type SegmentWeatherSeries,
} from "@/features/surveys/analytics/segments";
import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";
import {
  buildRadarGridPolygon,
  buildRadarPolygon,
  polarPoint,
} from "@/features/surveys/analytics/profile-explorer-utils";
import { InfoTip } from "./info-tip";

const PROFILE_TIP =
  "Median and IQR on the 1–5 scale for each measured primary axis. The filled marker is the segment median; the bar is the interquartile range. This describes the selected responses only.";
const RADAR_TIP =
  "A compact visual signature of the same medians. It is not a performance score. Higher is not always better: some axes, such as thermal norms, are stricter when the score is higher.";
const BANDS_TIP =
  "How applicable responses in the analysed segment fall into the construct-specific semantic bands. Percentages use the applicable n for that axis.";
const DIFF_TIP =
  "Selected segment versus everyone outside it. Defining filters are excluded. Cliff’s delta ranks ordinal score differences; it is not a test of significance or a causal effect.";
const CATEGORY_TIP =
  "Share of the segment versus share of respondents outside the segment, in percentage points. This ranking is separate from Cliff’s delta.";
const FACETS_TIP =
  "Measured sub-parts of a primary axis. A single-item signal is descriptive, not a validated subscale. Facets do not change the aggregated construct score.";
const SUPPORTING_TIP =
  "Independent supporting scores from this survey’s schema, grouped by dimension. They do not change the primary-axis medians.";
const DFC_TIP =
  "Conditional capability modules present in this survey. Applicability is module-specific. Overall is a summary; the module breakdown is the operational reading.";
const ASSETS_TIP =
  "Declared asset ownership in the selected segment. Ownership is not the same as declared capability.";
const VARIATION_TIP =
  "Where respondents inside the selected segment still differ from one another. Highest score dispersion orders by normalised IQR on the 1–5 scale. Most mixed semantic bands orders by band entropy (0 = one band, 1 = even mix).";
const GEO_TIP =
  "Penetration is segment respondents in the area divided by all analysed respondents in that area. Areas with fewer than five analysed responses are omitted. Exact counts of 1–4 in the area, or in its complement, are suppressed.";
const WEATHER_TIP =
  "Weather values describe approximate outdoor conditions around the response time. They do not represent indoor temperature or establish a causal effect on responses.";
const INSIGHTS_TIP =
  "At most three evidence-linked readings. Comparative readings need at least five applicable responses in both the segment and the exterior. They are not causal effects and they never treat a defining filter as a discovery.";
const ASSOCIATIONS_TIP =
  "Spearman correlations inside the analysed segment, limited to scored primary axes and supporting factors. Collapsed and capped; this is not instrument diagnostics.";

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

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function scaleX(value: number, width: number) {
  return ((Math.max(1, Math.min(5, value)) - 1) / 4) * width;
}

function DotIqrPlot({
  axes,
  showWholeSurvey,
}: {
  axes: SegmentAnalysisProfileAxis[];
  showWholeSurvey: boolean;
}) {
  const width = 220;
  return (
    <div className="analytics-v2-seg-iqr-list">
      {axes.map((axis) => {
        const q1 = scaleX(axis.q1, width);
        const q3 = scaleX(axis.q3, width);
        const median = scaleX(axis.median, width);
        const survey = axis.wholeSurveyMedian == null ? null : scaleX(axis.wholeSurveyMedian, width);
        return (
          <div key={axis.conceptKey} className="analytics-v2-seg-iqr-row">
            <div className="analytics-v2-seg-iqr-row__meta">
              <strong>
                {axis.label}
                {axis.defining ? <small>Used to define this segment</small> : null}
              </strong>
              {axis.directionNote ? <small>{axis.directionNote}</small> : null}
            </div>
            <svg viewBox={`0 0 ${width} 28`} className="analytics-v2-seg-iqr-plot" role="img" aria-label={axis.label}>
              <line x1="0" y1="14" x2={width} y2="14" className="analytics-v2-seg-iqr-plot__base" />
              <rect x={q1} y="10" width={Math.max(q3 - q1, 1.5)} height="8" className="analytics-v2-seg-iqr-plot__iqr" />
              <circle cx={median} cy="14" r="4.2" className="analytics-v2-seg-iqr-plot__median" />
              {showWholeSurvey && survey != null ? (
                <circle cx={survey} cy="14" r="4.6" className="analytics-v2-seg-iqr-plot__survey" />
              ) : null}
            </svg>
            <div className="analytics-v2-seg-iqr-row__stats">
              <span>{formatScore(axis.median)}</span>
              <small>
                IQR {formatScore(axis.q1)}–{formatScore(axis.q3)} · n={formatCount(axis.applicableN)}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SegmentRadar({
  axes,
  showWholeSurvey,
}: {
  axes: SegmentAnalysisProfileAxis[];
  showWholeSurvey: boolean;
}) {
  if (axes.length < 3) {
    return <p className="analytics-v2-seg-empty">A radar signature needs at least three scored primary axes.</p>;
  }

  const cx = 168;
  const cy = 160;
  const radius = 108;
  const values = axes.map((axis) => axis.median);
  const surveyValues = axes.map((axis) => axis.wholeSurveyMedian ?? axis.median);

  return (
    <div className="analytics-v2-radar analytics-v2-seg-radar">
      <svg viewBox="0 0 336 320" role="img" aria-label="Segment profile signature">
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
              <line x1={cx} y1={cy} x2={end.x} y2={end.y} className="analytics-v2-radar__axis" />
              <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" className="analytics-v2-radar__label">
                {axis.label}
              </text>
            </g>
          );
        })}
        {showWholeSurvey ? (
          <polygon points={buildRadarPolygon(surveyValues, cx, cy, radius)} className="analytics-v2-seg-radar__survey" />
        ) : null}
        <polygon points={buildRadarPolygon(values, cx, cy, radius)} className="analytics-v2-seg-radar__segment" />
      </svg>
    </div>
  );
}

function BandBars({ axes }: { axes: SegmentAnalysisProfileAxis[] }) {
  return (
    <div className="analytics-v2-seg-band-list">
      {axes.map((axis) => (
        <div key={axis.conceptKey} className="analytics-v2-seg-band-row">
          <strong>
            {axis.label}
            {axis.defining ? <small>Used to define this segment</small> : null}
          </strong>
          <div className="analytics-v2-stack" aria-hidden="true">
            {axis.bands.map((band) =>
              band.share > 0 ? (
                <span
                  key={band.key}
                  className={`analytics-v2-stack__seg analytics-v2-stack__seg--${band.key}`}
                  style={{ width: `${percentageBarWidth(band.share)}%` }}
                />
              ) : null,
            )}
          </div>
          <small>
            {axis.bands
              .map((band) => `${formatPercent(band.share)} ${band.label} (${formatCount(band.count)})`)
              .join(" · ")}
            {` · n=${formatCount(axis.applicableN)}`}
          </small>
        </div>
      ))}
    </div>
  );
}

function ScoreForest({ items }: { items: SegmentScoreDifferentiator[] }) {
  return (
    <div className="analytics-v2-seg-forest">
      <div className="analytics-v2-seg-forest__axis">
        <span>Lower than outside</span>
        <span>0</span>
        <span>Higher than outside</span>
      </div>
      {items.map((item) => {
        const delta = item.cliffsDelta ?? 0;
        const left = 50 + Math.max(-1, Math.min(1, delta)) * 46;
        return (
          <div key={item.conceptKey} className="analytics-v2-seg-forest__row">
            <strong>{item.label}</strong>
            <div className="analytics-v2-seg-forest__track">
              <i style={{ left: `${left}%` }} />
            </div>
            <small>
              Δ median {formatScore(item.medianDelta)} · δ={item.cliffsDelta == null ? "n/a" : item.cliffsDelta.toFixed(2)} · n=
              {formatCount(item.segment.applicableN)}/{formatCount(item.outside.applicableN)}
            </small>
          </div>
        );
      })}
    </div>
  );
}

function FacetSignals({ items }: { items: SegmentFacetSignal[] }) {
  const concepts = Array.from(
    new Map(items.map((item) => [item.conceptKey, item.conceptLabel])).entries(),
  );
  const [conceptKey, setConceptKey] = useState(concepts[0]?.[0] ?? "");
  const selectedConcept = concepts.some(([key]) => key === conceptKey) ? conceptKey : concepts[0]?.[0] ?? "";
  const conceptFacets = items.filter((item) => item.conceptKey === selectedConcept);
  const [facetKey, setFacetKey] = useState(conceptFacets[0]?.facet ?? "");
  const selectedFacet =
    conceptFacets.find((item) => item.facet === facetKey) ?? conceptFacets[0] ?? null;

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="analytics-v2-seg-analysis-block">
      <h4>
        Facet signals
        <InfoTip text={FACETS_TIP} />
      </h4>
      <label className="analytics-v2-seg-toggle">
        Construct
        <select value={selectedConcept} onChange={(event) => setConceptKey(event.target.value)}>
          {concepts.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {conceptFacets[0]?.definingParent ? (
        <small className="analytics-v2-seg-toolbar__hint">How the defining construct is expressed</small>
      ) : null}
      <div className="analytics-v2-seg-iqr-list">
        {conceptFacets.map((facet) => (
          <button
            key={facet.field}
            type="button"
            className={`analytics-v2-seg-iqr-row analytics-v2-seg-facet-pick${selectedFacet?.field === facet.field ? " is-active" : ""}`}
            onClick={() => setFacetKey(facet.facet)}
          >
            <div className="analytics-v2-seg-iqr-row__meta">
              <strong>{facet.label}</strong>
              <small>{facet.evidenceLabel}</small>
            </div>
            <svg viewBox="0 0 220 28" className="analytics-v2-seg-iqr-plot" role="img" aria-label={facet.label}>
              <line x1="0" y1="14" x2="220" y2="14" className="analytics-v2-seg-iqr-plot__base" />
              <circle cx={scaleX(facet.median, 220)} cy="14" r="4.2" className="analytics-v2-seg-iqr-plot__median" />
            </svg>
            <div className="analytics-v2-seg-iqr-row__stats">
              <span>{formatScore(facet.median)}</span>
              <small>
                IQR {formatScore(facet.q1)}–{formatScore(facet.q3)} · n={formatCount(facet.applicableN)}
                {facet.outside
                  ? ` · outside ${formatScore(facet.outside.median)} · Δ ${formatScore(facet.medianDelta)} · δ=${facet.cliffsDelta == null ? "n/a" : facet.cliffsDelta.toFixed(2)} · n=${formatCount(facet.outside.applicableN)}`
                  : ""}
              </small>
            </div>
          </button>
        ))}
      </div>
      {selectedFacet ? (
        <div className="analytics-v2-seg-band-row">
          <strong>{selectedFacet.label}</strong>
          <div className="analytics-v2-stack" aria-hidden="true">
            {selectedFacet.bands.map((band) =>
              band.share > 0 ? (
                <span
                  key={band.key}
                  className={`analytics-v2-stack__seg analytics-v2-stack__seg--${band.key}`}
                  style={{ width: `${percentageBarWidth(band.share)}%` }}
                />
              ) : null,
            )}
          </div>
          <small>
            {selectedFacet.bands
              .map((band) => `${formatPercent(band.share)} ${band.label} (${formatCount(band.count)})`)
              .join(" · ")}
          </small>
        </div>
      ) : null}
    </div>
  );
}

function SupportingFactors({ items }: { items: SegmentSupportingFactorAxis[] }) {
  if (items.length === 0) {
    return null;
  }

  const groups = new Map<string, SegmentSupportingFactorAxis[]>();
  for (const item of items) {
    const current = groups.get(item.dimension) ?? [];
    current.push(item);
    groups.set(item.dimension, current);
  }

  return (
    <div className="analytics-v2-seg-analysis-block">
      <h4>
        Supporting factors
        <InfoTip text={SUPPORTING_TIP} />
      </h4>
      {Array.from(groups.entries()).map(([dimension, factors]) => (
        <div key={dimension} className="analytics-v2-seg-stack">
          <small className="analytics-v2-seg-toolbar__hint">{factors[0]?.dimensionLabel}</small>
          <DotIqrPlot
            axes={factors.map((factor) => ({
              conceptKey: factor.conceptKey,
              field: factor.field,
              label: factor.label,
              directionNote: factor.directionNote,
              defining: factor.defining,
              applicableN: factor.applicableN,
              median: factor.median,
              q1: factor.q1,
              q3: factor.q3,
              bands: factor.bands,
              wholeSurveyMedian: factor.wholeSurveyMedian,
            }))}
            showWholeSurvey={false}
          />
          {factors.some((factor) => factor.outside) ? (
            <small>
              {factors
                .filter((factor) => factor.outside)
                .map(
                  (factor) =>
                    `${factor.label}: ${formatScore(factor.median)} vs ${formatScore(factor.outside?.median)} · Δ ${formatScore(factor.medianDelta)} · δ=${factor.cliffsDelta == null ? "n/a" : factor.cliffsDelta.toFixed(2)} · n=${formatCount(factor.applicableN)}/${formatCount(factor.outside?.applicableN ?? 0)}`,
                )
                .join(" · ")}
            </small>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ConditionalModules({ summary }: { summary: SegmentConditionalSummary }) {
  const [selectedKey, setSelectedKey] = useState("overall");
  const selected =
    selectedKey === "overall"
      ? null
      : summary.modules.find((module) => module.setKey === selectedKey) ?? summary.modules[0] ?? null;

  return (
    <div className="analytics-v2-seg-analysis-block">
      <h4>
        {summary.label}
        <InfoTip text={DFC_TIP} />
      </h4>
      <label className="analytics-v2-seg-toggle">
        Module
        <select value={selected ? selected.setKey : "overall"} onChange={(event) => setSelectedKey(event.target.value)}>
          <option value="overall">Overall</option>
          {summary.modules.map((module) => (
            <option key={module.setKey} value={module.setKey}>
              {module.label}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <ConditionalModuleCard module={selected} />
      ) : (
        <div className="analytics-v2-seg-identity">
          <div className="analytics-v2-kpi-strip analytics-v2-seg-kpis">
            <article className="analytics-v2-kpi">
              <span>Overall median</span>
              <strong>{formatScore(summary.overall?.median)}</strong>
              <small>n={formatCount(summary.overall?.applicableN ?? 0)}</small>
            </article>
            <article className="analytics-v2-kpi">
              <span>Modules in schema</span>
              <strong>{formatCount(summary.modules.length)}</strong>
              <small>Present in this survey</small>
            </article>
          </div>
          {summary.applicableModuleCounts.length > 0 ? (
            <small>
              Applicable modules per household:{" "}
              {summary.applicableModuleCounts
                .map((entry) => `${entry.count} (${formatCount(entry.households)})`)
                .join(" · ")}
            </small>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ConditionalModuleCard({ module }: { module: SegmentConditionalModule }) {
  return (
    <div className="analytics-v2-seg-identity">
      <div className="analytics-v2-kpi-strip analytics-v2-seg-kpis">
        <article className="analytics-v2-kpi">
          <span>Applicable</span>
          <strong>{formatCount(module.applicableN)}</strong>
          <small>{formatPercent(module.applicabilityRate)} of the segment</small>
        </article>
        <article className="analytics-v2-kpi">
          <span>Not applicable</span>
          <strong>{formatCount(module.notApplicableN)}</strong>
          <small>Outside this module</small>
        </article>
        <article className="analytics-v2-kpi">
          <span>Median</span>
          <strong>{formatScore(module.median)}</strong>
          <small>
            IQR {formatScore(module.q1)}–{formatScore(module.q3)}
          </small>
        </article>
      </div>
      {module.bands.length > 0 ? (
        <div className="analytics-v2-seg-band-row">
          <strong>{module.label}</strong>
          <div className="analytics-v2-stack" aria-hidden="true">
            {module.bands.map((band) =>
              band.share > 0 ? (
                <span
                  key={band.key}
                  className={`analytics-v2-stack__seg analytics-v2-stack__seg--${band.key}`}
                  style={{ width: `${percentageBarWidth(band.share)}%` }}
                />
              ) : null,
            )}
          </div>
        </div>
      ) : (
        <p className="analytics-v2-seg-empty">No applicable scores for this module in the analysed segment.</p>
      )}
      {module.outside ? (
        <small>
          Outside applicable n={formatCount(module.outside.applicableN)} · median {formatScore(module.outside.median)}
        </small>
      ) : null}
    </div>
  );
}

function InsightsBlock({ items }: { items: SegmentSemanticInsight[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="analytics-v2-seg-analysis-block">
      <h4>
        Semantic insights
        <InfoTip text={INSIGHTS_TIP} />
      </h4>
      <div className="analytics-v2-seg-insight-list">
        {items.map((item) => (
          <article key={`${item.kind}:${item.conceptKeys.join(",")}`} className="analytics-v2-seg-insight">
            <p>
              <strong>Observed pattern.</strong> {item.observedPattern}
            </p>
            {item.kind !== "none" && item.potentialReading ? (
              <p>
                <strong>Potential reading.</strong> {item.potentialReading}
              </p>
            ) : null}
            {item.kind !== "none" && item.worthExamining ? (
              <p>
                <strong>Worth examining.</strong> {item.worthExamining}
              </p>
            ) : null}
            {item.evidence ? (
              <small>
                Evidence: selected {item.evidence.selectedValue == null ? "n/a" : item.evidence.selectedValue} (n=
                {formatCount(item.evidence.selectedN)})
                {item.evidence.outsideN == null
                  ? ""
                  : ` · outside ${item.evidence.outsideValue == null ? "n/a" : item.evidence.outsideValue} (n=${formatCount(item.evidence.outsideN)})`}
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

function InternalVariation({
  items,
  draftDefinition,
  onExploreSubgroup,
}: {
  items: SegmentInternalVariation[];
  draftDefinition?: SegmentDefinition | null;
  onExploreSubgroup?: (field: string, band: SegmentBandKey) => void;
}) {
  const [sort, setSort] = useState<"iqr" | "entropy">("iqr");
  if (items.length === 0) {
    return null;
  }

  const ordered = items.slice().sort((left, right) => {
    if (sort === "entropy") {
      return right.bandEntropy - left.bandEntropy;
    }
    return right.normalisedIqr - left.normalisedIqr;
  });

  return (
    <div className="analytics-v2-seg-analysis-block">
      <h4>
        Internal variation
        <InfoTip text={VARIATION_TIP} />
      </h4>
      <p className="analytics-v2-seg-identity__meta">
        These variables show where respondents inside the selected segment differ most from one another.
      </p>
      <label className="analytics-v2-seg-toggle">
        Sort
        <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
          <option value="iqr">Highest score dispersion</option>
          <option value="entropy">Most mixed semantic bands</option>
        </select>
      </label>
      {ordered.map((item) => {
        const activeBand = draftDefinition ? getFieldBand(draftDefinition, item.field) : null;
        return (
          <div key={item.field} className="analytics-v2-seg-band-row">
            <strong>
              {item.label}
              <small>
                IQR {item.iqr.toFixed(2)} · H={item.bandEntropy.toFixed(2)} · n={formatCount(item.applicableN)}
              </small>
            </strong>
            <div className="analytics-v2-stack" aria-hidden="true">
              {item.bands.map((band) =>
                band.share > 0 ? (
                  <span
                    key={band.key}
                    className={`analytics-v2-stack__seg analytics-v2-stack__seg--${band.key}`}
                    style={{ width: `${percentageBarWidth(band.share)}%` }}
                  />
                ) : null,
              )}
            </div>
            {onExploreSubgroup ? (
              <div className="analytics-v2-seg-bands">
                {item.bands.map((band) => (
                  <button
                    key={band.key}
                    type="button"
                    className={`analytics-v2-seg-chip${activeBand === band.key ? " is-active" : ""}`}
                    onClick={() => onExploreSubgroup(item.field, band.key)}
                  >
                    Explore {band.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function GeographyBlock({ items }: { items: SegmentGeographyRow[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="analytics-v2-seg-analysis-block">
      <h4>
        Geography
        <InfoTip text={GEO_TIP} />
      </h4>
      <div className="analytics-v2-seg-cat-list">
        {items.map((item) => (
          <div key={`${item.field}:${item.value}`} className="analytics-v2-seg-cat-row">
            <strong>{item.label}</strong>
            {item.disclosure === "suppressed" ? (
              <small>Suppressed for privacy</small>
            ) : (
              <>
                <div className="analytics-v2-seg-cat-bars">
                  <span
                    className={hasTraceShare(item.penetration) ? "is-trace" : undefined}
                    style={{ width: `${percentageBarWidth(item.penetration)}%` }}
                  />
                </div>
                <small>
                  Penetration {formatPercent(item.penetration)} ({formatCount(item.segmentCount ?? 0)}/
                  {formatCount(item.analysedCount)}) · composition {formatPercent(item.composition)}
                </small>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeatherBlock({ items }: { items: SegmentWeatherSeries[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="analytics-v2-seg-analysis-block">
      <h4>
        Weather context
        <InfoTip text={WEATHER_TIP} />
      </h4>
      <div className="analytics-v2-seg-iqr-list">
        {items.map((item) => (
          <div key={item.field} className="analytics-v2-seg-iqr-row">
            <div className="analytics-v2-seg-iqr-row__meta">
              <strong>{item.label}</strong>
              <small>Weather context · n={formatCount(item.n)}</small>
            </div>
            <div className="analytics-v2-seg-iqr-row__stats">
              <span>
                {formatScore(item.median)}
                {item.unit}
              </span>
              <small>
                IQR {formatScore(item.q1)}–{formatScore(item.q3)} · {formatScore(item.min)} to {formatScore(item.max)}
                {item.outsideMedian == null ? "" : ` · outside ${formatScore(item.outsideMedian)}${item.unit}`}
              </small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssociationsBlock({ items }: { items: SegmentAssociation[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <details className="analytics-v2-seg-analysis-block analytics-v2-seg-nested">
      <summary>
        Advanced associations
        <InfoTip text={ASSOCIATIONS_TIP} />
      </summary>
      <div className="analytics-v2-seg-cat-list">
        {items.map((item) => (
          <div key={`${item.leftConceptKey}:${item.rightConceptKey}`} className="analytics-v2-seg-cat-row">
            <strong>
              {item.leftLabel} · {item.rightLabel}
            </strong>
            <small>
              ρ={item.rho.toFixed(2)} · paired n={formatCount(item.pairedN)}
            </small>
          </div>
        ))}
      </div>
    </details>
  );
}

function AssetBars({ items }: { items: SegmentAssetPenetration[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="analytics-v2-seg-analysis-block">
      <h4>
        Asset penetration
        <InfoTip text={ASSETS_TIP} />
      </h4>
      <div className="analytics-v2-seg-cat-list">
        {items.map((item) => (
          <div key={item.value} className="analytics-v2-seg-cat-row">
            <strong>{item.label}</strong>
            {item.disclosure === "suppressed" ? (
              <small>Suppressed for privacy</small>
            ) : (
              <>
                <div className="analytics-v2-seg-cat-bars">
                  <span
                    className={hasTraceShare(item.segmentShare) ? "is-trace" : undefined}
                    style={{ width: `${percentageBarWidth(item.segmentShare)}%` }}
                  />
                  {item.comparisonAvailable ? (
                    <em
                      className={hasTraceShare(item.outsideShare) ? "is-trace" : undefined}
                      style={{ width: `${percentageBarWidth(item.outsideShare)}%` }}
                    />
                  ) : null}
                </div>
                <small>
                  {item.comparisonAvailable
                    ? `${formatPercent(item.segmentShare)} (${formatCount(item.segmentCount ?? 0)}/${formatCount(item.segmentN)}) vs ${formatPercent(item.outsideShare)} (${formatCount(item.outsideCount ?? 0)}/${formatCount(item.outsideN)})${item.deltaPercentagePoints == null ? "" : ` · ${item.deltaPercentagePoints >= 0 ? "+" : ""}${item.deltaPercentagePoints.toFixed(1)} pp`}`
                    : `${formatPercent(item.segmentShare)} (${formatCount(item.segmentCount ?? 0)}/${formatCount(item.segmentN)}) · descriptive only`}
                </small>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBars({ items }: { items: SegmentCategoryDifferentiator[] }) {
  return (
    <div className="analytics-v2-seg-cat-list">
      {items.map((item) => (
        <div key={`${item.field}:${item.value}`} className="analytics-v2-seg-cat-row">
          <strong>
            {item.label}: {item.valueLabel}
          </strong>
          {item.disclosure === "suppressed" ? (
            <small>Suppressed for privacy</small>
          ) : (
            <>
              <div className="analytics-v2-seg-cat-bars">
                <span
                  className={hasTraceShare(item.segmentShare) ? "is-trace" : undefined}
                  style={{ width: `${percentageBarWidth(item.segmentShare)}%` }}
                />
                <em
                  className={hasTraceShare(item.outsideShare) ? "is-trace" : undefined}
                  style={{ width: `${percentageBarWidth(item.outsideShare)}%` }}
                />
              </div>
              <small>
                {formatPercent(item.segmentShare)} ({formatCount(item.segmentCount ?? 0)}/{formatCount(item.segmentN)}) vs{" "}
                {formatPercent(item.outsideShare)} ({formatCount(item.outsideCount ?? 0)}/{formatCount(item.outsideN)})
                {item.deltaPercentagePoints == null
                  ? ""
                  : ` · ${item.deltaPercentagePoints >= 0 ? "+" : ""}${item.deltaPercentagePoints.toFixed(1)} pp`}
              </small>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

type SegmentAnalysisPanelProps = {
  result: SegmentAnalysisResult | null;
  status: "idle" | "loading" | "ready" | "error";
  dirty: boolean;
  schema: SurveyAnalyticsSchema;
  comparisonCount: number;
  comparisonFull: boolean;
  onAddToComparison: (replaceSlot?: 0 | 1) => void;
  onOpenComparison: () => void;
  onExploreSubgroup?: (field: string, band: SegmentBandKey) => void;
  draftDefinition?: SegmentDefinition | null;
};

function downloadSegmentAnalysisExport(result: SegmentAnalysisResult, schema: SurveyAnalyticsSchema) {
  const file = buildSegmentAnalysisExport({ analysis: result, schema });
  const blob = new Blob([file.body], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SegmentAnalysisPanel({
  result,
  status,
  dirty,
  schema,
  comparisonCount,
  comparisonFull,
  onAddToComparison,
  onOpenComparison,
  onExploreSubgroup,
  draftDefinition,
}: SegmentAnalysisPanelProps) {
  const [showWholeSurvey, setShowWholeSurvey] = useState(false);
  const canExport = canExportSegmentAnalysis(status, dirty, result);

  return (
    <section className={`analytics-v2-panel analytics-v2-seg-result${dirty && result ? " is-stale" : ""}`}>
      <div className="analytics-v2-panel__head">
        <div className="analytics-v2-panel__title">
          <h3>
            Segment Analysis
            <InfoTip text="This view describes the selected responses and, where indicated, compares them with respondents outside the selected segment. Differences are descriptive associations, not causal effects." />
          </h3>
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
              downloadSegmentAnalysisExport(result, schema);
            }}
          >
            Export segment analysis
          </button>
          <button type="button" className="button button--ghost" onClick={onOpenComparison}>
            Comparison {comparisonCount}/2
          </button>
        </div>
      </div>

      {status === "idle" && !result ? (
        <p className="analytics-v2-seg-empty">
          Configure filters in Segment Builder, then analyse the segment. A shared URL preloads filters but does not run
          the analysis.
        </p>
      ) : null}

      {status === "loading" && !result ? <p className="analytics-v2-seg-empty">Analysing the current definition…</p> : null}

      {result ? (
        <>
          {dirty ? (
            <p className="analytics-v2-segment-notice" role="status">
              Filters have changed. The results below describe the last analysed definition. Update the analysis to apply
              the current filters.
            </p>
          ) : null}

          <div className="analytics-v2-seg-identity">
            <div className="analytics-v2-kpi-strip analytics-v2-seg-kpis">
              <article className="analytics-v2-kpi">
                <span>Matched</span>
                <strong>{formatCount(result.sample.selectedN)}</strong>
                <small>of {formatCount(result.sample.analysedN)} analysed</small>
              </article>
              <article className="analytics-v2-kpi">
                <span>Share</span>
                <strong>{formatPercent(result.sample.share)}</strong>
                <small>{dirty ? "Last analysed definition" : "Same base as Overview"}</small>
              </article>
              <article className="analytics-v2-kpi">
                <span>Outside</span>
                <strong>{formatCount(result.sample.outsideN)}</strong>
                <small>Disjoint complement</small>
              </article>
            </div>
            <p className="analytics-v2-seg-identity__meta">
              Generated {formatGeneratedAt(result.generatedAt)} UTC
              {isWholeSampleDefinition(result.definition) ? " · Whole analysed sample" : null}
            </p>
            {result.readableConditions.length > 0 ? (
              <div className="analytics-v2-seg-toolbar__chips">
                {result.readableConditions.map((condition, index) => (
                  <span key={`${condition.field}:${index}`} className="analytics-v2-seg-chip is-active">
                    {condition.label}: {condition.detail}
                  </span>
                ))}
              </div>
            ) : (
              <small>No filters were applied to this analysis.</small>
            )}
          </div>

          {result.sample.selectedN === 0 ? (
            <p className="analytics-v2-seg-empty">
              No responses match the analysed definition. Adjust the filters in Segment Builder and run the analysis
              again.
            </p>
          ) : (
            <>
              <InsightsBlock items={result.insights} />

              <div className="analytics-v2-seg-analysis-block">
                <h4>
                  Profile signature
                  <InfoTip text={PROFILE_TIP} />
                </h4>
                <label className="analytics-v2-seg-toggle">
                  <input
                    type="checkbox"
                    checked={showWholeSurvey}
                    onChange={(event) => setShowWholeSurvey(event.target.checked)}
                  />
                  Show whole-survey context
                </label>
                {showWholeSurvey ? (
                  <small className="analytics-v2-seg-toolbar__hint">
                    The hollow marker is the median of the whole analysed sample, which includes this segment.
                  </small>
                ) : null}
                <DotIqrPlot axes={result.profileAxes} showWholeSurvey={showWholeSurvey} />
                <h4>
                  Visual signature
                  <InfoTip text={RADAR_TIP} />
                </h4>
                <SegmentRadar axes={result.profileAxes} showWholeSurvey={showWholeSurvey} />
              </div>

              <div className="analytics-v2-seg-analysis-block">
                <h4>
                  Semantic-band composition
                  <InfoTip text={BANDS_TIP} />
                </h4>
                <BandBars axes={result.profileAxes} />
              </div>

              <div className="analytics-v2-seg-analysis-block">
                <h4>
                  What differentiates this segment
                  <InfoTip text={DIFF_TIP} />
                </h4>
                {!result.differentiators.available ? (
                  <p className="analytics-v2-seg-empty">
                    {result.differentiators.reason === "whole_sample"
                      ? "Add at least one filter to identify how a segment differs from the rest of the analysed sample."
                      : "The exterior group is empty, so a disjoint comparison is not available."}
                  </p>
                ) : (
                  <>
                    <p className="analytics-v2-seg-identity__meta">Selected segment vs everyone outside this segment.</p>
                    {result.differentiators.scores.length > 0 ? (
                      <ScoreForest items={result.differentiators.scores} />
                    ) : (
                      <p className="analytics-v2-seg-empty">No non-defining scored axes are available to compare.</p>
                    )}
                    {result.differentiators.categories.length > 0 ? (
                      <>
                        <h4>
                          Categorical differences
                          <InfoTip text={CATEGORY_TIP} />
                        </h4>
                        <CategoryBars items={result.differentiators.categories} />
                      </>
                    ) : null}
                  </>
                )}
              </div>

              <FacetSignals items={result.facets} />
              <SupportingFactors items={result.supportingFactors} />
              <InternalVariation
                items={result.internalVariation}
                draftDefinition={draftDefinition}
                onExploreSubgroup={onExploreSubgroup}
              />
              {result.conditionalModules ? <ConditionalModules summary={result.conditionalModules} /> : null}
              <AssetBars items={result.assets} />
              <GeographyBlock items={result.geography} />
              <WeatherBlock items={result.weather} />
              <AssociationsBlock items={result.associations} />
            </>
          )}

          <div className="analytics-v2-seg-compare-wrap analytics-v2-seg-analysis-compare">
            {comparisonFull ? (
              <span className="analytics-v2-seg-replace">
                Replace
                <button type="button" className="analytics-v2-seg-chip" disabled={dirty} onClick={() => onAddToComparison(0)}>
                  A
                </button>
                <button type="button" className="analytics-v2-seg-chip" disabled={dirty} onClick={() => onAddToComparison(1)}>
                  B
                </button>
              </span>
            ) : null}
            <button
              type="button"
              className="analytics-v2-seg-compare"
              disabled={dirty}
              onClick={() => onAddToComparison()}
            >
              Add to comparison
              <span className="analytics-v2-seg-compare__arrow" aria-hidden="true">
                »
              </span>
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
