"use client";

import { useMemo, useState } from "react";
import { generateInstrumentHealthAction } from "@/features/surveys/instrument-health-actions";
import type {
  InstrumentHealthConstruct,
  InstrumentHealthCorrelationCell,
  InstrumentHealthData,
  InstrumentHealthItemAnalysis,
  InstrumentHealthLikertBin,
  InstrumentHealthScope,
} from "@/features/surveys/analytics/instrument-health";
import { INSTRUMENT_HEALTH_HTMT_REFERENCE } from "@/features/surveys/analytics/instrument-health-semantics";

type InstrumentHealthPanelProps = {
  surveyId: string;
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "n/a";
  }

  return `${(value * 100).toFixed(0)}%`;
}

function formatScore(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) {
    return "n/a";
  }

  return value.toFixed(digits);
}

function formatHash(value: string | null) {
  if (!value) {
    return "none";
  }

  return value.length > 12 ? `${value.slice(0, 10)}…` : value;
}

function integrityLabel(status: InstrumentHealthData["integrity"]["status"]) {
  if (status === "consistent") {
    return "Consistent";
  }

  if (status === "review_required") {
    return "Review required";
  }

  return "Not evaluable";
}

function LikertBar({ bins }: { bins: InstrumentHealthLikertBin[] | null }) {
  if (!bins || bins.length === 0) {
    return <span className="analytics-v2-health-muted">No Likert distribution</span>;
  }

  return (
    <div className="analytics-v2-health-likert" aria-label="Likert distribution">
      {bins.map((bin) => (
        <span
          key={bin.value}
          className={`analytics-v2-health-likert__seg analytics-v2-health-likert__seg--${bin.value}`}
          style={{ width: `${Math.max(bin.share * 100, bin.count > 0 ? 2 : 0)}%` }}
          title={`${bin.value}: ${formatCount(bin.count)} (${formatPercent(bin.share)})`}
        />
      ))}
    </div>
  );
}

