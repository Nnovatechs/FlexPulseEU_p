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
            rx="8"
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

const COUNTRY_COLOURS = ["#5b9cf6", "#3ab590", "#3ecf7c", "#f5a623", "#e85252"];

function CountryPulsePlot({
  construct,
  countries,
}: {
  construct: NonNullable<SurveyOverviewData["countryPulse"]>["constructs"][number];
  countries: NonNullable<SurveyOverviewData["countryPulse"]>["countries"];
}) {
  const visibleCountries = countries
    .map((country, index) => ({
      country,
      metric: construct.countries.find((entry) => entry.code === country.code)?.metric ?? null,
      colour: COUNTRY_COLOURS[index % COUNTRY_COLOURS.length],
    }))
    .filter(
      (
        entry,
      ): entry is {
        country: (typeof countries)[number];
        metric: NonNullable<(typeof construct.countries)[number]["metric"]>;
        colour: string;
      } => entry.metric != null,
    );

  const scale = (value: number) => 26 + ((value - 1) / 4) * 354;
  const laneGap = 18;
  const topLaneY = 18;
  const overallY = topLaneY;
  const plotHeight = 44 + visibleCountries.length * laneGap;

  return (
    <div className="analytics-v2-country-row">
      <div className="analytics-v2-country-row__label">
        <strong>{construct.label}</strong>
        <span>{`Median ${formatScore(construct.overall.median)} · IQR ${formatScore(construct.overall.q1)}-${formatScore(construct.overall.q3)} · n=${construct.overall.applicableN}`}</span>
      </div>

      <svg viewBox={`0 0 410 ${plotHeight}`} className="analytics-v2-country-row__plot" role="img">
        {[1, 2, 3, 4, 5].map((tick) => (
          <g key={tick}>
            <line
              x1={scale(tick)}
              x2={scale(tick)}
              y1={overallY - 8}
              y2={plotHeight - 20}
              className="analytics-v2-country-row__tick"
            />
            <text x={scale(tick)} y={plotHeight - 6} textAnchor="middle">
              {tick}
            </text>
          </g>
        ))}

        <line
          x1="26"
          x2="380"
          y1={overallY}
          y2={overallY}
          className="analytics-v2-country-row__axis"
        />
        <line
          x1={scale(construct.overall.q1)}
          x2={scale(construct.overall.q3)}
          y1={overallY}
          y2={overallY}
          className="analytics-v2-country-row__range analytics-v2-country-row__range--overall"
        />
        <circle
          cx={scale(construct.overall.median)}
          cy={overallY}
          r="5.8"
          className="analytics-v2-country-row__dot analytics-v2-country-row__dot--overall"
        >
          <title>{`Overall sample · median ${formatScore(construct.overall.median)} · IQR ${formatScore(construct.overall.q1)}-${formatScore(construct.overall.q3)} · n=${construct.overall.applicableN}`}</title>
        </circle>

        {visibleCountries.map((country, index) => {
          const y = overallY + laneGap * (index + 1);
          return (
            <g key={country.country.code}>
              <line
                x1="26"
                x2="380"
                y1={y}
                y2={y}
                className="analytics-v2-country-row__axis analytics-v2-country-row__axis--subtle"
              />
              <line
                x1={scale(country.metric.q1)}
                x2={scale(country.metric.q3)}
                y1={y}
                y2={y}
                className="analytics-v2-country-row__range"
                stroke={country.colour}
              />
              <circle
                cx={scale(country.metric.median)}
                cy={y}
                r="4.9"
                className="analytics-v2-country-row__dot"
                fill={country.colour}
                stroke={country.colour}
              >
                <title>{`${country.country.code} · median ${formatScore(country.metric.median)} · IQR ${formatScore(country.metric.q1)}-${formatScore(country.metric.q3)} · n=${country.metric.applicableN}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>

      <div className="analytics-v2-country-row__legend">
        <span className="analytics-v2-country-row__legend-item is-overall">
          <i className="analytics-v2-country-row__legend-swatch analytics-v2-country-row__legend-swatch--overall" />
          Baseline
        </span>
        {countries.map((country, index) => (
          <span
            key={country.code}
            className={`analytics-v2-country-row__legend-item${!country.detailAvailable ? " is-muted" : ""}`}
          >
            <i
              className="analytics-v2-country-row__legend-swatch"
              style={{
                background: country.detailAvailable
                  ? COUNTRY_COLOURS[index % COUNTRY_COLOURS.length]
                  : "#5f687b",
              }}
            />
            {country.detailAvailable ? `${country.code} · n=${country.count}` : `${country.code} · n=${country.count} hidden`}
          </span>
        ))}
      </div>
    </div>
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

                <article className="analytics-v2-card">
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
                </article>
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
                  <article key={`${insight.title}-${insight.evidence}`} className="analytics-v2-card analytics-v2-card--accent">
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
                <article key={construct.conceptKey} className="analytics-v2-card">
                  <div className="analytics-v2-construct-row">
                    <div className="analytics-v2-construct-row__summary">
                      <h4>{construct.label}</h4>
                      {construct.description ? (
                        <p className="analytics-v2-construct-row__description">
                          {construct.description}
                        </p>
                      ) : null}
                      <p>{`Median ${formatScore(construct.median)} · IQR ${formatScore(construct.q1)}-${formatScore(construct.q3)}`}</p>
                    </div>
                    <span className="analytics-v2-n-badge">{`n=${formatCount(construct.applicableN)}`}</span>
                  </div>

                  <div className="analytics-v2-band-list">
                    {construct.bands.map((band) => (
                      <div key={band.key} className={`analytics-v2-band analytics-v2-band--${band.key}`}>
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
