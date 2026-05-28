import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { FLEXPULSE_DER_ASSET_VALUES } from "@/features/ontology/flexpulse-behavioural-schema";
import {
  classifySurveyAnalyticsEvidence,
  type SurveyAnalyticsFieldDefinition,
  type SurveyAnalyticsMetricResult,
  type SurveyAnalyticsQueryRow,
} from "@/features/surveys/survey-analytics";
import {
  getSurveyAnalyticsPageData,
  getSurveyById,
} from "@/features/surveys/use-cases";
import {
  buildBaselineMetrics,
  buildHrefWithProfileConditions,
  buildRadarGridPolygon,
  buildRadarPolygon,
  buildSegmentMetrics,
  buildSelectedFilters,
  describeAverage,
  findConceptField,
  formatCompactCount,
  formatDateShort,
  formatMetricValue,
  formatPlainValue,
  getActiveProfileConditions,
  getConceptShortLabel,
  getConceptTitle,
  getDifferenceLabel,
  getDominantTag,
  getEvidenceLabel,
  getEvidenceTone,
  getGroupLabel,
  getHumanTag,
  getMetric,
  getMetricValue,
  getPrimaryProfileFields,
  getRadarAxisLabel,
  getScoreBarWidth,
  getScoreRange,
  getSearchParam,
  getSegmentEntries,
  getSegmentFieldLabel,
  getSingleGroup,
  getVisibleProfileConditions,
  groupFieldsBySource,
  MAX_BREAKDOWN_ROWS,
  MAX_INTELLIGENCE_AXES,
  MAX_PROFILE_CONCEPTS,
  MAX_RADAR_AXES,
  metricKeyFor,
  optionsFromRows,
  polarPoint,
  TAG_VALUES,
  type ProfileCondition,
} from "@/features/surveys/analytics/profile-explorer-utils";
import { appRoutes } from "@/lib/config/routes";

