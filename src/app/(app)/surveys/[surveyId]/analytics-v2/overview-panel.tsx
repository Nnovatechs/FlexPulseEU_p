"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { OVERVIEW_SECTION_INTROS } from "@/features/surveys/analytics/overview-v2-insights";
import { InfoTip } from "./info-tip";
import type {
  OverviewGroupProfile,
  OverviewOpportunityView,
  SurveyOverviewData,
} from "@/features/surveys/analytics/overview-v2";
import {
  OVERVIEW_PROFILE_COMPARISON_MIN_N,
  OVERVIEW_VISUALISATION_MIN_N,
} from "@/features/surveys/analytics/overview-v2-policy";
import type { QuadrantSlot } from "@/features/surveys/analytics/overview-view-registry";
import {
  buildRadarGridPolygon,
  buildRadarPolygon,
  polarPoint,
} from "@/features/surveys/analytics/profile-explorer-utils";

type OverviewPanelProps = {
  data: SurveyOverviewData;
};

const QUADRANT_SERIES: Record<QuadrantSlot, { color: string; fill: string }> = {
  highHigh: { color: "#6ea8fe", fill: "rgba(110, 168, 254, 0.16)" },
  highLow: { color: "#3dcdb4", fill: "rgba(61, 205, 180, 0.14)" },
  lowHigh: { color: "#c58b4b", fill: "rgba(197, 139, 75, 0.16)" },
  lowLow: { color: "#b877d9", fill: "rgba(184, 119, 217, 0.16)" },
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function formatScore(value: number) {
  return value.toFixed(2);
}

function formatDateRange(data: SurveyOverviewData["context"]["dateRange"]) {
  if (!data?.startAt || !data.endAt) {
    return { value: "No dates yet", caption: "No response dates yet" };
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const start = formatter.format(new Date(data.startAt));
  const end = formatter.format(new Date(data.endAt));
  const caption =
    data.scope === "collected" ? "All collected responses" : "Analysed responses only";

  return { value: `${start} – ${end}`, caption };
}

function countrySummary(countries: SurveyOverviewData["context"]["countries"]) {
  if (countries.length === 0) {
    return "No analysed country data";
  }

  return countries.map((country) => `${country.code} (${country.count})`).join(" · ");
}

function seriesForQuadrant(view: OverviewOpportunityView, quadrantKey: string) {
  const slot = view.quadrants.find((quadrant) => quadrant.key === quadrantKey)?.slot ?? "highHigh";
  return QUADRANT_SERIES[slot];
}

function BubblePlot({
  view,
  hoveredQuadrant,
  selectedQuadrants,
}: {
  view: OverviewOpportunityView;
  hoveredQuadrant: string | null;
  selectedQuadrants: string[];
}) {
  const maxCount = Math.max(...view.distributionCells.map((cell) => cell.count), 1);
  const plotLeft = 44;
  const plotTop = 28;
  const plotSize = 264;
  const plotCenterX = plotLeft + plotSize / 2;
  const plotCenterY = plotTop + plotSize / 2;
  const scale = (value: number) => plotLeft + ((value - 1) / 4) * plotSize;
  const yScale = (value: number) => plotTop + plotSize - ((value - 1) / 4) * plotSize;
  const isHighlighting = hoveredQuadrant != null || selectedQuadrants.length > 0;

  return (
    <div className="analytics-v2-plot-card">
      <div className="analytics-v2-plot-card__header">
        <h4>{`${view.yLabel} x ${view.xLabel}`}</h4>
      </div>

      <div className={`analytics-v2-bubble-plot${isHighlighting ? " is-highlighting" : ""}`}>
        <svg viewBox="0 0 336 320" role="img" aria-label={`${view.label} opportunity plot`}>
          <rect
            x={plotLeft}
            y={plotTop}
            width={plotSize}
            height={plotSize}
            className="analytics-v2-bubble-plot__frame"
          />

          {[1, 2, 3, 4, 5].map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={scale(tick)}
                x2={scale(tick)}
                y1={plotTop}
                y2={plotTop + plotSize}
                className={`analytics-v2-bubble-plot__grid${tick === view.xCutoff ? " is-strong" : tick === 2 ? " is-soft" : ""}`}
              />
              <text x={scale(tick)} y="310" textAnchor="middle">
                {tick}
              </text>
            </g>
          ))}

          {[1, 2, 3, 4, 5].map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={plotLeft}
                x2={plotLeft + plotSize}
                y1={yScale(tick)}
                y2={yScale(tick)}
                className={`analytics-v2-bubble-plot__grid${tick === view.yCutoff ? " is-strong" : tick === 2 ? " is-soft" : ""}`}
              />
              <text x="30" y={yScale(tick) + 4} textAnchor="middle">
                {tick}
              </text>
            </g>
          ))}

          {view.distributionCells.map((cell) => {
            const radius = 3.4 + ((cell.count - 1) / Math.max(maxCount - 1, 1)) * 3.8;
            const isLit =
              selectedQuadrants.includes(cell.quadrantKey) || hoveredQuadrant === cell.quadrantKey;
            const color = seriesForQuadrant(view, cell.quadrantKey).color;
            return (
              <circle
                key={`${cell.x}-${cell.y}`}
                cx={scale(cell.x)}
                cy={yScale(cell.y)}
                r={isLit ? radius + 1.2 : radius}
                className={`analytics-v2-bubble-plot__bubble${isLit ? " is-lit" : ""}`}
                style={isLit ? { fill: color } : undefined}
              >
                <title>{`${view.xLabel}: ${formatScore(cell.x)} · ${view.yLabel}: ${formatScore(cell.y)} · n=${cell.count} · ${formatPercent(cell.share)} of applicable responses`}</title>
              </circle>
            );
          })}

          <text
            x="12"
            y={plotCenterY}
            textAnchor="middle"
            className="analytics-v2-bubble-plot__axis-title"
            transform={`rotate(-90 12 ${plotCenterY})`}
          >
            {view.yLabel}
          </text>
          <text x={plotCenterX} y="319" textAnchor="middle" className="analytics-v2-bubble-plot__axis-title">
            {view.xLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}

