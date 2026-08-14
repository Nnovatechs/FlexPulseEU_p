"use client";

import { useMemo, useState } from "react";
import type { SurveyOverviewData } from "@/features/surveys/analytics/overview-v2";

type OverviewPanelProps = {
  data: SurveyOverviewData;
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
    return "No response dates yet";
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const start = formatter.format(new Date(data.startAt));
  const end = formatter.format(new Date(data.endAt));
  const scopeLabel =
    data.scope === "collected" ? "all collected responses" : "analysed responses only";

  return `${start} -> ${end} (${scopeLabel})`;
}

function countrySummary(countries: SurveyOverviewData["context"]["countries"]) {
  if (countries.length === 0) {
    return "No analysed country data";
  }

  return countries.map((country) => `${country.code} (${country.count})`).join(" · ");
}

type OpportunityQuadrantKey =
  SurveyOverviewData["opportunity"]["viewsByDfcKey"][string]["quadrants"][number]["key"];

function getCellQuadrantKey(capability: number, willingness: number): OpportunityQuadrantKey {
  if (willingness >= 4 && capability >= 4) {
    return "high_willingness_high_capability";
  }

  if (willingness >= 4 && capability < 4) {
    return "high_willingness_limited_capability";
  }

  if (willingness < 4 && capability >= 4) {
    return "lower_willingness_high_capability";
  }

  return "lower_immediate_fit";
}