type SurveyAnalyticsPageProps = {
  params: Promise<{ surveyId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EvidenceBadge({
  evidence,
}: {
  evidence: SurveyAnalyticsQueryRow["evidence"];
}) {
  return (
    <span className={`evidence-badge evidence-badge--${getEvidenceTone(evidence.label)}`}>
      {getEvidenceLabel(evidence.label)} · n={evidence.response_count}
    </span>
  );
}

function RenderFieldTags({
  fields,
  emptyLabel,
}: {
  fields: SurveyAnalyticsFieldDefinition[];
  emptyLabel: string;
}) {
  if (fields.length === 0) {
    return <p>{emptyLabel}</p>;
  }

  return (
    <div className="survey-card__concepts">
      {fields.map((field) => (
        <span key={field.key} className="tag">
          {field.key}
        </span>
      ))}
    </div>
  );
}

function AnalyticsTabs() {
  return (
    <nav className="analytics-tabs" aria-label="Analytics sections">
      <a href="#profile-overview">Survey intelligence</a>
      <a href="#segment-finder">Segment finder</a>
      <a href="#cohort-explorer">Cohort explorer</a>
      <a href="#compare-segments">Compare segments</a>
      <a href="#distributions">Distributions</a>
      <a href="#schema">Schema</a>
    </nav>
  );
}

function SegmentFilterPanel({
  countryOptions,
  audienceOptions,
  languageOptions,
  assetOptions,
  selectedCountry,
  selectedAudience,
  selectedLanguage,
  selectedTag,
  selectedAsset,
}: {
  countryOptions: Array<{ value: string; label: string }>;
  audienceOptions: Array<{ value: string; label: string }>;
  languageOptions: Array<{ value: string; label: string }>;
  assetOptions: Array<{ value: string; label: string }>;
  selectedCountry: string;
  selectedAudience: string;
  selectedLanguage: string;
  selectedTag: string;
  selectedAsset: string;
}) {
  return (
    <section className="surface-card filter-panel">
      <div>
        <h2>Ask a question about a cohort</h2>
        <p>
          Build a respondent selection and the dashboard will describe that cohort against the full
          survey baseline.
        </p>
      </div>
      <form className="filter-grid" action="">
        <FilterSelect
          name="country"
          label="Where are they?"
          value={selectedCountry}
          options={countryOptions}
        />
        <FilterSelect
          name="audience"
          label="Which audience?"
          value={selectedAudience}
          options={audienceOptions}
        />
        <FilterSelect
          name="language"
          label="Response language"
          value={selectedLanguage}
          options={languageOptions}
        />
        <FilterSelect
          name="tag"
          label="Trust/profile band"
          value={selectedTag}
          options={TAG_VALUES.map((tag) => ({
            value: tag,
            label: `${tag} ${getHumanTag(tag) ? `(${getHumanTag(tag)})` : ""}`,
          }))}
        />
        <FilterSelect
          name="asset"
          label="Has DER asset"
          value={selectedAsset}
          options={assetOptions}
        />
        <div className="filter-actions">
          <button type="submit" className="button button--primary">
            Analyse cohort
          </button>
          <Link href="?" className="button button--secondary">
            Clear filters
          </Link>
        </div>
      </form>
    </section>
  );
}

function SegmentOpportunityFinder({
  searchParams,
  tagFields,
  conditions,
  activeConditions,
  selectedRow,
  countryRows,
  countryField,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  tagFields: SurveyAnalyticsFieldDefinition[];
  conditions: ProfileCondition[];
  activeConditions: ProfileCondition[];
  selectedRow: SurveyAnalyticsQueryRow | null;
  countryRows: SurveyAnalyticsQueryRow[];
  countryField: SurveyAnalyticsFieldDefinition | null;
}) {
  if (tagFields.length === 0) {
    return (
      <section id="segment-finder" className="surface-card segment-finder">
        <h2>Segment Opportunity Finder</h2>
        <div className="empty-state empty-state--inline">
          <h3>No profile tags available</h3>
          <p>This builder needs tagged profile axes (`low` / `medium` / `high`) in the measurement plan.</p>
        </div>
      </section>
    );
  }

  const nextCondition: ProfileCondition = {
    fieldKey: tagFields[0]?.key ?? "",
    tag: "high",
  };
  const addConditionHref = buildHrefWithProfileConditions(searchParams, [...conditions, nextCondition]);
  const matchedRespondents = getMetricValue(selectedRow, "responses");
  const suppressSegmentDetail = Boolean(selectedRow?.evidence.suppress_detail);
  const countryDistribution = activeConditions.length > 0 && countryField && !suppressSegmentDetail
    ? countryRows
        .map((row) => ({
          label: getGroupLabel(row, countryField.key),
          value: row.metrics.responses.value,
          unit: "count" as const,
        }))
        .filter((row): row is { label: string; value: number; unit: "count" } => row.value != null)
    : [];

  return (
    <section id="segment-finder" className="surface-card segment-finder">
      <div>
        <h2>Segment Opportunity Finder</h2>
        <p>
          Build a behavioural filter using profile bands. The segment includes respondents that
          satisfy all selected conditions.
        </p>
      </div>

      <form className="segment-condition-list" action="">
        {conditions.map((condition, index) => {
          const removeHref = buildHrefWithProfileConditions(
            searchParams,
            conditions.filter((_, conditionIndex) => conditionIndex !== index),
          );

          return (
            <div key={`${condition.fieldKey}-${condition.tag}-${index}`} className="segment-condition-row">
              <span>{index + 1}</span>
              <select name="profileField" defaultValue={condition.fieldKey}>
                {tagFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {getConceptShortLabel(field).replace(/\s+tag$/i, "")}
                  </option>
                ))}
              </select>
              <small>is</small>
              <select name="profileTag" defaultValue={condition.tag}>
                {TAG_VALUES.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag.charAt(0).toUpperCase() + tag.slice(1)}
                  </option>
                ))}
              </select>
              {conditions.length > 1 ? (
                <Link href={removeHref} className="segment-condition-remove" aria-label="Remove condition">
                  ×
                </Link>
              ) : (
                <span className="segment-condition-remove segment-condition-remove--disabled">×</span>
              )}
            </div>
          );
        })}

        <div className="segment-condition-actions">
          <Link href={addConditionHref} className="button button--secondary">
            + Add condition
          </Link>
          <button type="submit" className="button button--primary">
            Find segment
          </button>
        </div>
      </form>

      <div className="segment-opportunity-output">
        <article className="segment-opportunity-card">
          <div className="segment-opportunity-card__header">
            <p>Current segment</p>
            <strong>
              {activeConditions.length > 0
                ? activeConditions
                .map((condition) => {
                  const field = tagFields.find((candidate) => candidate.key === condition.fieldKey);
                  return field
                    ? `${getConceptShortLabel(field).replace(/\s+tag$/i, "")} = ${condition.tag}`
                    : null;
                })
                .filter(Boolean)
                .join(" + ")
                : "No behavioural segment applied yet"}
            </strong>
          </div>
          {activeConditions.length > 0 ? (
            <>
              {selectedRow ? <EvidenceBadge evidence={selectedRow.evidence} /> : null}
              <p>
                Matched respondents: <strong>{formatPlainValue(matchedRespondents)}</strong>. This block is
                intentionally descriptive, not prescriptive: it reports the size and geographic mix of
                the selected cohort without inventing a deployment recommendation.
              </p>
              {selectedRow?.evidence.suppress_detail ? (
                <p className="evidence-warning">
                  Segment details are suppressed because fewer than 5 respondents match this
                  selection.
                </p>
              ) : selectedRow ? (
                <p className="evidence-warning">{selectedRow.evidence.description}</p>
              ) : (
                <p className="evidence-warning">
                  No respondents currently match all selected behavioural conditions.
                </p>
              )}
            </>
          ) : (
            <p>
              Choose one or more conditions and press <strong>Find segment</strong>. Until then, no
              behavioural filter is applied to the survey.
            </p>
          )}
        </article>

        <ProgressListCard
          title="Countries inside this segment"
          description="Count of respondents matching all current behavioural conditions."
          rows={countryDistribution}
        />
      </div>
    </section>
  );
}

