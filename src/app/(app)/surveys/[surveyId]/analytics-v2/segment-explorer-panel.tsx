"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { runSegmentExplorerAction } from "@/features/surveys/segment-explorer-actions";
import {
  MAX_SEGMENT_CONDITIONS,
  addToComparisonTray,
  canRunSegmentAnalysis,
  clearScoreCondition,
  comparisonTrayCount,
  describeReadableConditions,
  emptyComparisonTray,
  getAnalyseActionLabel,
  getComparisonTraySnapshot,
  getConceptDescription,
  getFieldApplicability,
  getFieldBand,
  getFieldEquality,
  getFieldRange,
  getMembershipValues,
  isSegmentAnalysisStale,
  removeConditionAt,
  resetSegmentDefinition,
  saveNamedSegment,
  scoreControlMode,
  subscribeSegmentStorage,
  setApplicability,
  setDateRange,
  setEquality,
  setNumericRange,
  toggleMembership,
  toggleSemanticBand,
  writeComparisonTray,
  type ComparisonTrayState,
  type SegmentAnalysisStatus,
  type SegmentBandKey,
  type SegmentCatalog,
  type SegmentCatalogDimension,
  type SegmentCatalogScoreField,
  type SegmentAnalysisResult,
  type SegmentDefinition,
} from "@/features/surveys/analytics/segments";
import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";
import { InfoTip } from "./info-tip";
import { SegmentAnalysisPanel } from "./segment-analysis-panel";

const FACETS_TIP =
  "Facets are the measured sub-parts of this axis. They show how the overall score breaks down, including single-item signals and multi-item facet scores.";

type SegmentExplorerPanelProps = {
  surveyId: string;
  catalog: SegmentCatalog;
  schema: SurveyAnalyticsSchema;
  definition: SegmentDefinition;
  notice: string | null;
  onDefinitionChange: (definition: SegmentDefinition) => void;
  onOpenComparison: () => void;
  onTrayChange: (tray: ComparisonTrayState) => void;
};

type SystemKey = `dimension:${string}` | "assets" | "geography" | "context";

function detailsOpen(event: { currentTarget: EventTarget | null }) {
  return event.currentTarget instanceof HTMLDetailsElement ? event.currentTarget.open : false;
}

function countForFields(definition: SegmentDefinition, fields: string[]) {
  const fieldSet = new Set(fields);
  return definition.conditions.filter((condition) => fieldSet.has(condition.field)).length;
}

function dimensionFields(dimension: SegmentCatalogDimension) {
  return [
    dimension.overall?.field,
    ...dimension.facets.map((facet) => facet.field),
    ...dimension.conditionalModules.map((module) => module.field),
    ...dimension.supportingFactors.map((factor) => factor.overall.field),
  ].filter((field): field is string => Boolean(field));
}

const RANGE_COMMIT_DELAY_MS = 400;

