"use client";

import { memo, useEffect, useMemo, useState } from "react";
import type { PostalMapAnalysis } from "@/features/surveys/analytics/geography/postal-map-types";
import { loadCountryMapData, type CountryCode, type CountryMapData } from "./postal-area-map-cache";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function countryName(countryCode: CountryCode) {
  switch (countryCode) {
    case "ES":
      return "Spain";
    case "FR":
      return "France";
    case "IE":
      return "Ireland";
  }
}

function areaIntensity(n: number, maxN: number) {
  if (maxN <= 0 || n <= 0) {
    return "var(--an-surface-alt)";
  }
  const ratio = n / maxN;
  const alpha = 0.18 + ratio * 0.58;
  return `color-mix(in srgb, var(--an-accent, #6ea8fe) ${Math.round(alpha * 100)}%, var(--an-surface) )`;
}

type PostalAreaMapProps = {
  analysis: PostalMapAnalysis | null;
  selectedAreaKeys?: string[];
  availableAreaKeys?: string[];
  onToggleArea?: (areaKey: string, allAreaKeys: string[]) => void;
  active?: boolean;
  readOnly?: boolean;
  title?: string;
  description?: string;
  baselineNote?: string | null;
};

const CountryPostalMap = memo(function CountryPostalMap({
  countryCode,
  map,
  areaMap,
  selectableAreaKeys,
  selectedAreaKeys,
  hasSelection,
  maxN,
  readOnly,
  onToggleArea,
  onTooltipOpen,
  onTooltipClose,
}: {
  countryCode: CountryCode;
  map: CountryMapData;
  areaMap: Map<string, PostalMapAnalysis["areas"][number]>;
  selectableAreaKeys: Set<string>;
  selectedAreaKeys: Set<string>;
  hasSelection: boolean;
  maxN: number;
  readOnly: boolean;
  onToggleArea?: (areaKey: string, allAreaKeys: string[]) => void;
  onTooltipOpen: (tooltip: { x: number; y: number; title: string; lines: string[] }) => void;
  onTooltipClose: () => void;
}) {
  const selectableKeys = Array.from(selectableAreaKeys);
  return (
    <section className="analytics-v2-postal-map__country">
      <header className="analytics-v2-postal-map__country-head">
        <h5>{countryName(countryCode)}</h5>
      </header>
      <svg
        viewBox={map.viewBox}
        className={`analytics-v2-postal-map__svg${hasSelection ? " has-selection" : ""}`}
        role="img"
        aria-label={`${countryName(countryCode)} respondent distribution by postal area`}
      >
        {map.shapes.map((shape) => {
          const aggregate = areaMap.get(shape.areaKey);
          const selected = selectedAreaKeys.has(shape.areaKey);
          const selectable = !readOnly && selectableAreaKeys.has(shape.areaKey);
          const hasData = (aggregate?.n ?? 0) > 0;
          const fill = selected ? "var(--an-accent, #6ea8fe)" : areaIntensity(aggregate?.n ?? 0, maxN);
          return (
            <path
              key={shape.areaKey}
              d={shape.path}
              tabIndex={selectable ? 0 : -1}
              role={selectable ? "button" : undefined}
              aria-pressed={selectable ? selected : undefined}
              aria-label={`${shape.label} ${shape.postalPrefix}`}
              className={`analytics-v2-postal-map__area${selected ? " is-selected" : ""}${hasData ? "" : " is-dimmed"}`}
              fill={fill}
              onClick={() => selectable && onToggleArea?.(shape.areaKey, selectableKeys)}
              onKeyDown={(event) => {
                if (!selectable) {
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onToggleArea?.(shape.areaKey, selectableKeys);
                }
              }}
              onPointerEnter={(event) => {
                const nextLines = aggregate
                  ? [
                      `n=${aggregate.n}`,
                      `${Math.round(aggregate.shareOfEligible * 100)}% of eligible responses`,
                      `${Math.round(aggregate.shareOfMapped * 100)}% of mapped responses`,
                    ]
                  : ["0 mapped responses in the current segment"];
                onTooltipOpen({
                  x: event.clientX,
                  y: event.clientY,
                  title: `${shape.label} (${shape.postalPrefix})`,
                  lines: nextLines,
                });
              }}
              onPointerLeave={onTooltipClose}
              onBlur={onTooltipClose}
            >
              <title>
                {shape.label} ({shape.postalPrefix})
              </title>
            </path>
          );
        })}
      </svg>
    </section>
  );
});

