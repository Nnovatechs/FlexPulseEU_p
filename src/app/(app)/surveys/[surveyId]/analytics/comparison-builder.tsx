"use client";

import { useState } from "react";

type FilterOption = {
  value: string;
  label: string;
  description?: string;
};

export type ComparisonSelectionState = {
  profileBand: string;
  country: string;
  language: string;
  asset: string;
};

type ComparisonBuilderProps = {
  leftSelection: ComparisonSelectionState;
  rightSelection: ComparisonSelectionState;
  profileBandOptions: FilterOption[];
  countryOptions: FilterOption[];
  languageOptions: FilterOption[];
  assetOptions: FilterOption[];
};

function humanizeFilterLabel(value: string) {
  if (value === "neutral" || value === "neutral_mainstream") {
    return "Neutral Position";
  }

  const normalized = value.replace(/[_-]+/g, " ").trim();

  if (!normalized) {
    return "Unknown";
  }

  if (/^[a-z]{2}$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
}

function toggleSelection(
  selection: ComparisonSelectionState,
  key: keyof ComparisonSelectionState,
  value: string,
) {
  return {
    ...selection,
    [key]: selection[key] === value ? "" : value,
  };
}

function ComparisonOptionGroup({
  label,
  allLabel,
  value,
  options,
  onSelect,
}: {
  label: string;
  allLabel: string;
  value: string;
  options: FilterOption[];
  onSelect: (value: string) => void;
}) {
  return (
    <section className="comparison-filter-section">
      <h4>{label}</h4>
      <div className="comparison-filter-options">
        <button
          type="button"
          className={`comparison-filter-option comparison-filter-option--all${value ? "" : " is-active"}`}
          onClick={() => onSelect("")}
        >
          <span>{allLabel}</span>
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`comparison-filter-option${value === option.value ? " is-active" : ""}`}
            title={option.description}
            onClick={() => onSelect(option.value)}
          >
            <span>{humanizeFilterLabel(option.label)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ComparisonColumn({
  side,
  title,
  selection,
  setSelection,
  countryOptions,
  profileBandOptions,
  languageOptions,
  assetOptions,
}: {
  side: "a" | "b";
  title: string;
  selection: ComparisonSelectionState;
  setSelection: (selection: ComparisonSelectionState) => void;
  profileBandOptions: FilterOption[];
  countryOptions: FilterOption[];
  languageOptions: FilterOption[];
  assetOptions: FilterOption[];
}) {
  return (
    <div className="comparison-column">
      <div className="comparison-column__header">
        <span>{side.toUpperCase()}</span>
        <strong>{title}</strong>
      </div>
      <ComparisonOptionGroup
        label="Profile axis band"
        allLabel="All profile bands"
        value={selection.profileBand}
        options={profileBandOptions}
        onSelect={(value) => setSelection(toggleSelection(selection, "profileBand", value))}
      />
      <ComparisonOptionGroup
        label="Country"
        allLabel="All countries"
        value={selection.country}
        options={countryOptions}
        onSelect={(value) => setSelection(toggleSelection(selection, "country", value))}
      />
      <ComparisonOptionGroup
        label="Language"
        allLabel="All languages"
        value={selection.language}
        options={languageOptions}
        onSelect={(value) => setSelection(toggleSelection(selection, "language", value))}
      />
      {assetOptions.length > 0 ? (
        <ComparisonOptionGroup
          label="DER asset"
          allLabel="All assets"
          value={selection.asset}
          options={assetOptions}
          onSelect={(value) => setSelection(toggleSelection(selection, "asset", value))}
        />
      ) : null}
    </div>
  );
}

function ComparisonHiddenInputs({
  prefix,
  selection,
}: {
  prefix: "compare_a" | "compare_b";
  selection: ComparisonSelectionState;
}) {
  return (
    <>
      <input type="hidden" name={`${prefix}_profile_band`} value={selection.profileBand} />
      <input type="hidden" name={`${prefix}_country`} value={selection.country} />
      <input type="hidden" name={`${prefix}_language`} value={selection.language} />
      <input type="hidden" name={`${prefix}_asset`} value={selection.asset} />
    </>
  );
}

export function ComparisonBuilder({
  leftSelection,
  rightSelection,
  profileBandOptions,
  countryOptions,
  languageOptions,
  assetOptions,
}: ComparisonBuilderProps) {
  const [left, setLeft] = useState(leftSelection);
  const [right, setRight] = useState(rightSelection);
  const [isComparing, setIsComparing] = useState(false);

  return (
    <form
      className={`comparison-builder${isComparing ? " is-loading" : ""}`}
      action=""
      onSubmit={() => setIsComparing(true)}
    >
      <input type="hidden" name="view" value="comparison" />
      <input type="hidden" name="compare" value="1" />
      <ComparisonHiddenInputs prefix="compare_a" selection={left} />
      <ComparisonHiddenInputs prefix="compare_b" selection={right} />
      <ComparisonColumn
        side="a"
        title="Segment A"
        selection={left}
        setSelection={setLeft}
        profileBandOptions={profileBandOptions}
        countryOptions={countryOptions}
        languageOptions={languageOptions}
        assetOptions={assetOptions}
      />
      <div className="comparison-vs" aria-hidden="true">
        VS
      </div>
      <ComparisonColumn
        side="b"
        title="Segment B"
        selection={right}
        setSelection={setRight}
        profileBandOptions={profileBandOptions}
        countryOptions={countryOptions}
        languageOptions={languageOptions}
        assetOptions={assetOptions}
      />
      <div className="comparison-builder__actions">
        <button
          type="submit"
          className="button button--primary comparison-submit-button"
          aria-busy={isComparing}
        >
          {isComparing ? "Comparing..." : "Compare"}
        </button>
      </div>
      {isComparing ? (
        <div className="comparison-loading-panel" role="status" aria-live="polite">
          <span />
          <strong>Running comparison</strong>
        </div>
      ) : null}
    </form>
  );
}