function DebouncedRangeInputs({
  min,
  max,
  scaleMin,
  scaleMax,
  step = "0.1",
  disabled,
  onCommit,
}: {
  min: number | null;
  max: number | null;
  scaleMin?: number;
  scaleMax?: number;
  step?: string;
  disabled?: boolean;
  onCommit: (min: number, max: number) => void;
}) {
  const [draftMin, setDraftMin] = useState(min == null ? "" : String(min));
  const [draftMax, setDraftMax] = useState(max == null ? "" : String(max));

  useEffect(() => {
    setDraftMin(min == null ? "" : String(min));
    setDraftMax(max == null ? "" : String(max));
  }, [min, max]);

  const commitDraft = (nextMin = draftMin, nextMax = draftMax) => {
    if (nextMin.trim() === "" || nextMax.trim() === "") {
      return;
    }
    const parsedMin = Number(nextMin);
    const parsedMax = Number(nextMax);
    if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax)) {
      return;
    }
    if (parsedMin === min && parsedMax === max) {
      return;
    }
    onCommit(parsedMin, parsedMax);
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      commitDraft();
    }, RANGE_COMMIT_DELAY_MS);
    return () => window.clearTimeout(handle);
    // Draft is the only trigger; commitDraft closes over the latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftMin, draftMax]);

  return (
    <div className="analytics-v2-seg-range">
      <label className="analytics-v2-seg-range__field">
        <span>Min</span>
        <input
          type="number"
          min={scaleMin}
          max={scaleMax}
          step={step}
          aria-label="Minimum"
          value={draftMin}
          disabled={disabled}
          onChange={(event) => setDraftMin(event.target.value)}
          onBlur={() => commitDraft()}
        />
      </label>
      <span className="analytics-v2-seg-range__sep" aria-hidden="true">
        to
      </span>
      <label className="analytics-v2-seg-range__field">
        <span>Max</span>
        <input
          type="number"
          min={scaleMin}
          max={scaleMax}
          step={step}
          aria-label="Maximum"
          value={draftMax}
          disabled={disabled}
          onChange={(event) => setDraftMax(event.target.value)}
          onBlur={() => commitDraft()}
        />
      </label>
    </div>
  );
}

function ScoreControls({
  field,
  definition,
  onChange,
  disabled,
}: {
  field: Pick<SegmentCatalogScoreField, "field" | "scaleMin" | "scaleMax" | "bandLabels">;
  definition: SegmentDefinition;
  onChange: (definition: SegmentDefinition) => void;
  disabled?: boolean;
}) {
  const band = getFieldBand(definition, field.field);
  const range = getFieldRange(definition, field.field);
  const [preferredMode, setPreferredMode] = useState<"band" | "range">("band");
  const mode = scoreControlMode(preferredMode, band, range);

  return (
    <div className="analytics-v2-seg-score">
      <div className="analytics-v2-seg-switch" role="group" aria-label="Score filter mode">
        <button
          type="button"
          className={mode === "band" ? "is-active" : undefined}
          disabled={disabled}
          onClick={() => {
            setPreferredMode("band");
            if (range) {
              onChange(clearScoreCondition(definition, field.field));
            }
          }}
        >
          Band
        </button>
        <button
          type="button"
          className={mode === "range" ? "is-active" : undefined}
          disabled={disabled}
          onClick={() => {
            setPreferredMode("range");
            if (band) {
              onChange(clearScoreCondition(definition, field.field));
            }
          }}
        >
          Range
        </button>
      </div>
      {mode === "band" ? (
        <div className="analytics-v2-seg-bands">
          {(["high", "medium", "low"] as SegmentBandKey[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`analytics-v2-seg-chip${band === value ? " is-active" : ""}`}
              disabled={disabled}
              onClick={() => onChange(toggleSemanticBand(definition, field.field, value))}
            >
              {field.bandLabels[value]}
            </button>
          ))}
        </div>
      ) : (
        <DebouncedRangeInputs
          min={range?.min ?? field.scaleMin}
          max={range?.max ?? field.scaleMax}
          scaleMin={field.scaleMin}
          scaleMax={field.scaleMax}
          disabled={disabled}
          onCommit={(nextMin, nextMax) =>
            onChange(setNumericRange(definition, field.field, nextMin, nextMax, field))
          }
        />
      )}
    </div>
  );
}

function FilterRow({
  label,
  tip,
  hint,
  children,
}: {
  label: string;
  tip?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="analytics-v2-seg-row">
      <div className="analytics-v2-seg-row__meta">
        <strong>
          {label}
          {tip ? <InfoTip text={tip} /> : null}
        </strong>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="analytics-v2-seg-row__controls">{children}</div>
    </div>
  );
}