function BreakdownCard({
  title,
  description,
  rows,
  groupField,
  metricKeys,
}: {
  title: string;
  description: string;
  rows: SurveyAnalyticsQueryRow[];
  groupField: string;
  metricKeys: string[];
}) {
  return (
    <article className="surface-card">
      <h2>{title}</h2>
      <p>{description}</p>
      {rows.length > 0 ? (
        <div className="stack-list">
          {rows.slice(0, MAX_BREAKDOWN_ROWS).map((row) => (
            <div key={`${groupField}-${getGroupLabel(row, groupField)}`} className="analytics-row">
              <strong>{getGroupLabel(row, groupField)}</strong>
              <span>
                {metricKeys
                  .map((metricKey) => {
                    const metric = row.metrics[metricKey];
                    if (!metric) {
                      return null;
                    }
                    return `${metricKey}: ${formatMetricValue(metric)}`;
                  })
                  .filter(Boolean)
                  .join(" · ")}
                {" · "}
                <EvidenceBadge evidence={row.evidence} />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No grouped results yet</h3>
          <p>This preview will populate once mapped responses are available.</p>
        </div>
      )}
    </article>
  );
}

function ProfileOverviewCard({
  selectedRow,
  baselineRow,
  profileValueFields,
  tagFields,
  hasActiveFilters,
}: {
  selectedRow: SurveyAnalyticsQueryRow | null;
  baselineRow: SurveyAnalyticsQueryRow | null;
  profileValueFields: SurveyAnalyticsFieldDefinition[];
  tagFields: SurveyAnalyticsFieldDefinition[];
  hasActiveFilters: boolean;
}) {
  const row = selectedRow ?? baselineRow;

  if (!row || profileValueFields.length === 0) {
    return (
      <article className="surface-card">
        <h2>What is this cohort like?</h2>
        <div className="empty-state empty-state--inline">
          <h3>No profile metrics yet</h3>
          <p>Mapped responses are required before the aggregate profile can be shown.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="surface-card profile-panel">
      <h2>{hasActiveFilters ? "What is this selected cohort like?" : "What is the overall profile?"}</h2>
      <p>
        {hasActiveFilters
          ? "This describes the respondents matching the active filters, compared with the full survey baseline below."
          : "This describes all mapped respondents in the survey. Use filters above to ask a more specific cohort question."}
      </p>
      <EvidenceBadge evidence={row.evidence} />
      {row.evidence.suppress_detail ? (
        <p className="evidence-warning">
          This selection matches fewer than 5 respondents. Profile details are hidden for privacy.
          Adjust the filters above to explore a larger cohort.
        </p>
      ) : (
        <>
          {row.evidence.label !== "usable" ? (
            <p className="evidence-warning">{row.evidence.description}</p>
          ) : null}
          <div className="profile-score-grid">
            {profileValueFields.slice(0, MAX_PROFILE_CONCEPTS).map((field) => {
              const averageKey = metricKeyFor("avg", field);
              const tagField = tagFields.find((candidate) => candidate.concept_key === field.concept_key);
              const dominantTag = tagField ? getDominantTag(row, tagField) : null;
              const average = getMetricValue(row, averageKey);
              const baselineAverage = getMetricValue(baselineRow, averageKey);
              const delta =
                hasActiveFilters && average != null && baselineAverage != null
                  ? average - baselineAverage
                  : null;

              return (
                <div key={field.key} className="profile-score-card">
                  <span>{getConceptShortLabel(field)}</span>
                  <strong>{describeAverage(average)}</strong>
                  <small>
                    {dominantTag
                      ? `${getHumanTag(dominantTag.tag) ?? dominantTag.tag} dominant · ${formatPlainValue(
                          dominantTag.value,
                          "share",
                        )}`
                      : `score ${formatPlainValue(average)}`}
                    {delta != null ? ` · ${getDifferenceLabel(delta)} vs baseline` : ""}
                  </small>
                </div>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}

function DifferentiatorsCard({
  baselineRow,
  segmentRows,
  segmentField,
  profileValueFields,
}: {
  baselineRow: SurveyAnalyticsQueryRow | null;
  segmentRows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
  profileValueFields: SurveyAnalyticsFieldDefinition[];
}) {
  const strongest = segmentRows
    .filter((row) => !row.evidence.suppress_detail)
    .flatMap((row) =>
      profileValueFields.map((field) => {
        const key = metricKeyFor("avg", field);
        const segmentValue = getMetricValue(row, key);
        const baselineValue = getMetricValue(baselineRow, key);
        const delta =
          segmentValue != null && baselineValue != null ? segmentValue - baselineValue : null;

        return {
          label: `${getGroupLabel(row, segmentField?.key ?? "")} · ${getConceptShortLabel(field)}`,
          delta,
          segmentValue,
          baselineValue,
          sampleSize: row.metrics[key]?.sample_size ?? 0,
          evidence: row.evidence,
        };
      }),
    )
    .filter((entry): entry is typeof entry & { delta: number } => entry.delta != null)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 5);

  return (
    <article className="surface-card">
      <h2>Key differentiators</h2>
      <p>
        Largest deviations from the full-survey baseline. This is the first layer of explainable
        cohort analytics.
      </p>
      {strongest.length > 0 ? (
        <div className="stack-list">
          {strongest.map((entry) => (
            <div key={entry.label} className="analytics-row">
              <strong>{entry.label}</strong>
              <span>
                {getDifferenceLabel(entry.delta)} vs baseline · selected{" "}
                {formatPlainValue(entry.segmentValue)} · baseline{" "}
                {formatPlainValue(entry.baselineValue)} · n={entry.sampleSize}
                {" · "}
                <EvidenceBadge evidence={entry.evidence} />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No differentiators yet</h3>
          <p>Segment differences will appear when mapped responses are available.</p>
        </div>
      )}
    </article>
  );
}

function ConceptComparisonTable({
  baselineRow,
  segmentRows,
  segmentField,
  profileValueFields,
}: {
  baselineRow: SurveyAnalyticsQueryRow | null;
  segmentRows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
  profileValueFields: SurveyAnalyticsFieldDefinition[];
}) {
  const visibleFields = profileValueFields.slice(0, 5);

  return (
    <article className="surface-card surface-card--wide">
      <h2>Segment profile comparison</h2>
      <p>
        Compare the strongest available segment groups against the full-survey baseline. This
        answers “how is this cohort different?” without requiring a manual spreadsheet export.
      </p>
      {segmentRows.length > 0 && visibleFields.length > 0 ? (
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Segment</th>
                <th>Responses</th>
                <th>Evidence</th>
                {visibleFields.map((field) => (
                  <th key={field.key}>{getConceptShortLabel(field)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segmentRows.slice(0, MAX_BREAKDOWN_ROWS).map((row) => (
                <tr key={getGroupLabel(row, segmentField?.key ?? "")}>
                  <td>{getGroupLabel(row, segmentField?.key ?? "")}</td>
                  <td>{formatMetricValue(row.metrics.responses)}</td>
                  <td>
                    <EvidenceBadge evidence={row.evidence} />
                  </td>
                  {visibleFields.map((field) => {
                    if (row.evidence.suppress_detail) {
                      return (
                        <td key={field.key}>
                          <small>Suppressed</small>
                        </td>
                      );
                    }

                    const key = metricKeyFor("avg", field);
                    const value = getMetricValue(row, key);
                    const baseline = getMetricValue(baselineRow, key);
                    const delta = value != null && baseline != null ? value - baseline : null;

                    return (
                      <td key={field.key}>
                        <strong>{formatPlainValue(value)}</strong>
                        <small>{delta != null ? `${getDifferenceLabel(delta)} vs base` : ""}</small>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No segment comparison yet</h3>
          <p>Comparison needs at least one grouping field and one numerical profile concept.</p>
        </div>
      )}
    </article>
  );
}

function TagDistributionCard({
  tagField,
  rows,
}: {
  tagField: SurveyAnalyticsFieldDefinition | null;
  rows: SurveyAnalyticsQueryRow[];
}) {
  return (
    <article className="surface-card">
      <h2>Profile tag distribution</h2>
      <p>Low, medium and high profile bands for the first tag-enabled concept.</p>
      {tagField && rows.length > 0 ? (
        <div className="stack-list">
          {rows.map((row) => (
            <div key={`${tagField.key}-${getGroupLabel(row, tagField.key)}`} className="analytics-row">
              <strong>{getGroupLabel(row, tagField.key)}</strong>
              <span>
                {formatMetricValue(row.metrics.responses)} · sample{" "}
                {row.metrics.responses.sample_size}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No tag distribution yet</h3>
          <p>This survey currently has no tag field or no mapped responses.</p>
        </div>
      )}
    </article>
  );
}

function AssetDistributionCard({
  baselineRow,
  assetField,
}: {
  baselineRow: SurveyAnalyticsQueryRow | null;
  assetField: SurveyAnalyticsFieldDefinition | null;
}) {
  const assets = assetField
    ? FLEXPULSE_DER_ASSET_VALUES.slice(0, 8)
        .map((asset) => ({
          asset,
          metric: getMetric(baselineRow, `asset_${asset}`),
        }))
        .filter((entry) => entry.metric)
    : [];

  return (
    <article className="surface-card">
      <h2>DER asset signals</h2>
      <p>Share of mapped responses containing each DER-relevant asset value.</p>
      {assets.length > 0 ? (
        <div className="stack-list">
          {assets.map(({ asset, metric }) => (
            <div key={asset} className="analytics-row">
              <strong>{asset.replaceAll("_", " ")}</strong>
              <span>
                {metric ? formatMetricValue(metric) : "No data"} · sample{" "}
                {metric?.sample_size ?? 0}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No asset field found</h3>
          <p>Asset shares appear when the survey maps a string-array DER concept.</p>
        </div>
      )}
    </article>
  );
}

function SurveyIntelligenceHero({
  responseCount,
  countryCount,
  publishedAt,
  surveyEvidence,
  profileFields,
  baselineRow,
  segmentRows,
  segmentField,
}: {
  responseCount: number;
  countryCount: number;
  publishedAt: string | null;
  surveyEvidence: SurveyAnalyticsQueryRow["evidence"];
  profileFields: SurveyAnalyticsFieldDefinition[];
  baselineRow: SurveyAnalyticsQueryRow | null;
  segmentRows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
}) {
  const trustField = findConceptField(profileFields, ["trust"]);
  const flexibilityField = findConceptField(profileFields, ["flexibility"]);
  const comfortField = findConceptField(profileFields, ["comfort", "thermal"]);
  const flexibilityLeaders = getSegmentEntries(segmentRows, segmentField, flexibilityField);
  const comfortLeaders = getSegmentEntries(segmentRows, segmentField, comfortField);
  const trustAverage = trustField
    ? getMetricValue(baselineRow, metricKeyFor("avg", trustField))
    : null;
  const activationLeader = flexibilityLeaders[0]?.label ?? "the strongest cohort";
  const comfortBarrier = comfortLeaders[0]?.label ?? "comfort-protective cohorts";

  const headline =
    flexibilityField && comfortField
      ? `Highest flexibility average: ${activationLeader}. Highest comfort-preservation average: ${comfortBarrier}.`
      : `This survey currently exposes ${profileFields.length} primary behavioural axes.`;
  const description =
    trustAverage != null
      ? `Baseline trust in automation is ${formatPlainValue(
          trustAverage,
        )}/5 across mapped respondents. Values shown below are direct averages of mapped profile scores on a 1-5 scale.`
      : `Values shown below are direct averages of mapped profile scores on a 1-5 scale, grouped by the strongest available segment field when ranges are displayed.`;

  return (
    <section className="intelligence-hero">
      <p>
        Survey intelligence · {responseCount} respondents · {countryCount || "No"} countries ·{" "}
        {formatDateShort(publishedAt)}
      </p>
      <EvidenceBadge evidence={surveyEvidence} />
      <h2>{headline}</h2>
      <span>{description}</span>
    </section>
  );
}

function IntelligenceAxisCards({
  fields,
  baselineRow,
  segmentRows,
  segmentField,
}: {
  fields: SurveyAnalyticsFieldDefinition[];
  baselineRow: SurveyAnalyticsQueryRow | null;
  segmentRows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
}) {
  const segmentLabel = getSegmentFieldLabel(segmentField);

  return (
    <section className="intelligence-axis-grid">
      {fields.slice(0, MAX_INTELLIGENCE_AXES).map((field) => {
        const key = metricKeyFor("avg", field);
        const value = getMetricValue(baselineRow, key);
        const range = getScoreRange(segmentRows, segmentField, field);

        return (
          <article key={field.key} className="intelligence-axis-card">
            <p>{getConceptTitle(field)}</p>
            <strong>{formatPlainValue(value)}</strong>
            <span>Average mapped score across respondents · /5.0</span>
            <div className="intelligence-score-bar">
              <div style={{ width: getScoreBarWidth(value) }} />
            </div>
            <small>
              Lowest {segmentLabel} avg {formatPlainValue(range.low)} · Highest {segmentLabel} avg{" "}
              {formatPlainValue(range.high)}
            </small>
          </article>
        );
      })}
    </section>
  );
}

function IntelligenceInsights({
  baselineRow,
  segmentRows,
  segmentField,
  profileFields,
}: {
  baselineRow: SurveyAnalyticsQueryRow | null;
  segmentRows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
  profileFields: SurveyAnalyticsFieldDefinition[];
}) {
  const trustField = findConceptField(profileFields, ["trust"]);
  const flexibilityField = findConceptField(profileFields, ["flexibility"]);
  const comfortField = findConceptField(profileFields, ["comfort", "thermal"]);
  const trustLeaders = getSegmentEntries(segmentRows, segmentField, trustField);
  const flexibilityLeaders = getSegmentEntries(segmentRows, segmentField, flexibilityField);
  const comfortLeaders = getSegmentEntries(segmentRows, segmentField, comfortField);
  const trustBaseline = trustField ? getMetricValue(baselineRow, metricKeyFor("avg", trustField)) : null;
  const flexibilityBaseline = flexibilityField
    ? getMetricValue(baselineRow, metricKeyFor("avg", flexibilityField))
    : null;
  const comfortBaseline = comfortField
    ? getMetricValue(baselineRow, metricKeyFor("avg", comfortField))
    : null;
  const activationLeader = flexibilityLeaders[0] ?? trustLeaders[0] ?? null;
  const comfortBarrier = comfortLeaders[0] ?? null;

  return (
    <section className="surface-card">
      <h2>Key intelligence</h2>
      <div className="intelligence-insight-list">
        {activationLeader ? (
          <article className="intelligence-insight">
            <strong>Highest flexibility score: {activationLeader.label}</strong>
            <p>
              Average flexibility willingness for this segment is{" "}
              {formatPlainValue(activationLeader.value)} / 5 versus a survey average of{" "}
              {formatPlainValue(flexibilityBaseline ?? trustBaseline)} / 5.
            </p>
          </article>
        ) : null}
        {comfortBarrier ? (
          <article className="intelligence-insight">
            <strong>Highest comfort-preservation score: {comfortBarrier.label}</strong>
            <p>
              Average thermal comfort norms for this segment is {formatPlainValue(
                comfortBarrier.value,
              )} / 5 versus a survey average of {formatPlainValue(comfortBaseline)} / 5.
            </p>
          </article>
        ) : null}
        {!activationLeader && !comfortBarrier ? (
          <div className="empty-state empty-state--inline">
            <h3>No deterministic insight yet</h3>
            <p>Insights appear when at least one profile axis can be compared across segments.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RadarViewCard({
  fields,
  baselineRow,
  segmentRows,
  segmentField,
}: {
  fields: SurveyAnalyticsFieldDefinition[];
  baselineRow: SurveyAnalyticsQueryRow | null;
  segmentRows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
}) {
  const visibleFields = fields.slice(0, MAX_RADAR_AXES);
  const series = [
    baselineRow
      ? {
          label: "Baseline",
          colorClass: "radar-series--baseline",
          row: baselineRow,
          responses: getMetricValue(baselineRow, "responses") ?? 0,
        }
      : null,
    ...segmentRows
      .filter((row) => !row.evidence.suppress_detail)
      .slice()
      .sort((left, right) => (right.response_count ?? 0) - (left.response_count ?? 0))
      .slice(0, 2)
      .map((row, index) => ({
        label: getGroupLabel(row, segmentField?.key ?? ""),
        colorClass: index === 0 ? "radar-series--accent" : "radar-series--secondary",
        row,
        responses: row.response_count ?? 0,
      })),
  ].filter(
    (
      entry,
    ): entry is {
      label: string;
      colorClass: string;
      row: SurveyAnalyticsQueryRow;
      responses: number;
    } => Boolean(entry),
  );

  const cx = 180;
  const cy = 190;
  const radius = 118;
  const levels = [0.25, 0.5, 0.75, 1];

  if (visibleFields.length < 3 || series.length < 2) {
    return (
      <article className="surface-card radar-card">
        <h2>Radar view</h2>
        <div className="empty-state empty-state--inline">
          <h3>Not enough comparable axes yet</h3>
          <p>This chart appears when the survey exposes at least 3 primary profile axes and one segment cut.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="surface-card radar-card">
      <div className="radar-card__header">
        <div>
          <h2>Radar view</h2>
          <p>
            Baseline vs top {Math.min(2, series.length - 1)} {getSegmentFieldLabel(segmentField)} groups
            across the main profile axes.
            {fields.length > MAX_RADAR_AXES ? ` Showing first ${MAX_RADAR_AXES} axes.` : ""}
          </p>
        </div>
      </div>

      <div className="radar-chart-shell">
        <svg viewBox="0 0 360 380" role="img" aria-label="Radar comparison of baseline and top segments">
          {levels.map((level) => (
            <polygon
              key={level}
              points={buildRadarGridPolygon(visibleFields.length, cx, cy, radius * level)}
              className="radar-grid"
            />
          ))}

          {visibleFields.map((field, index) => {
            const angle = -Math.PI / 2 + (index / visibleFields.length) * Math.PI * 2;
            const axisPoint = polarPoint(cx, cy, radius, angle);
            const labelPoint = polarPoint(cx, cy, radius + 28, angle);

            return (
              <g key={field.key}>
                <line x1={cx} y1={cy} x2={axisPoint.x} y2={axisPoint.y} className="radar-axis" />
                <text x={labelPoint.x} y={labelPoint.y} className="radar-label" textAnchor="middle">
                  {getRadarAxisLabel(field)}
                </text>
              </g>
            );
          })}

          {series.map((entry) => {
            const values = visibleFields.map((field) => {
              const key = metricKeyFor("avg", field);
              return getMetricValue(entry.row, key) ?? 0;
            });

            return (
              <g key={entry.label}>
                <polygon
                  points={buildRadarPolygon(values, cx, cy, radius)}
                  className={`radar-area ${entry.colorClass}`}
                />
                <polyline
                  points={buildRadarPolygon(values, cx, cy, radius)}
                  className={`radar-line ${entry.colorClass}`}
                />
              </g>
            );
          })}
        </svg>

        <div className="radar-legend">
          {series.map((entry) => (
            <div key={entry.label} className="radar-legend__item">
              <span className={`radar-dot ${entry.colorClass}`} />
              <strong>{entry.label}</strong>
              <small>{formatCompactCount(entry.responses)} respondents</small>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function ProgressListCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<{ label: string; value: number; unit: "count" | "share" }>;
}) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <article className="surface-card intelligence-widget">
      <h2>{title}</h2>
      <p>{description}</p>
      {rows.length > 0 ? (
        <div className="intelligence-progress-list">
          {rows.map((row) => (
            <div key={row.label} className="intelligence-progress-row">
              <span>{row.label}</span>
              <strong>{row.unit === "share" ? formatPlainValue(row.value, "share") : row.value}</strong>
              <div>
                <i style={{ width: `${Math.max(2, (row.value / maxValue) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No widget data yet</h3>
          <p>This widget appears when the survey exposes the required mapped fields.</p>
        </div>
      )}
    </article>
  );
}

export default async function SurveyAnalyticsPage({
  params,
  searchParams,
}: SurveyAnalyticsPageProps) {
  const { surveyId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const survey = await getSurveyById(surveyId);

  if (!survey) {
    notFound();
  }

  const { schema, runPreview } = await getSurveyAnalyticsPageData(surveyId);

  const fieldsBySource = groupFieldsBySource(schema.fields);
  const profileValueFields = fieldsBySource.profile.filter(
    (field) => field.value_type === "number" && /^profile\.[^.]+\.value$/i.test(field.key),
  );
  const mainProfileFields = getPrimaryProfileFields(profileValueFields);
  const tagFields = fieldsBySource.profile.filter((field) => field.value_type === "tag");
  const tagProfileField = tagFields[0] ?? null;
  const assetField =
    fieldsBySource.profile.find((field) => field.value_type === "string[]") ?? null;
  const languageField =
    schema.fields.find((field) => field.key === "context.survey_language") ?? null;
  const countryField =
    schema.fields.find((field) => field.key === "context.country_code") ?? null;
  const audienceField =
    schema.fields.find((field) => field.key === "response.audience_label") ?? null;
  const primarySegmentField = countryField ?? languageField ?? audienceField ?? null;
  const segmentMetrics = buildSegmentMetrics(profileValueFields);
  const baselineMetrics = buildBaselineMetrics(profileValueFields, tagFields, assetField);
  const selectedCountry = getSearchParam(resolvedSearchParams, "country") ?? "";
  const selectedAudience = getSearchParam(resolvedSearchParams, "audience") ?? "";
  const selectedLanguage = getSearchParam(resolvedSearchParams, "language") ?? "";
  const selectedTag = getSearchParam(resolvedSearchParams, "tag") ?? "";
  const selectedAsset = getSearchParam(resolvedSearchParams, "asset") ?? "";
  const activeProfileConditions = getActiveProfileConditions(resolvedSearchParams);
  const profileConditions = getVisibleProfileConditions(resolvedSearchParams, tagFields);
  const selectedFilters = buildSelectedFilters({
    countryField,
    audienceField,
    languageField,
    tagField: tagProfileField,
    tagFields,
    assetField,
    selectedCountry,
    selectedAudience,
    selectedLanguage,
    selectedTag,
    selectedAsset,
    profileConditions: activeProfileConditions,
  });
  const hasActiveFilters = selectedFilters.length > 0;

  const hasMappedResponses = schema.ready_response_count > 0;

  const baselineProfile = hasMappedResponses
    ? runPreview({
        metrics: baselineMetrics,
      })
    : null;
  const selectedProfile = hasMappedResponses
    ? runPreview({
        filters: selectedFilters,
        metrics: baselineMetrics,
      })
    : null;
  const languageBreakdown =
    hasMappedResponses && languageField
      ? runPreview({
          group_by: [languageField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;
  const countryBreakdown =
    hasMappedResponses && countryField
      ? runPreview({
          group_by: [countryField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;
  const audienceBreakdown =
    hasMappedResponses && audienceField
      ? runPreview({
          group_by: [audienceField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;
  const profileBySegment =
    hasMappedResponses && profileValueFields.length > 0 && primarySegmentField
      ? runPreview({
          group_by: [primarySegmentField.key],
          metrics: segmentMetrics,
        })
      : null;
  const tagDistribution =
    hasMappedResponses && tagProfileField
      ? runPreview({
          group_by: [tagProfileField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;
  const selectedCountryBreakdown =
    hasMappedResponses && countryField
      ? runPreview({
          filters: selectedFilters,
          group_by: [countryField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;

  const baselineRow = getSingleGroup(baselineProfile);
  const selectedRow = getSingleGroup(selectedProfile);
  const segmentRows = profileBySegment?.result.groups ?? [];
  const countryOptions = countryField
    ? optionsFromRows(countryBreakdown?.result.groups ?? [], countryField.key)
    : [];
  const audienceOptions = audienceField
    ? optionsFromRows(audienceBreakdown?.result.groups ?? [], audienceField.key)
    : [];
  const languageOptions = languageField
    ? optionsFromRows(languageBreakdown?.result.groups ?? [], languageField.key)
    : [];
  const assetOptions = assetField
    ? FLEXPULSE_DER_ASSET_VALUES.slice(0, 8).map((asset) => ({
        value: asset,
        label: asset.replaceAll("_", " "),
      }))
    : [];
  const assetWidgetRows = assetField
    ? FLEXPULSE_DER_ASSET_VALUES.slice(0, 8)
        .map((asset) => ({
          label: asset.replaceAll("_", " "),
          value: getMetricValue(baselineRow, `asset_${asset}`),
          unit: "share" as const,
        }))
        .filter((row): row is { label: string; value: number; unit: "share" } => row.value != null)
        .sort((left, right) => right.value - left.value)
    : [];
  const countryWidgetRows =
    countryField && countryBreakdown
      ? countryBreakdown.result.groups
          .map((row) => ({
            label: getGroupLabel(row, countryField.key),
            value: row.metrics.responses.value,
            unit: "count" as const,
          }))
          .filter((row): row is { label: string; value: number; unit: "count" } => row.value != null)
          .slice(0, MAX_BREAKDOWN_ROWS)
      : [];
  const tagWidgetRows =
    tagProfileField && tagDistribution
      ? tagDistribution.result.groups
          .map((row) => ({
            label: getGroupLabel(row, tagProfileField.key),
            value: row.metrics.responses.value,
            unit: "count" as const,
          }))
          .filter((row): row is { label: string; value: number; unit: "count" } => row.value != null)
          .slice(0, MAX_BREAKDOWN_ROWS)
      : [];
  const surveyEvidence = classifySurveyAnalyticsEvidence(
    hasActiveFilters ? (selectedRow?.response_count ?? 0) : schema.ready_response_count,
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Profile Explorer"
        title={`${survey.title} profile analytics`}
        description="Explore mapped respondent profiles, compare segments, and inspect what makes each cohort different from the survey baseline."
        actions={
          <div className="button-row">
            <Link href={appRoutes.surveyDetail(survey.id)} className="button button--secondary">
              Open survey detail
            </Link>
            {survey.defaultPublicLinkUrl ? (
              <Link href={survey.defaultPublicLinkUrl} className="button button--primary">
                Open public link
              </Link>
            ) : null}
          </div>
        }
      />

      <AnalyticsTabs />

      {schema.ready_response_count === 0 ? (
        <section className="surface-card">
          <div className="empty-state">
            <h3>No mapped responses yet</h3>
            <p>
              The analytics engine is available, but cohort profiles need mapped responses in
              ready state. Use the sandbox seeder or collect responses to populate this explorer.
            </p>
            {schema.excluded_unmapped_count > 0 ? (
              <p>
                {schema.excluded_unmapped_count} response
                {schema.excluded_unmapped_count === 1 ? "" : "s"} in ready state are excluded
                because they could not be mapped yet.
              </p>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          <section id="profile-overview" className="analytics-intelligence-tab">
            <SurveyIntelligenceHero
              responseCount={
                hasActiveFilters
                  ? (selectedRow?.response_count ?? 0)
                  : schema.ready_response_count
              }
              countryCount={countryOptions.length}
              publishedAt={survey.publishedAt}
              surveyEvidence={surveyEvidence}
              profileFields={mainProfileFields}
              baselineRow={baselineRow}
              segmentRows={segmentRows}
              segmentField={primarySegmentField}
            />
            <IntelligenceAxisCards
              fields={mainProfileFields}
              baselineRow={baselineRow}
              segmentRows={segmentRows}
              segmentField={primarySegmentField}
            />
            <RadarViewCard
              fields={mainProfileFields}
              baselineRow={baselineRow}
              segmentRows={segmentRows}
              segmentField={primarySegmentField}
            />

            <div className="analytics-intelligence-layout">
              <IntelligenceInsights
                baselineRow={baselineRow}
                segmentRows={segmentRows}
                segmentField={primarySegmentField}
                profileFields={mainProfileFields}
              />
              <div className="analytics-widget-stack">
                {assetField ? (
                  <ProgressListCard
                    title="DER asset penetration"
                    description="Share of respondents reporting each mapped DER asset."
                    rows={assetWidgetRows}
                  />
                ) : null}
                {countryField ? (
                  <ProgressListCard
                    title="Respondents by country"
                    description="Respondent concentration across the strongest geographic cuts."
                    rows={countryWidgetRows}
                  />
                ) : null}
                {tagProfileField ? (
                  <ProgressListCard
                    title={`${getConceptShortLabel(tagProfileField)} distribution`}
                    description="Low, medium and high bands generated by the mapping contract."
                    rows={tagWidgetRows}
                  />
                ) : null}
              </div>
            </div>
          </section>

          <SegmentOpportunityFinder
            searchParams={resolvedSearchParams}
            tagFields={tagFields}
            conditions={profileConditions}
            activeConditions={activeProfileConditions}
            selectedRow={selectedRow}
            countryRows={selectedCountryBreakdown?.result.groups ?? []}
            countryField={countryField}
          />

          <SegmentFilterPanel
            countryOptions={countryOptions}
            audienceOptions={audienceOptions}
            languageOptions={languageOptions}
            assetOptions={assetOptions}
            selectedCountry={selectedCountry}
            selectedAudience={selectedAudience}
            selectedLanguage={selectedLanguage}
            selectedTag={selectedTag}
            selectedAsset={selectedAsset}
          />

          <section className="content-grid analytics-section-grid">
            <ProfileOverviewCard
              selectedRow={selectedRow}
              baselineRow={baselineRow}
              profileValueFields={profileValueFields}
              tagFields={tagFields}
              hasActiveFilters={hasActiveFilters}
            />
            <DifferentiatorsCard
              baselineRow={baselineRow}
              segmentRows={segmentRows}
              segmentField={primarySegmentField}
              profileValueFields={profileValueFields}
            />
          </section>

          <section id="cohort-explorer" className="content-grid">
            <BreakdownCard
              title="Cohorts by country"
              description="Where respondents are concentrated. Use this as the first geographic cut before the map layer exists."
              rows={countryBreakdown?.result.groups ?? []}
              groupField={countryField?.key ?? "context.country_code"}
              metricKeys={["responses"]}
            />
            <BreakdownCard
              title="Cohorts by audience"
              description="Compare pilot groups, public links or synthetic archetypes when the survey uses multiple audiences."
              rows={audienceBreakdown?.result.groups ?? []}
              groupField={audienceField?.key ?? "response.audience_label"}
              metricKeys={["responses"]}
            />
            <BreakdownCard
              title="Cohorts by language"
              description="Useful for checking whether language or localization splits influence the observed profile mix."
              rows={languageBreakdown?.result.groups ?? []}
              groupField={languageField?.key ?? "context.survey_language"}
              metricKeys={["responses"]}
            />
          </section>

          <section id="compare-segments">
            <ConceptComparisonTable
              baselineRow={baselineRow}
              segmentRows={segmentRows}
              segmentField={primarySegmentField}
              profileValueFields={profileValueFields}
            />
          </section>

          <section id="distributions" className="content-grid">
            <TagDistributionCard
              tagField={tagProfileField}
              rows={tagDistribution?.result.groups ?? []}
            />
            <AssetDistributionCard baselineRow={baselineRow} assetField={assetField} />
          </section>
        </>
      )}

      <section id="schema" className="content-grid">
        <article className="surface-card">
          <h2>Profile fields</h2>
          <p>Profile values and tags exposed by the measurement plan.</p>
          <RenderFieldTags
            fields={fieldsBySource.profile}
            emptyLabel="No profile fields exposed yet."
          />
        </article>

        <article className="surface-card">
          <h2>Context and grouping fields</h2>
          <p>Fields available for cuts, grouping and later map views.</p>
          <RenderFieldTags
            fields={[...fieldsBySource.context, ...fieldsBySource.response, ...fieldsBySource.geo]}
            emptyLabel="No context or grouping fields exposed yet."
          />
        </article>
      </section>

      <section className="surface-card">
        <h2>Runtime traceability</h2>
        <div className="stack-list">
          <div className="analytics-row">
            <strong>Analytics schema</strong>
            <span>{schema.schema_namespace}</span>
          </div>
          <div className="analytics-row">
            <strong>Measurement hash</strong>
            <span>{schema.measurement_hash ?? "Not available"}</span>
          </div>
          {schema.excluded_unmapped_count > 0 ? (
            <div className="analytics-row">
              <strong>Ready without mapping</strong>
              <span>
                {schema.excluded_unmapped_count} response
                {schema.excluded_unmapped_count === 1 ? "" : "s"} excluded from analytics
              </span>
            </div>
          ) : null}
          <div className="analytics-row">
            <strong>Publication state</strong>
            <span>
              {survey.publishedAt
                ? `Published on ${new Date(survey.publishedAt).toLocaleDateString("en-GB")}`
                : "Still in pre-publication state"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