function OpportunityGroupRadar({
  view,
  selectedQuadrants,
}: {
  view: OverviewOpportunityView;
  selectedQuadrants: string[];
}) {
  const selectedGroups = selectedQuadrants
    .map((key) => {
      const quadrant = view.quadrants.find((entry) => entry.key === key);
      const profile = view.groupProfiles[key];
      if (!quadrant || !profile) {
        return null;
      }

      return { key, quadrant, profile, series: QUADRANT_SERIES[quadrant.slot] };
    })
    .filter(
      (
        entry,
      ): entry is {
        key: string;
        quadrant: OverviewOpportunityView["quadrants"][number];
        profile: OverviewGroupProfile;
        series: (typeof QUADRANT_SERIES)[QuadrantSlot];
      } => entry != null,
    );

  const plottable = selectedGroups.filter(
    (entry) => entry.profile.detailAvailable && entry.profile.axes.length >= 3,
  );
  const withheld = selectedGroups.filter((entry) => !entry.profile.detailAvailable);
  const missingAxes = selectedGroups.filter(
    (entry) => entry.profile.detailAvailable && entry.profile.axes.length < 3,
  );
  const sharedAxes =
    plottable.length === 0
      ? []
      : plottable[0].profile.axes.filter((axis) =>
          plottable.every((entry) =>
            entry.profile.axes.some((candidate) => candidate.conceptKey === axis.conceptKey),
          ),
        );

  if (plottable.length === 0) {
    if (withheld.length > 0) {
      return (
        <p>
          {`Group profiles are withheld when n is smaller than ${OVERVIEW_PROFILE_COMPARISON_MIN_N}, because they would expose too many attributes of a few respondents.`}
        </p>
      );
    }

    return <p>Not enough additional profile axes are available for visual comparison.</p>;
  }

  if (sharedAxes.length < 3) {
    return <p>Not enough shared profile axes are available for visual comparison.</p>;
  }

  const cx = 168;
  const cy = 160;
  const radius = 108;
  const axisCount = sharedAxes.length;
  const accessibleSummary = plottable
    .map((entry) => {
      const axisText = sharedAxes
        .map((axis) => {
          const value = entry.profile.axes.find((candidate) => candidate.conceptKey === axis.conceptKey);
          return value
            ? `${axis.label} median ${formatScore(value.median)} n=${formatCount(value.n)}`
            : null;
        })
        .filter((value): value is string => value != null)
        .join(", ");
      return `${entry.quadrant.label} n=${formatCount(entry.profile.n)}: ${axisText}`;
    })
    .join(". ");

  return (
    <div className="analytics-v2-radar">
      <svg
        viewBox="0 0 336 320"
        role="img"
        aria-label={`Selected operational group profiles. ${accessibleSummary}`}
      >
        {[0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={buildRadarGridPolygon(axisCount, cx, cy, radius * ratio)}
            className="analytics-v2-radar__grid"
          />
        ))}
        {sharedAxes.map((axis, index) => {
          const angle = -Math.PI / 2 + (index / axisCount) * Math.PI * 2;
          const end = polarPoint(cx, cy, radius, angle);
          const labelPoint = polarPoint(cx, cy, radius + 22, angle);
          return (
            <g key={axis.conceptKey}>
              <line x1={cx} y1={cy} x2={end.x} y2={end.y} className="analytics-v2-radar__axis" />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="analytics-v2-radar__label"
              >
                {axis.shortLabel}
              </text>
              <title>{axis.label}</title>
            </g>
          );
        })}
        {plottable.map((entry) => {
          const values = sharedAxes.map((axis) => {
            const match = entry.profile.axes.find((candidate) => candidate.conceptKey === axis.conceptKey);
            return match?.median ?? 1;
          });
          return (
            <polygon
              key={entry.key}
              points={buildRadarPolygon(values, cx, cy, radius)}
              className="analytics-v2-radar__series"
              style={{ fill: entry.series.fill, stroke: entry.series.color }}
            />
          );
        })}
      </svg>
      {withheld.length > 0 || missingAxes.length > 0 ? (
        <p>
          {withheld.length > 0
            ? `${withheld.map((entry) => entry.quadrant.label).join(", ")} withheld for small n.`
            : `${missingAxes.map((entry) => entry.quadrant.label).join(", ")} do not have enough additional profile axes.`}
        </p>
      ) : null}
    </div>
  );
}