export function SegmentExplorerPanel({
  surveyId,
  catalog,
  schema,
  definition,
  notice,
  onDefinitionChange,
  onOpenComparison,
  onTrayChange,
}: SegmentExplorerPanelProps) {
  const [analysedDefinition, setAnalysedDefinition] = useState<SegmentDefinition | null>(null);
  const [analysisResult, setAnalysisResult] = useState<SegmentAnalysisResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<SegmentAnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const analysisRequestRef = useRef(0);
  const tray = useSyncExternalStore(
    subscribeSegmentStorage,
    () => getComparisonTraySnapshot(surveyId, catalog.measurementHash, schema),
    emptyComparisonTray,
  );
  const [saveName, setSaveName] = useState("");
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [openNested, setOpenNested] = useState<Record<string, boolean>>({});
  const systems = useMemo(() => {
    const items: Array<{ key: SystemKey; label: string; fields: string[] }> = catalog.dimensions.map(
      (dimension) => ({
        key: `dimension:${dimension.dimension}`,
        label: dimension.label,
        fields: dimensionFields(dimension),
      }),
    );
    if (catalog.assets) {
      items.push({ key: "assets", label: catalog.assets.label, fields: [catalog.assets.field] });
    }
    if (catalog.geography.length > 0) {
      items.push({
        key: "geography",
        label: "Geography",
        fields: catalog.geography.map((field) => field.field),
      });
    }
    if (catalog.context.length > 0) {
      items.push({
        key: "context",
        label: "Context",
        fields: catalog.context.map((field) => field.field),
      });
    }
    return items;
  }, [catalog]);
  const [selectedKey, setSelectedKey] = useState<SystemKey>(systems[0]?.key ?? "context");
  const systemBodyRef = useRef<HTMLDivElement>(null);
  const [systemBodyMinHeight, setSystemBodyMinHeight] = useState(0);
  const selected = systems.find((system) => system.key === selectedKey) ?? systems[0];
  const selectedDimension =
    selected?.key.startsWith("dimension:")
      ? catalog.dimensions.find((dimension) => `dimension:${dimension.dimension}` === selected.key)
      : null;
  const atLimit = definition.conditions.length >= MAX_SEGMENT_CONDITIONS;
  const draftConditions = useMemo(
    () => describeReadableConditions(definition, schema),
    [definition, schema],
  );
  const stale = isSegmentAnalysisStale(definition, analysedDefinition);
  const canAnalyse = canRunSegmentAnalysis(definition, analysedDefinition, analysisStatus);
  const analyseLabel = getAnalyseActionLabel(definition, analysedDefinition, analysisStatus);
  const axisDescription = selectedDimension?.overall
    ? getConceptDescription(selectedDimension.overall.conceptKey, {
        schemaNamespace: catalog.schemaNamespace,
        schemaVersion: catalog.schemaVersion,
        fields: schema.fields,
      })
    : null;

  useLayoutEffect(() => {
    const node = systemBodyRef.current;
    if (!node) {
      return;
    }
    const nextHeight = Math.ceil(node.getBoundingClientRect().height);
    setSystemBodyMinHeight((current) => Math.max(current, nextHeight));
  }, [selectedKey, definition.conditions, openNested, selectedDimension]);

  const handleAnalyse = () => {
    const requestId = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestId;
    const snapshot = definition;
    setAnalysisStatus("loading");
    setError(null);
    runSegmentExplorerAction(surveyId, snapshot)
      .then((next) => {
        if (analysisRequestRef.current !== requestId) {
          return;
        }
        setAnalysedDefinition(next.definition);
        setAnalysisResult(next);
        setAnalysisStatus("ready");
      })
      .catch((cause: unknown) => {
        if (analysisRequestRef.current !== requestId) {
          return;
        }
        setAnalysisStatus("error");
        setError(cause instanceof Error ? cause.message : "The segment could not be analysed.");
      });
  };

  const persistTray = (next: ComparisonTrayState) => {
    writeComparisonTray(surveyId, catalog.measurementHash, next);
    onTrayChange(next);
  };

  const handleAddToComparison = (replaceSlot?: 0 | 1) => {
    if (!analysedDefinition) {
      return;
    }
    const result = addToComparisonTray(tray, analysedDefinition, replaceSlot);
    if (!result.ok) {
      setLocalNotice(
        result.reason === "duplicate"
          ? "That exact definition is already in Comparison."
          : "Comparison already holds two segments. Choose which slot to replace.",
      );
      return;
    }
    persistTray(result.tray);
    setLocalNotice(null);
  };

  return (
    <div className="analytics-v2-segment">
      {notice || localNotice || error ? (
        <p className="analytics-v2-segment-notice" role="status">
          {error ?? notice ?? localNotice}
        </p>
      ) : null}

      <div className="analytics-v2-seg-workspace">
        <section className="analytics-v2-panel analytics-v2-seg-builder">
          <div className="analytics-v2-seg-toolbar">
            <div className="analytics-v2-seg-toolbar__status">
              <span>Active filters</span>
              <strong>
                {definition.conditions.length === 0
                  ? "Whole sample"
                  : `${definition.conditions.length}/${MAX_SEGMENT_CONDITIONS}`}
              </strong>
              <small>Draft filters · AND only</small>
            </div>
            <div className="analytics-v2-seg-toolbar__chips">
              {draftConditions.length ? (
                draftConditions.map((condition, index) => (
                  <button
                    key={`${condition.field}:${index}`}
                    type="button"
                    className="analytics-v2-seg-chip is-active"
                    onClick={() => onDefinitionChange(removeConditionAt(definition, index))}
                  >
                    {condition.label}: {condition.detail}
                    <span aria-hidden="true">×</span>
                  </button>
                ))
              ) : (
                <small>No filters. AND applies as you add conditions.</small>
              )}
              {definition.conditions.length > 0 ? (
                <small className="analytics-v2-seg-toolbar__hint">Click a chip to remove that filter.</small>
              ) : null}
              {atLimit ? (
                <small className="analytics-v2-seg-toolbar__hint">
                  This segment has reached the {MAX_SEGMENT_CONDITIONS}-condition limit. Remove a filter to add another.
                </small>
              ) : null}
            </div>
            <div className="analytics-v2-seg-toolbar__bar">
              <div className="analytics-v2-seg-saveblock">
                <span className="analytics-v2-seg-saveblock__title">Save segment</span>
                <div className="analytics-v2-seg-saveblock__row">
                  <input
                    type="text"
                    placeholder="Segment name"
                    value={saveName}
                    onChange={(event) => setSaveName(event.target.value)}
                  />
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      const record = saveNamedSegment({
                        surveyId,
                        measurementHash: catalog.measurementHash,
                        name: saveName,
                        definition,
                      });
                      setSaveName("");
                      setLocalNotice(`Saved “${record.name}”.`);
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => onDefinitionChange(resetSegmentDefinition(definition))}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="analytics-v2-panel__head">
            <div className="analytics-v2-panel__title">
              <h3>Segment Builder</h3>
            </div>
          </div>

          <nav className="analytics-v2-seg-systems" aria-label="Filter systems">
            {systems.map((system) => {
              const count = countForFields(definition, system.fields);
              return (
                <button
                  key={system.key}
                  type="button"
                  className={`analytics-v2-seg-system${selected?.key === system.key ? " is-active" : ""}`}
                  onClick={() => setSelectedKey(system.key)}
                >
                  <span>{system.label}</span>
                  {count > 0 ? <em>{count}</em> : null}
                </button>
              );
            })}
          </nav>

          <div
            ref={systemBodyRef}
            className="analytics-v2-seg-system-body"
            style={systemBodyMinHeight > 0 ? { minHeight: systemBodyMinHeight } : undefined}
          >
            {selectedDimension ? (
              <>
                {selectedDimension.overall ? (
                  <FilterRow
                    label={`Overall score of ${selectedDimension.label}`}
                    tip={axisDescription}
                    hint={selectedDimension.overall.directionNote ?? undefined}
                  >
                    <ScoreControls
                      field={selectedDimension.overall}
                      definition={definition}
                      onChange={onDefinitionChange}
                      disabled={
                        atLimit &&
                        !getFieldBand(definition, selectedDimension.overall.field) &&
                        !getFieldRange(definition, selectedDimension.overall.field)
                      }
                    />
                  </FilterRow>
                ) : null}

                {selectedDimension.conditionalModules.length > 0 ? (
                  <div className="analytics-v2-seg-stack">
                    <h4>Conditional modules</h4>
                    {selectedDimension.conditionalModules.map((module) => {
                      const applicability = getFieldApplicability(definition, module.field);
                      return (
                        <FilterRow key={module.field} label={module.label}>
                          <div className="analytics-v2-seg-bands">
                            <button
                              type="button"
                              className={`analytics-v2-seg-chip${applicability === true ? " is-active" : ""}`}
                              onClick={() =>
                                onDefinitionChange(
                                  setApplicability(definition, module.field, applicability === true ? null : true),
                                )
                              }
                            >
                              Applicable
                            </button>
                            <button
                              type="button"
                              className={`analytics-v2-seg-chip${applicability === false ? " is-active" : ""}`}
                              onClick={() =>
                                onDefinitionChange(
                                  setApplicability(definition, module.field, applicability === false ? null : false),
                                )
                              }
                            >
                              Not applicable
                            </button>
                          </div>
                          <ScoreControls field={module} definition={definition} onChange={onDefinitionChange} />
                        </FilterRow>
                      );
                    })}
                  </div>
                ) : null}

                {selectedDimension.facets.length > 0 ? (
                  <div className="analytics-v2-seg-stack">
                    <h4>
                      Facets
                      <InfoTip text={FACETS_TIP} />
                    </h4>
                    {selectedDimension.facets.map((facet) => (
                      <FilterRow key={facet.field} label={facet.label} hint={facet.evidenceLabel}>
                        <ScoreControls field={facet} definition={definition} onChange={onDefinitionChange} />
                      </FilterRow>
                    ))}
                  </div>
                ) : null}

                {selectedDimension.supportingFactors.length > 0 ? (
                  <details
                    className="analytics-v2-seg-nested"
                    open={openNested[`${selectedDimension.dimension}:supporting`] === true}
                    onToggle={(event) => {
                      const open = detailsOpen(event);
                      setOpenNested((current) => ({
                        ...current,
                        [`${selectedDimension.dimension}:supporting`]: open,
                      }));
                    }}
                  >
                    <summary>Supporting factors · {selectedDimension.supportingFactors.length}</summary>
                    {selectedDimension.supportingFactors.map((factor) => (
                      <div key={factor.conceptKey} className="analytics-v2-seg-stack">
                        <FilterRow label={factor.label}>
                          <ScoreControls
                            field={factor.overall}
                            definition={definition}
                            onChange={onDefinitionChange}
                          />
                        </FilterRow>
                      </div>
                    ))}
                  </details>
                ) : null}
              </>
            ) : null}

            {selected?.key === "assets" && catalog.assets ? (
              <>
                {(["contains", "not_contains"] as const).map((mode) => (
                  <FilterRow key={mode} label={mode === "contains" ? "Has" : "Does not have"}>
                    <div className="analytics-v2-seg-bands">
                      {catalog.assets?.values.map((asset) => {
                        const selectedAsset = getMembershipValues(
                          definition,
                          catalog.assets!.field,
                          mode,
                        ).includes(asset.value);
                        return (
                          <button
                            key={`${mode}:${asset.value}`}
                            type="button"
                            className={`analytics-v2-seg-chip${selectedAsset ? " is-active" : ""}`}
                            onClick={() =>
                              onDefinitionChange(
                                toggleMembership(definition, catalog.assets!.field, asset.value, mode),
                              )
                            }
                          >
                            {asset.label}
                          </button>
                        );
                      })}
                    </div>
                  </FilterRow>
                ))}
              </>
            ) : null}

            {selected?.key === "geography"
              ? catalog.geography.map((field) => (
                  <FilterRow key={field.field} label={field.label}>
                    <select
                      value={String(getFieldEquality(definition, field.field) ?? "")}
                      onChange={(event) =>
                        onDefinitionChange(setEquality(definition, field.field, event.target.value || null))
                      }
                    >
                      <option value="">Any</option>
                      {field.values.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FilterRow>
                ))
              : null}

            {selected?.key === "context"
              ? catalog.context.map((field) => {
                  if (field.kind === "choice") {
                    return (
                      <FilterRow key={field.field} label={field.label}>
                        <select
                          value={String(getFieldEquality(definition, field.field) ?? "")}
                          onChange={(event) =>
                            onDefinitionChange(setEquality(definition, field.field, event.target.value || null))
                          }
                        >
                          <option value="">Any</option>
                          {field.values.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FilterRow>
                    );
                  }

                  if (field.kind === "date_range") {
                    const current = definition.conditions.find(
                      (condition) => condition.field === field.field && condition.kind === "date_range",
                    );
                    return (
                      <FilterRow key={field.field} label={field.label}>
                        <div className="analytics-v2-seg-range">
                          <label className="analytics-v2-seg-range__field">
                            <span>From</span>
                            <input
                              type="date"
                              aria-label="From"
                              value={current?.kind === "date_range" ? current.min.slice(0, 10) : ""}
                              onChange={(event) =>
                                onDefinitionChange(
                                  setDateRange(
                                    definition,
                                    field.field,
                                    event.target.value || null,
                                    current?.kind === "date_range" ? current.max : event.target.value || null,
                                  ),
                                )
                              }
                            />
                          </label>
                          <span className="analytics-v2-seg-range__sep" aria-hidden="true">
                            to
                          </span>
                          <label className="analytics-v2-seg-range__field">
                            <span>To</span>
                            <input
                              type="date"
                              aria-label="To"
                              value={current?.kind === "date_range" ? current.max.slice(0, 10) : ""}
                              onChange={(event) =>
                                onDefinitionChange(
                                  setDateRange(
                                    definition,
                                    field.field,
                                    current?.kind === "date_range" ? current.min : event.target.value || null,
                                    event.target.value || null,
                                  ),
                                )
                              }
                            />
                          </label>
                        </div>
                      </FilterRow>
                    );
                  }

                  const range = getFieldRange(definition, field.field);
                  return (
                    <FilterRow key={field.field} label={field.label}>
                      <DebouncedRangeInputs
                        min={range?.min ?? null}
                        max={range?.max ?? null}
                        scaleMin={field.scaleMin}
                        scaleMax={field.scaleMax}
                        onCommit={(nextMin, nextMax) =>
                          onDefinitionChange(
                            setNumericRange(definition, field.field, nextMin, nextMax, field),
                          )
                        }
                      />
                    </FilterRow>
                  );
                })
              : null}
          </div>
        </section>

        <div className="analytics-v2-seg-analyse-bar">
          <button
            type="button"
            className="analytics-v2-seg-analyse"
            disabled={!canAnalyse}
            aria-busy={analysisStatus === "loading"}
            onClick={handleAnalyse}
          >
            {analyseLabel}
          </button>
        </div>

        <SegmentAnalysisPanel
          result={analysisResult}
          status={analysisStatus}
          dirty={stale}
          schema={schema}
          comparisonCount={comparisonTrayCount(tray)}
          comparisonFull={comparisonTrayCount(tray) === 2}
          onAddToComparison={handleAddToComparison}
          onOpenComparison={onOpenComparison}
          draftDefinition={definition}
          onExploreSubgroup={(field, band) => onDefinitionChange(toggleSemanticBand(definition, field, band))}
        />
      </div>
    </div>
  );
}