export function PostalAreaMap({
  analysis,
  selectedAreaKeys = [],
  availableAreaKeys = [],
  onToggleArea,
  active = true,
  readOnly = false,
  title = "Respondent distribution by postal area",
  description = "Colour intensity represents the number of mapped responses in the current segment definition.",
  baselineNote = null,
}: PostalAreaMapProps) {
  const countryCodes = useMemo(
    () =>
      Array.from(
        new Set(
          (analysis?.areas ?? [])
            .map((area) => area.countryCode)
            .filter((countryCode): countryCode is CountryCode => countryCode === "ES" || countryCode === "FR" || countryCode === "IE"),
        ),
      ),
    [analysis],
  );
  const [countryMaps, setCountryMaps] = useState<Record<string, CountryMapData>>({});
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    lines: string[];
  } | null>(null);

  useEffect(() => {
    if (!active || countryCodes.length === 0) {
      return;
    }

    let cancelled = false;

    async function load() {
      const entries = await Promise.all(countryCodes.map(async (countryCode) => [countryCode, await loadCountryMapData(countryCode)] as const));

      if (!cancelled) {
        setCountryMaps(Object.fromEntries(entries));
      }
    }

    void load().catch(() => {
      if (!cancelled) {
        setCountryMaps({});
      }
    });

    return () => {
      cancelled = true;
    };
  }, [active, countryCodes]);

  if (!analysis) {
    return null;
  }

  const areaMap = new Map(analysis.areas.map((area) => [area.areaKey, area]));
  const maxN = analysis.areas.reduce((current, area) => Math.max(current, area.n), 0);
  const selectableAreaKeys = new Set(availableAreaKeys);
  const selectedAreaKeySet = new Set(selectedAreaKeys);
  const hasSelection = selectedAreaKeySet.size > 0;
  const countries = countryCodes
    .map((countryCode) => ({
      countryCode,
      map: countryMaps[countryCode],
    }))
    .filter((entry): entry is { countryCode: CountryCode; map: CountryMapData } => Boolean(entry.map));

  return (
    <div className="analytics-v2-postal-map">
      <div className="analytics-v2-postal-map__summary">
        <p>
          <strong>{title}</strong>
        </p>
        <p>{description}</p>
        {baselineNote ? <p>{baselineNote}</p> : null}
        <p>
          Mapped responses {analysis.coverage.mappedN} / {analysis.coverage.eligibleN} (
          {Math.round(analysis.coverage.mappedShare * 100)}%)
        </p>
        {analysis.coverage.unmappedN > 0 ? (
          <p>{analysis.coverage.unmappedN} responses are not represented on this map.</p>
        ) : null}
      </div>

      <div className="analytics-v2-postal-map__countries">
        {countries.map(({ countryCode, map }) => (
          <CountryPostalMap
            key={countryCode}
            countryCode={countryCode}
            map={map}
            areaMap={areaMap}
            selectableAreaKeys={selectableAreaKeys}
            selectedAreaKeys={selectedAreaKeySet}
            hasSelection={hasSelection}
            maxN={maxN}
            readOnly={readOnly}
            onToggleArea={onToggleArea}
            onTooltipOpen={setTooltip}
            onTooltipClose={() => setTooltip(null)}
          />
        ))}
      </div>

      {tooltip ? (
        <div
          className="analytics-v2-postal-map__tooltip"
          style={{
            left: clamp(tooltip.x + 14, 12, window.innerWidth - 220),
            top: clamp(tooltip.y + 14, 12, window.innerHeight - 120),
          }}
        >
          <strong>{tooltip.title}</strong>
          {tooltip.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