const PULSE_COLOURS = ["#6ea8fe", "#3dcdb4", "#c58b4b", "#b877d9", "#7ad3f7"];

function pulsePosition(value: number) {
  return `${((Math.min(5, Math.max(1, value)) - 1) / 4) * 100}%`;
}

function CountryPulsePlot({
  construct,
  countries,
}: {
  construct: NonNullable<SurveyOverviewData["countryPulse"]>["constructs"][number];
  countries: NonNullable<SurveyOverviewData["countryPulse"]>["countries"];
}) {
  const visibleCountries = countries
    .map((country, index) => ({
      code: country.code,
      metric: construct.countries.find((entry) => entry.code === country.code)?.metric ?? null,
      colour: PULSE_COLOURS[index % PULSE_COLOURS.length],
    }))
    .filter(
      (
        entry,
      ): entry is {
        code: string;
        metric: NonNullable<(typeof construct.countries)[number]["metric"]>;
        colour: string;
      } => entry.metric != null,
    );

  const rows = [
    {
      code: "ALL",
      colour: "#c5cddb",
      metric: construct.overall,
      baseline: true,
    },
    ...visibleCountries.map((country) => ({
      code: country.code,
      colour: country.colour,
      metric: country.metric,
      baseline: false,
    })),
  ];

  return (
    <article className="analytics-v2-pulse">
      <header className="analytics-v2-pulse__head">
        <h4>{construct.label}</h4>
        <dl className="analytics-v2-pulse__kpis">
          <div>
            <dt>Median</dt>
            <dd>{formatScore(construct.overall.median)}</dd>
          </div>
          <div>
            <dt>IQR</dt>
            <dd>{`${formatScore(construct.overall.q1)}–${formatScore(construct.overall.q3)}`}</dd>
          </div>
          <div>
            <dt>n</dt>
            <dd>{formatCount(construct.overall.applicableN)}</dd>
          </div>
        </dl>
      </header>

      <div className="analytics-v2-pulse__row analytics-v2-pulse__row--axis" aria-hidden="true">
        <span />
        <div className="analytics-v2-pulse__track analytics-v2-pulse__track--axis">
          {[1, 2, 3, 4, 5].map((tick) => (
            <span key={tick} className="analytics-v2-pulse__axis-tick" style={{ left: pulsePosition(tick) }}>
              {tick}
            </span>
          ))}
        </div>
        <span className="analytics-v2-pulse__value">Med</span>
        <span className="analytics-v2-pulse__n">n</span>
      </div>

      {rows.map((row) => {
        const iqrLeft = pulsePosition(row.metric.q1);
        const iqrWidth = `${Math.max(((row.metric.q3 - row.metric.q1) / 4) * 100, 1.2)}%`;
        return (
          <div
            key={row.code}
            className={`analytics-v2-pulse__row${row.baseline ? " is-baseline" : ""}`}
          >
            <span className="analytics-v2-pulse__code">{row.code}</span>
            <div className="analytics-v2-pulse__track">
              {[2, 3, 4].map((tick) => (
                <span
                  key={tick}
                  className={`analytics-v2-pulse__grid${tick === 4 ? " is-strong" : ""}`}
                  style={{ left: pulsePosition(tick) }}
                />
              ))}
              <span
                className="analytics-v2-pulse__iqr"
                style={{ left: iqrLeft, width: iqrWidth, background: row.colour }}
              />
              <span
                className="analytics-v2-pulse__median"
                style={{ left: pulsePosition(row.metric.median), background: row.colour }}
              />
            </div>
            <span className="analytics-v2-pulse__value">{formatScore(row.metric.median)}</span>
            <span className="analytics-v2-pulse__n">{formatCount(row.metric.applicableN)}</span>
          </div>
        );
      })}
    </article>
  );
}

