"use client";

import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
import { InfoTip } from "./info-tip";
import { generateInstrumentHealthAction } from "@/features/surveys/instrument-health-actions";
import {
  readInstrumentHealthSession,
  subscribeInstrumentHealthSession,
  writeInstrumentHealthSession,
} from "@/features/surveys/analytics/instrument-health-session";
import {
  associationConstructs,
  buildInstrumentHealthExport,
  groupInstrumentHealthConstructs,
  type InstrumentHealthAssociationMode,
  type InstrumentHealthConstruct,
  type InstrumentHealthCorrelationCell,
  type InstrumentHealthData,
  type InstrumentHealthHtmtCell,
  type InstrumentHealthItemAnalysis,
  type InstrumentHealthLikertBin,
  type InstrumentHealthScope,
} from "@/features/surveys/analytics/instrument-health";
import { INSTRUMENT_HEALTH_COPY } from "@/features/surveys/analytics/instrument-health-semantics";
import { appRoutes } from "@/lib/config/routes";

type InstrumentHealthPanelProps = {
  surveyId: string;
  currentCollectedN?: number;
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

function MethodologyLink() {
  return (
    <a
      className="analytics-v2-health-method-link"
      href={appRoutes.instrumentHealthMethodology}
      target="_blank"
      rel="noreferrer"
    >
      {INSTRUMENT_HEALTH_COPY.methodologyLink} ↗
    </a>
  );
}

function formatAlpha(reliability: InstrumentHealthConstruct["reliability"]) {
  if (reliability.alpha == null) {
    return reliability.reason ?? "n/a";
  }

  const ci = reliability.alphaCi95;
  if (ci?.lower != null && ci?.upper != null) {
    return `${formatScore(reliability.alpha)} [${formatScore(ci.lower)}–${formatScore(ci.upper)}]`;
  }

  return formatScore(reliability.alpha);
}

function signalKindLabel(kind: InstrumentHealthItemAnalysis["flags"][number]["kind"]) {
  if (kind === "distribution") {
    return "Distribution";
  }

  if (kind === "item_coherence") {
    return "Item coherence";
  }

  return "Scoring integrity";
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

function subscribeNever() {
  return () => {};
}

function formatGeneratedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatHtmtCell(cell: InstrumentHealthHtmtCell) {
  const nPart = `n=${formatCount(cell.n)}`;
  const descriptiveLabel =
    cell.sampleAdequacy === "descriptive_only" && cell.sampleAdequacyLabel
      ? ` · ${cell.sampleAdequacyLabel}`
      : "";

  if (cell.status !== "computed") {
    return `Not computable${cell.reason ? ` (${cell.reason})` : ""} · ${nPart}${descriptiveLabel}`;
  }

  const overlap = cell.overlapFlag
    ? cell.sampleAdequacy === "preliminary"
      ? " · overlap signal · preliminary"
      : " · overlap signal"
    : "";

  return `${formatScore(cell.value)} · ${nPart} · reference ${formatScore(cell.reference)}${overlap}${descriptiveLabel}`;
}

function downloadInstrumentHealthExport(data: InstrumentHealthData) {
  const file = buildInstrumentHealthExport(data);
  const blob = new Blob([file.body], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function FlagList({ item }: { item: InstrumentHealthItemAnalysis }) {
  if (item.flags.length === 0) {
    return <span className="analytics-v2-health-muted">None</span>;
  }

  return (
    <ul className="analytics-v2-health-flags">
      {item.flags.map((flag) => (
        <li key={flag.key}>
          <span className={`analytics-v2-health-chip analytics-v2-health-chip--${flag.kind}`}>
            {`${signalKindLabel(flag.kind)}: ${flag.label}`}
          </span>
          <span className="analytics-v2-health-flag-copy">
            {flag.observed} {flag.rule}
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
          {construct.bands.map((band) => `${formatPercent(band.share)} ${band.label}`).join(" · ")}
        </small>
      </div>

      {construct.directionNote ? <p>{construct.directionNote}</p> : null}
      {construct.sampleAdequacyLabel ? (
        <p className="analytics-v2-health-muted">{construct.sampleAdequacyLabel}</p>
      ) : null}

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
                ? ` · Corrected item-total range ${formatScore(reliability.itemTotalRange.min)}–${formatScore(reliability.itemTotalRange.max)}`
                : ""}
            </p>
            <p>Omega ordinal: Not computed in this build.</p>
          </>
        ) : (
          <p>
            {reliability.reason ?? "Not a reflective scale."}
            {construct.sampleAdequacyLabel ? ` ${construct.sampleAdequacyLabel}.` : ""}
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
    <div className="analytics-v2-health-table-wrap analytics-v2-health-table-wrap--matrix">
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
                const involvesStricter =
                  row.scoreDirection === "higher_is_stricter" ||
                  constructs.find((construct) => construct.conceptKey === columnKey)?.scoreDirection ===
                    "higher_is_stricter";
                const titleParts = [
                  cell
                    ? `Spearman ρ=${formatScore(cell.spearmanRho)} · Pearson r=${formatScore(cell.pearsonR)} · paired n=${formatCount(cell.n)}`
                    : "",
                  involvesStricter
                    ? "A negative association with a stricter-direction construct means higher strictness tends to accompany lower scores on the other construct."
                    : "",
                ].filter(Boolean);
                return (
                  <td key={columnKey} style={{ background: color }}>
                    <span title={titleParts.join(" ")}>
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

function languageCaption(languages: InstrumentHealthData["context"]["languages"]) {
  if (languages.length === 0) {
    return "No language data";
  }

  return languages.map((language) => `${language.code} (${formatCount(language.n)})`).join(" · ");
}

function GeneratedView({
  data,
  currentCollectedN,
  error,
  onRegenerate,
}: {
  data: InstrumentHealthData;
  currentCollectedN?: number;
  error: string | null;
  onRegenerate: () => void;
}) {
  const [scopeKey, setScopeKey] = useState(data.defaultScopeKey);
  const [openConstruct, setOpenConstruct] = useState<string | null>(null);
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [associationMode, setAssociationMode] = useState<InstrumentHealthAssociationMode>("core");
  const scope: InstrumentHealthScope = data.scopes[scopeKey] ?? data.scopes[data.defaultScopeKey];
  const constructGroups = groupInstrumentHealthConstructs(scope.constructs);
  const coreAssociationConstructs = associationConstructs(scope.constructs, "core");
  const supportingAssociationConstructs = associationConstructs(scope.constructs, "core_and_supporting");
  const visibleAssociationConstructs = associationConstructs(scope.constructs, associationMode);
  const canShowCoreAssociations = coreAssociationConstructs.length >= 2;
  const canShowSupportingAssociations = supportingAssociationConstructs.length >= 2;
  const showAssociationToggle = canShowCoreAssociations && supportingAssociationConstructs.length > coreAssociationConstructs.length;
  const collectedDriftN =
    currentCollectedN != null && currentCollectedN !== data.context.collectedN
      ? currentCollectedN
      : null;

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
      <div className="analytics-v2-health-toolbar">
        <div className="analytics-v2-health-controls">
          <label>
            <span>Scope</span>
            <select value={scopeKey} onChange={(event) => setScopeKey(event.target.value)}>
              {scopeOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="analytics-v2-health-toolbar__actions">
          <p className="analytics-v2-health-generated-at">
            Generated {formatGeneratedAt(data.generatedAt)}
          </p>
          <MethodologyLink />
          {error ? <p className="analytics-v2-health-error">{error}</p> : null}
          <button type="button" className="analytics-v2-health-generate" onClick={() => downloadInstrumentHealthExport(data)}>
            Export JSON
          </button>
          <button type="button" className="analytics-v2-health-generate" onClick={onRegenerate}>
            Regenerate
          </button>
        </div>
      </div>

      {collectedDriftN != null ? (
        <p className="analytics-v2-health-freshness" role="status">
          {`This analysis was generated ${formatGeneratedAt(data.generatedAt)} with n=${formatCount(data.context.collectedN)}. The survey now has n=${formatCount(collectedDriftN)} collected responses. Regenerate to refresh.`}
        </p>
      ) : null}

      <p className="analytics-v2-health-intro">{INSTRUMENT_HEALTH_COPY.pageIntro}</p>

      <section className="analytics-v2-kpi-strip" aria-label="Instrument health context">
        <article className="analytics-v2-kpi">
          <span>Included</span>
          <strong>{formatCount(data.context.includedN)}</strong>
          <small>{`${formatCount(data.context.readyN)} ready · ${formatCount(data.context.collectedN)} collected`}</small>
        </article>
        <article className="analytics-v2-kpi">
          <span>Coverage</span>
          <strong>{`${formatCount(data.context.readyN)} / ${formatCount(data.context.collectedN)}`}</strong>
          <small>{`Mapping gap n=${formatCount(data.integrity.mappingGapN)}`}</small>
        </article>
        <article className="analytics-v2-kpi">
          <span>Integrity</span>
          <strong className={`analytics-v2-health-status--${data.integrity.status}`}>
            {integrityLabel(data.integrity.status)}
          </strong>
          <small>{`Mismatches ${formatCount(data.integrity.scoringMismatchN)} · invalid ${formatCount(data.integrity.invalidNumericAnswerN + data.integrity.missingRequiredAnswerN)}`}</small>
        </article>
        <article className="analytics-v2-kpi">
          <span>Items</span>
          <strong>{formatCount(data.context.itemCount)}</strong>
          <small>
            {languageCaption(data.context.languages)}
            {data.context.currentMeasurementHash
              ? ` · hash ${formatHash(data.context.currentMeasurementHash)}`
              : ""}
          </small>
        </article>
      </section>

      {scope.constructs.length > 0 ? (
        <section className="analytics-v2-panel">
        <header className="analytics-v2-panel__head">
          <div className="analytics-v2-panel__title">
            <h3>
              Construct health <InfoTip text={INSTRUMENT_HEALTH_COPY.pageIntro} />
            </h3>
          </div>
        </header>
        <div className="analytics-v2-health-table-wrap">
          <table className="analytics-v2-health-table">
            <thead>
              <tr>
                <th>Construct</th>
                <th>Measurement role</th>
                <th>Coverage</th>
                <th>Items</th>
                <th>Distribution</th>
                <th>Internal consistency</th>
                <th>Corrected item-total</th>
                <th>Distribution signals</th>
                <th>Item coherence signals</th>
              </tr>
            </thead>
            <tbody>
              {constructGroups.map((group) => (
                <Fragment key={group.key}>
                  <tr className="analytics-v2-health-group">
                    <th colSpan={9}>{group.label}</th>
                  </tr>
                  {group.constructs.map((construct) => {
                    const expanded = openConstruct === construct.conceptKey;
                    const supporting = group.key === "behavioural_modulator";
                    return (
                      <Fragment key={construct.conceptKey}>
                        <tr className={expanded ? "is-open" : undefined}>
                          <td>
                            <button
                              type="button"
                              className={`analytics-v2-health-link${supporting ? " is-supporting" : ""}`}
                              aria-expanded={expanded}
                              onClick={() =>
                                setOpenConstruct((current) =>
                                  current === construct.conceptKey ? null : construct.conceptKey,
                                )
                              }
                            >
                              <span className="analytics-v2-health-link__caret" aria-hidden="true">
                                {expanded ? "▾" : "▸"}
                              </span>
                              {construct.label}
                            </button>
                          </td>
                          <td>{construct.roleLabel}</td>
                          <td>
                            {construct.role === "conditional_module"
                              ? `${formatCount(construct.applicableN)} with at least one applicable module`
                              : `${formatCount(construct.validN)} complete · ${formatCount(construct.applicableN)} applicable`}
                            {construct.sampleAdequacyLabel ? (
                              <small>{construct.sampleAdequacyLabel}</small>
                            ) : null}
                          </td>
                          <td>{formatCount(construct.itemCount)}</td>
                          <td>{`Median ${formatScore(construct.scoreDescriptives.median)} · IQR ${formatScore(construct.scoreDescriptives.q1)}–${formatScore(construct.scoreDescriptives.q3)} · SD ${formatScore(construct.scoreDescriptives.sd)}`}</td>
                          <td>
                            {construct.role === "reflective_candidate"
                              ? formatAlpha(construct.reliability)
                              : "—"}
                            {construct.role === "reflective_candidate" &&
                            construct.reliability.averageInterItemCorrelation != null
                              ? ` · r ${formatScore(construct.reliability.averageInterItemCorrelation)}`
                              : ""}
                          </td>
                          <td>
                            {construct.role === "reflective_candidate" && construct.reliability.itemTotalRange
                              ? `${formatScore(construct.reliability.itemTotalRange.min)}–${formatScore(construct.reliability.itemTotalRange.max)}`
                              : "—"}
                          </td>
                          <td>
                            {construct.role === "conditional_module"
                              ? "—"
                              : `${formatCount(construct.itemsWithDistributionSignals)} of ${formatCount(construct.itemCount)} items`}
                          </td>
                          <td>
                            {construct.role === "reflective_candidate"
                              ? `${formatCount(construct.itemsWithCoherenceSignals)} of ${formatCount(construct.itemCount)} items`
                              : "—"}
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="analytics-v2-health-detail-row">
                            <td colSpan={9}>
                              <ConstructDetail construct={construct} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {canShowCoreAssociations || canShowSupportingAssociations ? (
        <section className="analytics-v2-panel">
          <header className="analytics-v2-panel__head">
            <div className="analytics-v2-panel__title">
              <h3>
                Construct associations <InfoTip text={INSTRUMENT_HEALTH_COPY.constructAssociations} />
              </h3>
            </div>
          </header>
          {showAssociationToggle ? (
            <div className="analytics-v2-dfc-selector" role="tablist" aria-label="Association set">
              <button
                type="button"
                className={`analytics-v2-dfc-selector__button${associationMode === "core" ? " is-active" : ""}`}
                onClick={() => setAssociationMode("core")}
              >
                <span>Core axes</span>
                <small>{`n constructs=${formatCount(coreAssociationConstructs.length)}`}</small>
              </button>
              <button
                type="button"
                className={`analytics-v2-dfc-selector__button${associationMode === "core_and_supporting" ? " is-active" : ""}`}
                onClick={() => setAssociationMode("core_and_supporting")}
              >
                <span>Core axes + supporting factors</span>
                <small>{`n constructs=${formatCount(supportingAssociationConstructs.length)}`}</small>
              </button>
            </div>
          ) : null}
          <CorrelationHeatmap
            constructs={
              associationMode === "core" && canShowCoreAssociations
                ? coreAssociationConstructs
                : visibleAssociationConstructs.length >= 2
                  ? visibleAssociationConstructs
                  : supportingAssociationConstructs
            }
            cells={scope.correlations}
          />
        </section>
      ) : null}

      {scope.htmt.length > 0 ? (
        <section className="analytics-v2-panel">
          <header className="analytics-v2-panel__head">
            <div className="analytics-v2-panel__title">
              <h3>
                HTMT screening <InfoTip text={INSTRUMENT_HEALTH_COPY.htmt} />
              </h3>
            </div>
          </header>
          <ul className="analytics-v2-health-htmt">
            {scope.htmt.map((cell) => (
              <li key={`${cell.conceptKeyA}:${cell.conceptKeyB}`}>
                {`${cell.conceptKeyA} × ${cell.conceptKeyB}: ${formatHtmtCell(cell)}`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {scope.conditionalModules.length > 0
        ? scope.conditionalModules.map((group) => (
            <section className="analytics-v2-panel" key={group.conceptKey}>
              <header className="analytics-v2-panel__head">
                <div className="analytics-v2-panel__title">
                  <h3>{`${group.label} modules`}</h3>
                  <p>
                    {`No global alpha is computed. ${formatCount(
                      scope.constructs.find((construct) => construct.conceptKey === group.conceptKey)
                        ?.applicableN ?? 0,
                    )} respondents have at least one applicable module. Coverage below is by applicable group.`}
                  </p>
                </div>
              </header>
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
                    {group.modules.map((module) => (
                      <tr key={module.setKey}>
                        <td>
                          {module.label}
                          {module.sampleAdequacyLabel ? (
                            <small>{module.sampleAdequacyLabel}</small>
                          ) : null}
                        </td>
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
                {group.applicableModuleCountDistribution
                  .map((entry) => `${entry.modules}: n=${formatCount(entry.n)} (${formatPercent(entry.share)})`)
                  .join(" · ") || "none"}
              </p>
            </section>
          ))
        : null}

      <section className="analytics-v2-panel">
        <header className="analytics-v2-panel__head">
          <div className="analytics-v2-panel__title">
            <h3>Response-pattern checks</h3>
            <p>Descriptive signals only. These are not automatic exclusion rules.</p>
          </div>
        </header>
        <div className="analytics-v2-context-grid">
          <article className="analytics-v2-stat-card">
            <span>Identical ratings across all items</span>
            <strong>{`${formatCount(scope.responsePatterns.identicalRatingItems.n)} (${formatPercent(scope.responsePatterns.identicalRatingItems.share)})`}</strong>
          </article>
          <article className="analytics-v2-stat-card">
            <span>{`Within-person SD < ${scope.responsePatterns.lowWithinPersonSd.threshold}`}</span>
            <strong>{`${formatCount(scope.responsePatterns.lowWithinPersonSd.n)} (${formatPercent(scope.responsePatterns.lowWithinPersonSd.share)})`}</strong>
          </article>
        </div>
        <div className="analytics-v2-health-sequence">
          <div className="analytics-v2-health-sequence__head">
            <button
              type="button"
              className="analytics-v2-health-sequence__toggle"
              aria-expanded={sequenceOpen}
              onClick={() => setSequenceOpen((current) => !current)}
            >
              <span className="analytics-v2-health-link__caret" aria-hidden="true">
                {sequenceOpen ? "▾" : "▸"}
              </span>
              Longest identical-answer sequence
            </button>
            <InfoTip text={INSTRUMENT_HEALTH_COPY.longestRun} />
          </div>
          {sequenceOpen ? (
            <div className="analytics-v2-health-sequence__body">
              <div className="analytics-v2-health-mini-grid">
                <article>
                  <span>Median streak</span>
                  <strong>{formatScore(scope.responsePatterns.longestSameResponseRun.median, 1)}</strong>
                </article>
                <article>
                  <span>p90 / max</span>
                  <strong>{`${formatScore(scope.responsePatterns.longestSameResponseRun.p90, 1)} / ${formatScore(scope.responsePatterns.longestSameResponseRun.max, 1)}`}</strong>
                </article>
                <article>
                  <span>Median share of items seen</span>
                  <strong>{formatPercent(scope.responsePatterns.longestSameResponseRun.medianShare)}</strong>
                </article>
                <article>
                  <span>Respondents</span>
                  <strong>{formatCount(scope.responsePatterns.longestSameResponseRun.n)}</strong>
                </article>
              </div>
              {scope.responsePatterns.identicalRatingsByConstruct.length > 0 ? (
                <div>
                  <h4>
                    Identical ratings within a construct{" "}
                    <InfoTip text={INSTRUMENT_HEALTH_COPY.identicalWithinConstruct} />
                  </h4>
                  <div className="analytics-v2-health-table-wrap">
                    <table className="analytics-v2-health-table">
                      <thead>
                        <tr>
                          <th>Construct</th>
                          <th>n</th>
                          <th>Share</th>
                          <th>Complete-case n</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scope.responsePatterns.identicalRatingsByConstruct.map((entry) => (
                          <tr key={entry.conceptKey}>
                            <td>{entry.label}</td>
                            <td>{formatCount(entry.n)}</td>
                            <td>{formatPercent(entry.share)}</td>
                            <td>{formatCount(entry.completeCaseN)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {data.multilingual.languageCount > 1 ? (
        <section className="analytics-v2-panel">
          <header className="analytics-v2-panel__head">
            <div className="analytics-v2-panel__title">
              <h3>Multilingual evidence</h3>
              <p>{`Compare scopes above for descriptive differences by language. ${data.multilingual.invarianceNote}`}</p>
            </div>
          </header>
        </section>
      ) : null}

      {data.debrief ? (
        <section className="analytics-v2-panel">
          <header className="analytics-v2-panel__head">
            <div className="analytics-v2-panel__title">
              <h3>
                Respondent debrief <InfoTip text={INSTRUMENT_HEALTH_COPY.debrief} />
              </h3>
              <p>
                {INSTRUMENT_HEALTH_COPY.debrief} Optional debrief was used for this collection.
                {data.debrief.currentlyEnabled == null
                  ? ""
                  : data.debrief.currentlyEnabled
                    ? " Currently enabled."
                    : " Currently disabled."}
              </p>
            </div>
          </header>
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

function GeneratingOverlay({ covering }: { covering: boolean }) {
  return (
    <div
      className={`analytics-v2-health-overlay${covering ? " is-cover" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="analytics-v2-health-spinner" aria-hidden="true" />
      <p>Generating instrument health</p>
      <small>
        This uses the full eligible sample for the current instrument version. You can stay on this tab
        until it finishes.
      </small>
    </div>
  );
}

export function InstrumentHealthPanel({ surveyId, currentCollectedN }: InstrumentHealthPanelProps) {
  const sessionChecked = useSyncExternalStore(subscribeNever, () => true, () => false);
  const data = useSyncExternalStore(
    subscribeInstrumentHealthSession,
    () => readInstrumentHealthSession(surveyId),
    () => null,
  );
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
      writeInstrumentHealthSession(surveyId, next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Instrument health could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="analytics-v2-health-shell">
      {generating ? <GeneratingOverlay covering={data != null} /> : null}

      {!sessionChecked && !generating ? <div className="analytics-v2-health-session-placeholder" /> : null}

      {sessionChecked && !data && !generating ? (
        <section className="analytics-v2-health-empty">
          <div>
            <h2>Generate instrument health</h2>
            <p>
              This analysis is not loaded with Analytics 2. It uses the full eligible sample for the
              current measurement hash: ready responses only, never a partial slice.
            </p>
            <MethodologyLink />
          </div>
          {error ? <p className="analytics-v2-health-error">{error}</p> : null}
          <button type="button" className="analytics-v2-health-generate" onClick={() => void generate()}>
            Generate instrument health
          </button>
        </section>
      ) : null}

      {data ? (
        <GeneratedView
          key={data.cacheKey}
          data={data}
          currentCollectedN={currentCollectedN}
          error={error}
          onRegenerate={() => void generate()}
        />
      ) : null}
    </div>
  );
}
