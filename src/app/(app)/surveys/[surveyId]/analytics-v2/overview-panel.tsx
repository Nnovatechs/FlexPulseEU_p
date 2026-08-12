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

function BubblePlot({
  view,
}: {
  view: SurveyOverviewData["opportunity"]["viewsByDfcKey"][string];
}) {
  const maxCount = Math.max(...view.distributionCells.map((cell) => cell.count), 1);

  const scale = (value: number) => 28 + ((value - 1) / 4) * 264;
  const yScale = (value: number) => 292 - ((value - 1) / 4) * 264;

  return (
    <div className="analytics-v2-plot-card">
      <div className="analytics-v2-plot-card__header">
        <div>
          <h4>{`Willingness x ${view.label === "Overall DFC" ? "Overall DFC" : `${view.label} capability`}`}</h4>
          <p>Applicable responses only. Bubble size reflects grouped response counts.</p>
        </div>
        <div className="analytics-v2-plot-card__meta">
          <span>{`Applicable n=${formatCount(view.applicableN)}`}</span>
          <span>{`Not applicable n=${formatCount(view.notApplicableN)}`}</span>
          {view.missingWillingnessN > 0 ? (
            <span>{`Missing willingness n=${formatCount(view.missingWillingnessN)}`}</span>
          ) : null}
        </div>
      </div>

      <div className="analytics-v2-bubble-plot">
        <svg viewBox="0 0 320 320" role="img" aria-label={`${view.label} opportunity plot`}>
          <rect x="28" y="28" width="264" height="264" rx="8" className="analytics-v2-bubble-plot__frame" />

          {[1, 2, 3, 4, 5].map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={scale(tick)}
                x2={scale(tick)}
                y1="28"
                y2="292"
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
                x1="28"
                x2="292"
                y1={yScale(tick)}
                y2={yScale(tick)}
                className={`analytics-v2-bubble-plot__grid${tick === 4 ? " is-strong" : tick === 2 ? " is-soft" : ""}`}
              />
              <text x="14" y={yScale(tick) + 4} textAnchor="middle">
                {tick}
              </text>
            </g>
          ))}

          {view.distributionCells.map((cell) => {
            const radius = 8 + (cell.count / maxCount) * 18;
            return (
              <circle
                key={`${cell.x}-${cell.y}`}
                cx={scale(cell.x)}
                cy={yScale(cell.y)}
                r={radius}
                className="analytics-v2-bubble-plot__bubble"
              >
                <title>{`${view.xLabel}: ${formatScore(cell.x)} · Willingness: ${formatScore(cell.y)} · n=${cell.count} · ${formatPercent(cell.share)} of applicable responses`}</title>
              </circle>
            );
          })}

          <text x="160" y="18" textAnchor="middle" className="analytics-v2-bubble-plot__axis-title">
            Flexibility willingness
          </text>
          <text x="160" y="319" textAnchor="middle" className="analytics-v2-bubble-plot__axis-title">
            {view.xLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}

function CountryPulsePlot({
  construct,
  countries,
}: {
  construct: NonNullable<SurveyOverviewData["countryPulse"]>["constructs"][number];
  countries: NonNullable<SurveyOverviewData["countryPulse"]>["countries"];
}) {
  const scale = (value: number) => 26 + ((value - 1) / 4) * 354;

  return (
    <div className="analytics-v2-country-row">
      <div className="analytics-v2-country-row__label">
        <strong>{construct.label}</strong>
        <span>{`Median ${formatScore(construct.overall.median)} · IQR ${formatScore(construct.overall.q1)}-${formatScore(construct.overall.q3)} · n=${construct.overall.applicableN}`}</span>
      </div>

      <svg viewBox="0 0 410 54" className="analytics-v2-country-row__plot" role="img">
        <line x1="26" x2="380" y1="28" y2="28" className="analytics-v2-country-row__axis" />
        {[1, 2, 3, 4, 5].map((tick) => (
          <g key={tick}>
            <line x1={scale(tick)} x2={scale(tick)} y1="21" y2="35" className="analytics-v2-country-row__tick" />
            <text x={scale(tick)} y="49" textAnchor="middle">
              {tick}
            </text>
          </g>
        ))}

        <circle cx={scale(construct.overall.median)} cy="28" r="6" className="analytics-v2-country-row__dot analytics-v2-country-row__dot--overall">
          <title>{`Overall sample · median ${formatScore(construct.overall.median)} · IQR ${formatScore(construct.overall.q1)}-${formatScore(construct.overall.q3)} · n=${construct.overall.applicableN}`}</title>
        </circle>

        {construct.countries.map((country, index) => {
          if (!country.metric) {
            return null;
          }

          return (
            <circle
              key={country.code}
              cx={scale(country.metric.median)}
              cy={16 + (index % 2) * 14}
              r="5"
              className="analytics-v2-country-row__dot"
            >
              <title>{`${country.code} · median ${formatScore(country.metric.median)} · IQR ${formatScore(country.metric.q1)}-${formatScore(country.metric.q3)} · n=${country.metric.applicableN}`}</title>
            </circle>
          );
        })}
      </svg>

      <div className="analytics-v2-country-row__legend">
        <span className="is-overall">Overall</span>
        {countries.map((country) => (
          <span key={country.code} className={!country.detailAvailable ? "is-muted" : undefined}>
            {country.detailAvailable ? `${country.code} · n=${country.count}` : `${country.code} · n=${country.count} hidden`}
          </span>
        ))}
      </div>
    </div>
  );
}

export function OverviewPanel({ data }: OverviewPanelProps) {
  const [selectedDfcKey, setSelectedDfcKey] = useState(data.opportunity.defaultDfcKey);

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
          <div>
            <p className="analytics-v2-section__eyebrow">Survey Overview</p>
            <h3>Survey context</h3>
          </div>
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
              <div>
                <p className="analytics-v2-section__eyebrow">Visual snapshot</p>
                <h3>Flexibility opportunity snapshot</h3>
              </div>
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

            {selectedView.helperText ? (
              <p className="analytics-v2-section__note">{selectedView.helperText}</p>
            ) : null}

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
                <BubblePlot view={selectedView} />

                <article className="analytics-v2-card">
                  <h4>Operational groups</h4>
                  <ul className="analytics-v2-quadrant-list">
                    {selectedView.quadrants.map((quadrant) => (
                      <li key={quadrant.key}>
                        <strong>{quadrant.label}</strong>
                        <span>{`${formatPercent(quadrant.share)} · n=${formatCount(quadrant.count)}`}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            )}
          </section>

          {data.insights.length > 0 ? (
            <section className="analytics-v2-section">
              <div className="analytics-v2-section__heading">
                <div>
                  <p className="analytics-v2-section__eyebrow">Transparent observations</p>
                  <h3>What stands out</h3>
                </div>
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
              <div>
                <p className="analytics-v2-section__eyebrow">Constructs measured</p>
                <h3>Construct profile</h3>
              </div>
            </div>

            <div className="analytics-v2-construct-list">
              {data.constructs.map((construct) => (
                <article key={construct.conceptKey} className="analytics-v2-card">
                  <div className="analytics-v2-construct-row">
                    <div>
                      <h4>{construct.label}</h4>
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
                <div>
                  <p className="analytics-v2-section__eyebrow">Cross-country read</p>
                  <h3>Country pulse</h3>
                </div>
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