function MatrixCell({
  quadrant,
  view,
  hoveredQuadrant,
  selectedQuadrants,
  onHover,
  onToggle,
}: {
  quadrant: OverviewOpportunityView["quadrants"][number];
  view: OverviewOpportunityView;
  hoveredQuadrant: string | null;
  selectedQuadrants: string[];
  onHover: (key: string | null) => void;
  onToggle: (key: string) => void;
}) {
  const selected = selectedQuadrants.includes(quadrant.key);
  const color = seriesForQuadrant(view, quadrant.key).color;

  return (
    <button
      type="button"
      className={`analytics-v2-matrix__cell${hoveredQuadrant === quadrant.key ? " is-hot" : ""}${selected ? " is-selected" : ""}`}
      style={{ "--group-color": color } as CSSProperties}
      aria-pressed={selected}
      onMouseEnter={() => onHover(quadrant.key)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(quadrant.key)}
      onBlur={() => onHover(null)}
      onClick={() => onToggle(quadrant.key)}
    >
      <strong>{quadrant.label}</strong>
      <span>{`${formatPercent(quadrant.share)} · n=${formatCount(quadrant.count)}`}</span>
    </button>
  );
}

export function OverviewPanel({ data }: OverviewPanelProps) {
  const opportunity = data.opportunity;
  const [selectedOptionKey, setSelectedOptionKey] = useState(opportunity?.defaultOptionKey ?? "");
  const [hoveredQuadrant, setHoveredQuadrant] = useState<string | null>(null);
  const [selectedQuadrants, setSelectedQuadrants] = useState<string[]>([]);

  const selectedView = useMemo(() => {
    if (!opportunity) {
      return null;
    }

    return (
      opportunity.viewsByOptionKey[selectedOptionKey] ??
      opportunity.viewsByOptionKey[opportunity.defaultOptionKey]
    );
  }, [opportunity, selectedOptionKey]);

  const dateRange = formatDateRange(data.context.dateRange);

  function selectOption(optionKey: string) {
    setSelectedOptionKey(optionKey);
    setSelectedQuadrants([]);
    setHoveredQuadrant(null);
  }

  function toggleQuadrant(quadrantKey: string) {
    setSelectedQuadrants((current) =>
      current.includes(quadrantKey)
        ? current.filter((key) => key !== quadrantKey)
        : [...current, quadrantKey],
    );
  }

  return (
    <div className="analytics-v2-overview">
      <section className="analytics-v2-kpi-strip" aria-label="Survey context">
        <article className="analytics-v2-kpi">
          <span>Responses</span>
          <strong>{formatCount(data.context.analysedResponseCount)}</strong>
          <small>{data.context.sampleLabel}</small>
        </article>
        <article className="analytics-v2-kpi">
          <span>Countries</span>
          <strong>{formatCount(data.context.countries.length)}</strong>
          <small>{countrySummary(data.context.countries)}</small>
        </article>
        <article className="analytics-v2-kpi">
          <span>Collection</span>
          <strong>{dateRange.value}</strong>
          <small>{dateRange.caption}</small>
        </article>
        <article className="analytics-v2-kpi">
          <span>Coverage</span>
          <strong>
            {data.context.mappingCoverage
              ? `${formatCount(data.context.mappingCoverage.analysed)} / ${formatCount(data.context.mappingCoverage.collected)}`
              : "—"}
          </strong>
          <small>
            {data.context.mappingCoverage
              ? `${data.context.surveyStatus} · analysed of collected`
              : data.context.surveyStatus}
          </small>
        </article>
      </section>

      {!data.state.hasCollectedResponses ? (
        <section className="analytics-v2-empty-card">
          <h3>No analysed responses yet.</h3>
          <p>The survey exists, but no collected responses are available for analysis yet.</p>
        </section>
      ) : !data.state.hasAnalysedResponses ? (
        <section className="analytics-v2-empty-card">
          <h3>No analysed responses yet.</h3>
          <p>
            Responses have been collected, but none are available for analysis yet. The overview
            will populate once mapping is ready.
          </p>
        </section>
      ) : (
        <>
          <section className="analytics-v2-panel">
            <header className="analytics-v2-panel__head">
              <h3>
                What stands out
                <InfoTip text={OVERVIEW_SECTION_INTROS.whatStandsOut} />
              </h3>
            </header>
            {data.insights.length > 0 ? (
              <div className="analytics-v2-insights-grid">
                {data.insights.map((insight) => (
                  <article key={`${insight.family}:${insight.title}`} className="analytics-v2-insight">
                    <h4>{insight.title}</h4>
                    <p className="analytics-v2-insight__layer">
                      <span>Statistical signal</span>
                      {insight.statisticalSignal}
                    </p>
                    {insight.meaning ? (
                      <p className="analytics-v2-insight__layer">
                        <span>What this may mean</span>
                        {insight.meaning}
                      </p>
                    ) : null}
                    {insight.decisionHypothesis ? (
                      <p className="analytics-v2-insight__layer">
                        <span>Decision hypothesis</span>
                        {insight.decisionHypothesis}
                      </p>
                    ) : null}
                    {insight.alternativeExplanation ? (
                      <p className="analytics-v2-insight__layer">
                        <span>Also consider</span>
                        {insight.alternativeExplanation}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="analytics-v2-insight-empty">
                No standout signals met the selection rules for this sample. Construct distributions
                are shown below.
              </p>
            )}
          </section>

          {opportunity && selectedView ? (
            <section className="analytics-v2-panel">
              <header className="analytics-v2-panel__head">
                <h3>
                  {opportunity.title}
                  <InfoTip text={OVERVIEW_SECTION_INTROS.flexibilityOpportunity} />
                </h3>
              </header>
              <div className="analytics-v2-dfc-selector">
                {opportunity.options.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`analytics-v2-dfc-selector__button${selectedOptionKey === option.key ? " is-active" : ""}`}
                    disabled={option.applicableN < OVERVIEW_VISUALISATION_MIN_N}
                    onClick={() => selectOption(option.key)}
                  >
                    <span>{option.label}</span>
                    <small>{`n=${formatCount(option.applicableN)}`}</small>
                  </button>
                ))}
              </div>

              {selectedView.applicableN < OVERVIEW_VISUALISATION_MIN_N ? (
                <div className="analytics-v2-empty-card analytics-v2-empty-card--inline">
                  <h3>No applicable capability data are available for this sample.</h3>
                  <p>
                    This module has no applicable responses in the current sample. The selector
                    remains visible so you can inspect applicability.
                  </p>
                </div>
              ) : (
                <div className="analytics-v2-opportunity-grid">
                  <BubblePlot
                    view={selectedView}
                    hoveredQuadrant={hoveredQuadrant}
                    selectedQuadrants={selectedQuadrants}
                  />

                  <div className="analytics-v2-opportunity-stack">
                    <div className="analytics-v2-matrix-wrap">
                      <div className="analytics-v2-matrix-wrap__head">
                        <h4>Operational groups</h4>
                        {selectedQuadrants.length > 0 ? (
                          <button
                            type="button"
                            className="analytics-v2-health-generate"
                            onClick={() => setSelectedQuadrants([])}
                          >
                            Clear selection
                          </button>
                        ) : null}
                      </div>
                      <div className="analytics-v2-matrix">
                        <div className="analytics-v2-matrix__corner" />
                        <div className="analytics-v2-matrix__axis analytics-v2-matrix__axis--column">
                          {`${selectedView.xLabel} >= ${selectedView.xCutoff}`}
                        </div>
                        <div className="analytics-v2-matrix__axis analytics-v2-matrix__axis--column">
                          {`${selectedView.xLabel} < ${selectedView.xCutoff}`}
                        </div>

                        <div className="analytics-v2-matrix__axis analytics-v2-matrix__axis--row">
                          {`${selectedView.yLabel} >= ${selectedView.yCutoff}`}
                        </div>
                        {selectedView.quadrants
                          .filter((quadrant) => quadrant.slot === "highHigh" || quadrant.slot === "highLow")
                          .map((quadrant) => (
                            <MatrixCell
                              key={quadrant.key}
                              quadrant={quadrant}
                              view={selectedView}
                              hoveredQuadrant={hoveredQuadrant}
                              selectedQuadrants={selectedQuadrants}
                              onHover={setHoveredQuadrant}
                              onToggle={toggleQuadrant}
                            />
                          ))}

                        <div className="analytics-v2-matrix__axis analytics-v2-matrix__axis--row">
                          {`${selectedView.yLabel} < ${selectedView.yCutoff}`}
                        </div>
                        {selectedView.quadrants
                          .filter((quadrant) => quadrant.slot === "lowHigh" || quadrant.slot === "lowLow")
                          .map((quadrant) => (
                            <MatrixCell
                              key={quadrant.key}
                              quadrant={quadrant}
                              view={selectedView}
                              hoveredQuadrant={hoveredQuadrant}
                              selectedQuadrants={selectedQuadrants}
                              onHover={setHoveredQuadrant}
                              onToggle={toggleQuadrant}
                            />
                          ))}
                      </div>
                    </div>

                    {selectedQuadrants.length > 0 ? (
                      <OpportunityGroupRadar
                        view={selectedView}
                        selectedQuadrants={selectedQuadrants}
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </section>
          ) : null}

          <section className="analytics-v2-panel">
            <header className="analytics-v2-panel__head">
              <h3>
                Construct profile
                <InfoTip text={OVERVIEW_SECTION_INTROS.constructProfile} />
              </h3>
            </header>

            <div className="analytics-v2-construct-table">
              <div className="analytics-v2-construct-table__head">
                <span>Construct</span>
                <span>Median</span>
                <span>IQR</span>
                <span>Band mix</span>
                <span>n</span>
              </div>
              {data.constructs.map((construct) => (
                <div key={construct.conceptKey} className="analytics-v2-construct-table__row">
                  <strong title={construct.description ?? undefined}>{construct.label}</strong>
                  <span className="analytics-v2-construct-table__num">{formatScore(construct.median)}</span>
                  <span className="analytics-v2-construct-table__iqr">
                    {formatScore(construct.q1)}–{formatScore(construct.q3)}
                  </span>
                  <div className="analytics-v2-construct-table__mix">
                    <div className="analytics-v2-stack" aria-hidden="true">
                      {construct.bands.map((band) =>
                        band.share > 0 ? (
                          <span
                            key={band.key}
                            className={`analytics-v2-stack__seg analytics-v2-stack__seg--${band.key}`}
                            style={{ width: `${Math.max(band.share * 100, 1.5)}%` }}
                          />
                        ) : null,
                      )}
                    </div>
                    <small>
                      {construct.bands
                        .map((band) => `${formatPercent(band.share)} ${band.label}`)
                        .join(" · ")}
                    </small>
                  </div>
                  <span className="analytics-v2-construct-table__n">{formatCount(construct.applicableN)}</span>
                </div>
              ))}
            </div>
          </section>

          {data.countryPulse ? (
            <section className="analytics-v2-panel">
              <header className="analytics-v2-panel__head">
                <h3>
                  Country pulse
                  <InfoTip text={OVERVIEW_SECTION_INTROS.countryPulse} />
                </h3>
              </header>

              <div className="analytics-v2-country-list">
                {data.countryPulse.constructs.map((construct) => (
                  <CountryPulsePlot
                    key={construct.conceptKey}
                    construct={construct}
                    countries={data.countryPulse!.countries}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