function BubblePlot({
  view,
  hoveredQuadrant,
}: {
  view: SurveyOverviewData["opportunity"]["viewsByDfcKey"][string];
  hoveredQuadrant: OpportunityQuadrantKey | null;
}) {
  const maxCount = Math.max(...view.distributionCells.map((cell) => cell.count), 1);
  const plotLeft = 44;
  const plotTop = 28;
  const plotSize = 264;
  const plotCenterX = plotLeft + plotSize / 2;
  const plotCenterY = plotTop + plotSize / 2;
  const scale = (value: number) => plotLeft + ((value - 1) / 4) * plotSize;
  const yScale = (value: number) => plotTop + plotSize - ((value - 1) / 4) * plotSize;

  return (
    <div className="analytics-v2-plot-card">
      <div className="analytics-v2-plot-card__header">
        <h4>{`Willingness x ${view.label === "Overall DFC" ? "Overall DFC" : `${view.label} capability`}`}</h4>
      </div>

      <div className={`analytics-v2-bubble-plot${hoveredQuadrant ? " is-highlighting" : ""}`}>
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
                className={`analytics-v2-bubble-plot__grid${tick === 4 ? " is-strong" : tick === 2 ? " is-soft" : ""}`}
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
                className={`analytics-v2-bubble-plot__grid${tick === 4 ? " is-strong" : tick === 2 ? " is-soft" : ""}`}
              />
              <text x="30" y={yScale(tick) + 4} textAnchor="middle">
                {tick}
              </text>
            </g>
          ))}

          {view.distributionCells.map((cell) => {
            const radius = 3.4 + ((cell.count - 1) / Math.max(maxCount - 1, 1)) * 3.8;
            const quadrantKey = getCellQuadrantKey(cell.x, cell.y);
            const isLit = hoveredQuadrant === quadrantKey;
            return (
              <circle
                key={`${cell.x}-${cell.y}`}
                cx={scale(cell.x)}
                cy={yScale(cell.y)}
                r={isLit ? radius + 1.2 : radius}
                className={`analytics-v2-bubble-plot__bubble${isLit ? " is-lit" : ""}`}
              >
                <title>{`${view.xLabel}: ${formatScore(cell.x)} · Willingness: ${formatScore(cell.y)} · n=${cell.count} · ${formatPercent(cell.share)} of applicable responses`}</title>
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
            Flexibility willingness
          </text>
          <text x={plotCenterX} y="319" textAnchor="middle" className="analytics-v2-bubble-plot__axis-title">
            {view.xLabel}
          </text>
        </svg>
      </div>
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

export function OverviewPanel({ data }: OverviewPanelProps) {
  const [selectedDfcKey, setSelectedDfcKey] = useState(data.opportunity.defaultDfcKey);
  const [hoveredQuadrant, setHoveredQuadrant] = useState<OpportunityQuadrantKey | null>(null);

  const selectedView = useMemo(
    () =>
      data.opportunity.viewsByDfcKey[selectedDfcKey] ??
      data.opportunity.viewsByDfcKey[data.opportunity.defaultDfcKey],
    [data.opportunity.defaultDfcKey, data.opportunity.viewsByDfcKey, selectedDfcKey],
  );

  return (
    <div className="analytics-v2-overview">
      <section className="analytics-v2-section analytics-v2-section--context">
        <div className="analytics-v2-section__heading">
          <h3>Survey context</h3>
          <span className="analytics-v2-section__badge">{data.context.sampleLabel}</span>
        </div>

        <div className="analytics-v2-context-grid">
          <article className="analytics-v2-stat-card">
            <span>Responses analysed</span>
            <strong>{formatCount(data.context.analysedResponseCount)}</strong>
          </article>
          <article className="analytics-v2-stat-card">
            <span>Countries analysed</span>
            <strong>{countrySummary(data.context.countries)}</strong>
          </article>
          <article className="analytics-v2-stat-card">
            <span>Collection period</span>
            <strong>{formatDateRange(data.context.dateRange)}</strong>
          </article>
          <article className="analytics-v2-stat-card">
            <span>Mapping coverage</span>
            <strong>
              {data.context.mappingCoverage
                ? `${formatCount(data.context.mappingCoverage.analysed)} of ${formatCount(data.context.mappingCoverage.collected)} collected responses available for analysis`
                : "No collected responses yet"}
            </strong>
          </article>
          <article className="analytics-v2-stat-card">
            <span>Survey status</span>
            <strong>{data.context.surveyStatus}</strong>
          </article>
          <article className="analytics-v2-stat-card">
            <span>Sample framing</span>
            <strong>{data.context.sampleLabel}</strong>
          </article>
        </div>
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
          <section className="analytics-v2-section">
            <div className="analytics-v2-section__heading">
              <h3>Flexibility opportunity snapshot</h3>
            </div>

            <div className="analytics-v2-dfc-selector">
              {data.opportunity.dfcOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`analytics-v2-dfc-selector__button${selectedDfcKey === option.key ? " is-active" : ""}`}
                  disabled={!option.detailAvailable}
                  onClick={() => setSelectedDfcKey(option.key)}
                >
                  <span>{option.label}</span>
                  <small>{`Applicable n=${formatCount(option.applicableN)}`}</small>
                </button>
              ))}
            </div>

            {!selectedView.detailAvailable ? (
              <div className="analytics-v2-empty-card analytics-v2-empty-card--inline">
                <h3>No applicable declared flexibility capability data are available for this sample.</h3>
                <p>
                  This module does not currently meet the privacy threshold for detailed
                  visualisation. The selector remains visible so you can inspect applicability.
                </p>
              </div>
            ) : (
              <div className="analytics-v2-opportunity-grid">
                <BubblePlot view={selectedView} hoveredQuadrant={hoveredQuadrant} />

                <div className="analytics-v2-matrix-wrap">
                  <h4>Operational groups</h4>
                  <div className="analytics-v2-matrix">
                    <div className="analytics-v2-matrix__corner" />
                    <div className="analytics-v2-matrix__axis analytics-v2-matrix__axis--column">
                      {"Capability >= 4"}
                    </div>
                    <div className="analytics-v2-matrix__axis analytics-v2-matrix__axis--column">
                      Capability &lt; 4
                    </div>

                    <div className="analytics-v2-matrix__axis analytics-v2-matrix__axis--row">
                      Willingness &gt;= 4
                    </div>
                    {selectedView.quadrants
                      .filter((quadrant) =>
                        [
                          "high_willingness_high_capability",
                          "high_willingness_limited_capability",
                        ].includes(quadrant.key),
                      )
                      .map((quadrant) => (
                        <button
                          key={quadrant.key}
                          type="button"
                          className={`analytics-v2-matrix__cell${hoveredQuadrant === quadrant.key ? " is-hot" : ""}`}
                          onMouseEnter={() => setHoveredQuadrant(quadrant.key)}
                          onMouseLeave={() => setHoveredQuadrant(null)}
                          onFocus={() => setHoveredQuadrant(quadrant.key)}
                          onBlur={() => setHoveredQuadrant(null)}
                        >
                          <strong>{quadrant.label}</strong>
                          <span>{`${formatPercent(quadrant.share)} · n=${formatCount(quadrant.count)}`}</span>
                        </button>
                      ))}

                    <div className="analytics-v2-matrix__axis analytics-v2-matrix__axis--row">
                      Willingness &lt; 4
                    </div>
                    {selectedView.quadrants
                      .filter((quadrant) =>
                        [
                          "lower_willingness_high_capability",
                          "lower_immediate_fit",
                        ].includes(quadrant.key),
                      )
                      .map((quadrant) => (
                        <button
                          key={quadrant.key}
                          type="button"
                          className={`analytics-v2-matrix__cell${hoveredQuadrant === quadrant.key ? " is-hot" : ""}`}
                          onMouseEnter={() => setHoveredQuadrant(quadrant.key)}
                          onMouseLeave={() => setHoveredQuadrant(null)}
                          onFocus={() => setHoveredQuadrant(quadrant.key)}
                          onBlur={() => setHoveredQuadrant(null)}
                        >
                          <strong>{quadrant.label}</strong>
                          <span>{`${formatPercent(quadrant.share)} · n=${formatCount(quadrant.count)}`}</span>
                        </button>
                      ))}
                    </div>
                </div>
              </div>
            )}
          </section>

          {data.insights.length > 0 ? (
            <section className="analytics-v2-section">
              <div className="analytics-v2-section__heading">
                <h3>What stands out</h3>
              </div>

              <div className="analytics-v2-insights-grid">
                {data.insights.map((insight) => (
                  <article key={`${insight.title}-${insight.evidence}`} className="analytics-v2-insight">
                    <h4>{insight.title}</h4>
                    <p>{insight.body}</p>
                    <small>{insight.evidence}</small>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="analytics-v2-section">
            <div className="analytics-v2-section__heading">
              <h3>Construct profile</h3>
            </div>

            <div className="analytics-v2-construct-list">
              {data.constructs.map((construct) => (
                <article key={construct.conceptKey} className="analytics-v2-construct">
                  <div className="analytics-v2-construct-row">
                    <div className="analytics-v2-construct-row__summary">
                      <div className="analytics-v2-construct-row__title">
                        <h4>{construct.label}</h4>
                        <span className="analytics-v2-n-badge">{`n=${formatCount(construct.applicableN)}`}</span>
                      </div>
                      {construct.description ? (
                        <p className="analytics-v2-construct-row__description">
                          {construct.description}
                        </p>
                      ) : null}
                      <p className="analytics-v2-construct-row__stats">
                        {`Median ${formatScore(construct.median)}`}
                        <span>IQR {formatScore(construct.q1)}–{formatScore(construct.q3)}</span>
                      </p>
                    </div>
                  </div>

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
                  <div className="analytics-v2-stack__legend">
                    {construct.bands.map((band) => (
                      <div key={band.key} className={`analytics-v2-stack__item analytics-v2-stack__item--${band.key}`}>
                        <strong>{band.label}</strong>
                        <span>{`${formatPercent(band.share)} · n=${formatCount(band.count)}`}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {data.countryPulse ? (
            <section className="analytics-v2-section">
              <div className="analytics-v2-section__heading">
                <h3>Country pulse</h3>
              </div>

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