function FlagList({ item }: { item: InstrumentHealthItemAnalysis }) {
  if (item.flags.length === 0) {
    return <span className="analytics-v2-health-muted">None</span>;
  }

  return (
    <ul className="analytics-v2-health-flags">
      {item.flags.map((flag) => (
        <li key={flag.key}>
          <span className="analytics-v2-health-chip analytics-v2-health-chip--flag">{flag.label}</span>
          <span className="analytics-v2-health-flag-copy">
            {flag.observed} {flag.rule} {flag.whyNotDelete}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ConstructDetail({ construct }: { construct: InstrumentHealthConstruct }) {
  const reliability = construct.reliability;

  return (
    <div className="analytics-v2-health-detail">
      {construct.directionNote ? <p>{construct.directionNote}</p> : null}
      {construct.description ? <p>{construct.description}</p> : null}

      <div className="analytics-v2-health-mini-grid">
        <article>
          <span>Score n</span>
          <strong>{formatCount(construct.scoreDescriptives.n)}</strong>
        </article>
        <article>
          <span>Mean / median</span>
          <strong>{`${formatScore(construct.scoreDescriptives.mean)} / ${formatScore(construct.scoreDescriptives.median)}`}</strong>
        </article>
        <article>
          <span>SD / IQR</span>
          <strong>{`${formatScore(construct.scoreDescriptives.sd)} / ${formatScore(construct.scoreDescriptives.q1)}–${formatScore(construct.scoreDescriptives.q3)}`}</strong>
        </article>
        <article>
          <span>Floor / ceiling</span>
          <strong>{`${formatPercent(construct.scoreDescriptives.floorShare)} / ${formatPercent(construct.scoreDescriptives.ceilingShare)}`}</strong>
        </article>
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

      <div className="analytics-v2-health-reliability">
        <h4>Reliability summary</h4>
        {construct.role === "reflective_candidate" ? (
          <>
            <p>
              Alpha {formatScore(reliability.alpha)}
              {reliability.alphaCi95
                ? ` · 95% bootstrap CI ${formatScore(reliability.alphaCi95.lower)} to ${formatScore(reliability.alphaCi95.upper)} (${formatCount(reliability.alphaCi95.validReplicates)}/${formatCount(reliability.alphaCi95.requestedReplicates)} valid replicates)`
                : ""}
              {` · complete-case n=${formatCount(reliability.completeCaseN)} · k=${formatCount(reliability.itemCount)}`}
            </p>
            <p>
              Average inter-item r={formatScore(reliability.averageInterItemCorrelation)}
              {reliability.itemTotalRange
                ? ` · item-total range ${formatScore(reliability.itemTotalRange.min)} to ${formatScore(reliability.itemTotalRange.max)}`
                : ""}
            </p>
            <p>Omega ordinal: Not computed in this build.</p>
            <p>{reliability.reading}</p>
          </>
        ) : (
          <p>
            {reliability.reason ?? "Not a reflective scale."}
            {reliability.secondaryAlpha != null
              ? ` Secondary alpha=${formatScore(reliability.secondaryAlpha)} is shown only as a descriptive statistic.`
              : ""}
          </p>
        )}
      </div>

      {construct.items.length > 0 ? (
        <div className="analytics-v2-health-table-wrap">
          <table className="analytics-v2-health-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Polarity</th>
                <th>n</th>
                <th>Distribution</th>
                <th>Centre / spread</th>
                <th>Endpoints</th>
                <th>Item-total</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {construct.items.map((item) => (
                <tr key={item.questionKey}>
                  <td>
                    <strong>{item.questionKey}</strong>
                    <span>{item.title}</span>
                    {item.facet ? <small>{item.facet}</small> : null}
                  </td>
                  <td>
                    {item.reverseScored ? (
                      <span className="analytics-v2-health-chip">Reverse-scored for construct</span>
                    ) : (
                      item.polarity
                    )}
                  </td>
                  <td>
                    {`Eligible ${formatCount(item.eligibleN)} · answered ${formatCount(item.answeredN)}`}
                  </td>
                  <td>
                    <LikertBar bins={item.likertBins} />
                  </td>
                  <td>
                    {`${formatScore(item.descriptives.mean)} / ${formatScore(item.descriptives.median)} · SD ${formatScore(item.descriptives.sd)} · IQR ${formatScore(item.descriptives.q1)}–${formatScore(item.descriptives.q3)}`}
                  </td>
                  <td>
                    {`Exact min ${formatPercent(item.descriptives.floorShare)} · exact max ${formatPercent(item.descriptives.ceilingShare)}`}
                    {item.descriptives.bottomTwoShare != null
                      ? ` · bottom-two ${formatPercent(item.descriptives.bottomTwoShare)} · top-two ${formatPercent(item.descriptives.topTwoShare)}`
                      : ""}
                  </td>
                  <td>
                    {item.correctedItemTotal == null
                      ? "n/a"
                      : `${formatScore(item.correctedItemTotal)}${item.alphaIfDeleted != null ? ` · α if deleted ${formatScore(item.alphaIfDeleted)} (Δ ${formatScore(item.deltaAlpha)})` : ""}`}
                  </td>
                  <td>
                    <FlagList item={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function CorrelationHeatmap({
  constructs,
  cells,
}: {
  constructs: InstrumentHealthConstruct[];
  cells: InstrumentHealthCorrelationCell[];
}) {
  const keys = constructs.map((construct) => construct.conceptKey);
  const cellMap = new Map(
    cells.map((cell) => [`${cell.rowConceptKey}:${cell.columnConceptKey}`, cell]),
  );

  return (
    <div className="analytics-v2-health-table-wrap">
      <table className="analytics-v2-health-heatmap">
        <thead>
          <tr>
            <th> </th>
            {constructs.map((construct) => (
              <th key={construct.conceptKey}>{construct.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {constructs.map((row) => (
            <tr key={row.conceptKey}>
              <th>{row.label}</th>
              {keys.map((columnKey) => {
                const cell = cellMap.get(`${row.conceptKey}:${columnKey}`);
                const rho = cell?.spearmanRho ?? null;
                const diagonal = row.conceptKey === columnKey;
                const color = heatmapColor(rho, diagonal);
                return (
                  <td key={columnKey} style={{ background: color }}>
                    <span title={cell ? `Pearson r=${formatScore(cell.pearsonR)} · n=${formatCount(cell.n)}${cell.overlapFlag ? " · possible construct overlap — inspect" : ""}` : ""}>
                      {diagonal ? "—" : formatScore(rho)}
                    </span>
                    {!diagonal && cell ? <small>n={formatCount(cell.n)}</small> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function heatmapColor(rho: number | null, diagonal: boolean) {
  if (diagonal || rho == null) {
    return "transparent";
  }

  const intensity = Math.min(Math.abs(rho), 1);
  if (rho >= 0) {
    return `rgba(110, 168, 254, ${0.08 + intensity * 0.52})`;
  }

  return `rgba(184, 119, 217, ${0.08 + intensity * 0.52})`;
}

function GeneratedView({ data }: { data: InstrumentHealthData }) {
  const [scopeKey, setScopeKey] = useState(data.defaultScopeKey);
  const [openConstruct, setOpenConstruct] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const scope: InstrumentHealthScope = data.scopes[scopeKey] ?? data.scopes[data.defaultScopeKey];

  const scopeOptions = useMemo(
    () =>
      Object.values(data.scopes).map((entry) => ({
        key: entry.key,
        label: entry.key === "overall" ? `Overall n=${formatCount(entry.n)}` : `${entry.label} n=${formatCount(entry.n)}`,
      })),
    [data.scopes],
  );

  return (
    <div className="analytics-v2-overview analytics-v2-health">
      <section className="analytics-v2-section analytics-v2-section--context">
        <div className="analytics-v2-section__heading">
          <div>
            <h3>Analysis scope</h3>
            <p>
              Current instrument version · measurement hash {formatHash(data.context.currentMeasurementHash)}
              {data.context.currentMappingHash ? ` · mapping hash ${formatHash(data.context.currentMappingHash)}` : ""}
            </p>
            <p>
              {`Overall n=${formatCount(scope.n)} · ${formatCount(data.context.itemCount)} items · languages ${
                data.context.languages.length === 0
                  ? "none"
                  : data.context.languages.map((language) => `${language.code} (${formatCount(language.n)})`).join(" · ")
              }`}
            </p>
            <p>
              {`Collected ${formatCount(data.context.collectedN)} · ready ${formatCount(data.context.readyN)} · included ${formatCount(data.context.includedN)} · excluded other hash ${formatCount(data.context.excludedDifferentHashN)} · unknown hash ${formatCount(data.context.unknownHashN)}`}
            </p>
            {data.context.mapperVersions.length > 0 ? (
              <p>{`Mapper version ${data.context.mapperVersions.join(", ")}`}</p>
            ) : null}
          </div>
          <div className="analytics-v2-health-controls">
            <label>
              Scope
              <select value={scopeKey} onChange={(event) => setScopeKey(event.target.value)}>
                {scopeOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setShowHelp((current) => !current)}>
              How to read this page
            </button>
          </div>
        </div>
        {showHelp ? (
          <p className="analytics-v2-section__note">
            This page audits the instrument, not business performance. Alpha is only a strong reading for
            reflective candidates and only if the scale is sufficiently unidimensional. Tariff, DER and DFC
            are not pass/fail reliability scales. Reverse-scored items keep the raw answer in the bar and
            invert only for consistency and scoring. Advanced CFA, omega and invariance are not run in this
            build.
          </p>
        ) : null}
      </section>

      <section className="analytics-v2-section">
        <div className="analytics-v2-section__heading">
          <h3>Scoring and data integrity</h3>
          <span className={`analytics-v2-section__badge analytics-v2-health-status--${data.integrity.status}`}>
            {integrityLabel(data.integrity.status)}
          </span>
        </div>
        <div className="analytics-v2-context-grid">
          <article className="analytics-v2-stat-card">
            <span>Version consistency</span>
            <strong>{formatCount(data.context.includedN)}</strong>
            <small>{`Included on current hash. Excluded other hash n=${formatCount(data.context.excludedDifferentHashN)}. Unknown hash n=${formatCount(data.context.unknownHashN)}.`}</small>
          </article>
          <article className="analytics-v2-stat-card">
            <span>Mapping coverage</span>
            <strong>{`${formatCount(data.context.readyN)} / ${formatCount(data.context.collectedN)}`}</strong>
            <small>{`Ready vs collected. Mapping gap n=${formatCount(data.integrity.mappingGapN)}.`}</small>
          </article>
          <article className="analytics-v2-stat-card">
            <span>Scoring reproduction</span>
            <strong>{formatCount(data.integrity.scoringMismatchN)}</strong>
            <small>Responses whose recomputed mapper profile does not match the stored profile.</small>
          </article>
          <article className="analytics-v2-stat-card">
            <span>Answer validity</span>
            <strong>{formatCount(data.integrity.invalidNumericAnswerN + data.integrity.missingRequiredAnswerN)}</strong>
            <small>{`Out of range n=${formatCount(data.integrity.invalidNumericAnswerN)} · required missing n=${formatCount(data.integrity.missingRequiredAnswerN)} · missing polarity n=${formatCount(data.integrity.missingPolarityN)}.`}</small>
          </article>
        </div>
      </section>

      <section className="analytics-v2-section">
        <div className="analytics-v2-section__heading">
          <h3>Construct health overview</h3>
        </div>
        {scope.constructs.length === 0 ? (
          <p>No constructs are evaluable for this survey version.</p>
        ) : (
          <div className="analytics-v2-health-table-wrap">
            <table className="analytics-v2-health-table">
              <thead>
                <tr>
                  <th>Construct</th>
                  <th>Valid n</th>
                  <th>Items</th>
                  <th>Distribution</th>
                  <th>Internal consistency</th>
                  <th>Item flags</th>
                  <th>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {scope.constructs.map((construct) => (
                  <tr key={construct.conceptKey}>
                    <td>
                      <button
                        type="button"
                        className="analytics-v2-health-link"
                        aria-expanded={openConstruct === construct.conceptKey}
                        onClick={() =>
                          setOpenConstruct((current) =>
                            current === construct.conceptKey ? null : construct.conceptKey,
                          )
                        }
                      >
                        {construct.label}
                      </button>
                      <small>{construct.roleLabel}</small>
                    </td>
                    <td>{`${formatCount(construct.validN)} complete · ${formatCount(construct.applicableN)} applicable`}</td>
                    <td>{formatCount(construct.itemCount)}</td>
                    <td>{`Median ${formatScore(construct.scoreDescriptives.median)} · IQR ${formatScore(construct.scoreDescriptives.q1)}–${formatScore(construct.scoreDescriptives.q3)} · SD ${formatScore(construct.scoreDescriptives.sd)}`}</td>
                    <td>
                      {construct.role === "reflective_candidate"
                        ? construct.reliability.alpha == null
                          ? construct.reliability.reason ?? "Not computable"
                          : formatScore(construct.reliability.alpha)
                        : "Not a reflective scale"}
                    </td>
                    <td>{formatCount(construct.itemFlagCount)}</td>
                    <td>{construct.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {scope.constructs
          .filter((construct) => construct.conceptKey === openConstruct)
          .map((construct) => (
            <ConstructDetail key={construct.conceptKey} construct={construct} />
          ))}
      </section>

      <section className="analytics-v2-section">
        <div className="analytics-v2-section__heading">
          <h3>Construct relationships</h3>
          <p>Spearman rho on pairwise complete scores. Correlations are not causal.</p>
        </div>
        <CorrelationHeatmap constructs={scope.constructs} cells={scope.correlations} />
        {scope.htmt.length > 0 ? (
          <div className="analytics-v2-health-htmt">
            <h4>HTMT screening</h4>
            <ul>
              {scope.htmt.map((cell) => (
                <li key={`${cell.conceptKeyA}:${cell.conceptKeyB}`}>
                  {`${cell.conceptKeyA} × ${cell.conceptKeyB}: ${
                    cell.status === "computed"
                      ? `${formatScore(cell.value)}${cell.value != null && cell.value >= INSTRUMENT_HEALTH_HTMT_REFERENCE ? " · inspect (reference 0.85)" : ""}`
                      : `Not computable${cell.reason ? ` (${cell.reason})` : ""}`
                  }`}
                </li>
              ))}
            </ul>
            <p>HTMT below 0.85 can be shown as a conservative screening reference, never as a standalone validity proof.</p>
          </div>
        ) : null}
      </section>

      <section className="analytics-v2-section">
        <div className="analytics-v2-section__heading">
          <h3>DFC module health</h3>
          <p>No global alpha is computed for declared flexibility capability.</p>
        </div>
        {scope.dfc == null ? (
          <p>This survey version does not include the DFC module.</p>
        ) : (
          <>
            <div className="analytics-v2-health-table-wrap">
              <table className="analytics-v2-health-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Applicable n</th>
                    <th>Not applicable n</th>
                    <th>Score</th>
                    <th>Missing within applicable</th>
                  </tr>
                </thead>
                <tbody>
                  {scope.dfc.modules.map((module) => (
                    <tr key={module.setKey}>
                      <td>{module.label}</td>
                      <td>{`${formatCount(module.applicableN)} (${formatPercent(module.applicableShare)})`}</td>
                      <td>{formatCount(module.notApplicableN)}</td>
                      <td>{`Median ${formatScore(module.scoreDescriptives.median)} · IQR ${formatScore(module.scoreDescriptives.q1)}–${formatScore(module.scoreDescriptives.q3)} · SD ${formatScore(module.scoreDescriptives.sd)} · n=${formatCount(module.scoreDescriptives.n)}`}</td>
                      <td>{formatCount(module.missingWithinApplicableN)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Applicable modules per household:{" "}
              {scope.dfc.applicableModuleCountDistribution
                .map((entry) => `${entry.modules}: n=${formatCount(entry.n)} (${formatPercent(entry.share)})`)
                .join(" · ") || "none"}
            </p>
          </>
        )}
      </section>

      <section className="analytics-v2-section">
        <div className="analytics-v2-section__heading">
          <h3>Respondent response-pattern checks</h3>
          <p>Descriptive signals only. Straightlining is not an automatic exclusion rule. Completion time is not available.</p>
        </div>
        <div className="analytics-v2-context-grid">
          <article className="analytics-v2-stat-card">
            <span>Identical rating answers</span>
            <strong>{`${formatCount(scope.responsePatterns.identicalRatingItems.n)} (${formatPercent(scope.responsePatterns.identicalRatingItems.share)})`}</strong>
          </article>
          <article className="analytics-v2-stat-card">
            <span>{`Within-person SD < ${scope.responsePatterns.lowWithinPersonSd.threshold}`}</span>
            <strong>{`${formatCount(scope.responsePatterns.lowWithinPersonSd.n)} (${formatPercent(scope.responsePatterns.lowWithinPersonSd.share)})`}</strong>
          </article>
          <article className="analytics-v2-stat-card">
            <span>Longest same-response run</span>
            <strong>{`Median ${formatScore(scope.responsePatterns.longestSameResponseRun.median, 1)}`}</strong>
            <small>{`p90 ${formatScore(scope.responsePatterns.longestSameResponseRun.p90, 1)} · max ${formatScore(scope.responsePatterns.longestSameResponseRun.max, 1)} · n=${formatCount(scope.responsePatterns.longestSameResponseRun.n)}`}</small>
          </article>
        </div>
        {scope.responsePatterns.straightliningByConstruct.length > 0 ? (
          <ul className="analytics-v2-list">
            {scope.responsePatterns.straightliningByConstruct.map((entry) => (
              <li key={entry.conceptKey}>
                {`${entry.label}: n=${formatCount(entry.n)} (${formatPercent(entry.share)}) of complete-case n=${formatCount(entry.completeCaseN)}`}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="analytics-v2-section">
        <div className="analytics-v2-section__heading">
          <h3>Multilingual evidence</h3>
        </div>
        {data.multilingual.languageCount <= 1 ? (
          <p>Only one language is present in the included sample.</p>
        ) : (
          <p>
            Compare scopes above for descriptive differences by language. {data.multilingual.invarianceNote}
          </p>
        )}
        <div className="analytics-v2-health-table-wrap">
          <table className="analytics-v2-health-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Group(s)</th>
                <th>CFI</th>
                <th>TLI</th>
                <th>RMSEA [CI]</th>
                <th>SRMR</th>
                <th>ΔCFI</th>
                <th>ΔRMSEA</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.multilingual.advancedModels.map((row) => (
                <tr key={row.model}>
                  <td>{row.model}</td>
                  <td>{row.groups}</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Advanced model not run.</p>
      </section>

      {data.debrief ? (
        <section className="analytics-v2-section">
          <div className="analytics-v2-section__heading">
            <h3>Respondent debrief evidence</h3>
            <p>Open comments are counted, not classified automatically.</p>
          </div>
          <div className="analytics-v2-context-grid">
            <article className="analytics-v2-stat-card">
              <span>Feedback n</span>
              <strong>{formatCount(data.debrief.feedbackN)}</strong>
              <small>{`Coverage ${formatPercent(data.debrief.coverageShare)} of included responses.`}</small>
            </article>
            <article className="analytics-v2-stat-card">
              <span>Ease rating</span>
              <strong>{`Mean ${formatScore(data.debrief.ease.mean)} · median ${formatScore(data.debrief.ease.median)}`}</strong>
              <LikertBar bins={data.debrief.ease.likertBins} />
            </article>
            <article className="analytics-v2-stat-card">
              <span>Text fields received</span>
              <strong>{formatCount(data.debrief.textFieldsReceivedN)}</strong>
              <small>
                {data.debrief.questionSetVersions
                  .map((version) => `${version.version} n=${formatCount(version.n)}`)
                  .join(" · ")}
              </small>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function GeneratingOverlay() {
  return (
    <div className="analytics-v2-health-overlay" role="status" aria-live="polite">
      <span className="analytics-v2-health-spinner" aria-hidden="true" />
      <p>Generating instrument health</p>
      <small>This uses the full eligible sample for the current instrument version. You can stay on this tab until it finishes.</small>
    </div>
  );
}

export function InstrumentHealthPanel({ surveyId }: InstrumentHealthPanelProps) {
  const [data, setData] = useState<InstrumentHealthData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (generating) {
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const next = await generateInstrumentHealthAction(surveyId);
      setData(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Instrument health could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  if (generating) {
    return <GeneratingOverlay />;
  }

  if (!data) {
    return (
      <section className="analytics-v2-health-empty">
        <div>
          <h2>Generate instrument health</h2>
          <p>
            This analysis is not loaded with Analytics 2. It uses the full eligible sample for the current
            measurement hash: ready responses only, never a partial slice.
          </p>
        </div>
        {error ? <p className="analytics-v2-health-error">{error}</p> : null}
        <button type="button" className="analytics-v2-health-generate" onClick={() => void generate()}>
          Generate instrument health
        </button>
      </section>
    );
  }

  return (
    <div className="analytics-v2-health-shell">
      <div className="analytics-v2-health-toolbar">
        <button type="button" className="analytics-v2-health-generate" onClick={() => void generate()}>
          Regenerate
        </button>
        {error ? <p className="analytics-v2-health-error">{error}</p> : null}
      </div>
      <GeneratedView data={data} />
    </div>
  );
}
