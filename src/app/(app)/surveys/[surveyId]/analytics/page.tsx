import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MetricGrid } from "@/components/surveys/metric-grid";
import { FLEXPULSE_DER_ASSET_VALUES } from "@/features/ontology/flexpulse-behavioural-schema";
import type {
  SurveyAnalyticsFieldDefinition,
  SurveyAnalyticsFilter,
  SurveyAnalyticsMetric,
  SurveyAnalyticsMetricResult,
  SurveyAnalyticsQueryRow,
} from "@/features/surveys/survey-analytics";
import {
  getSurveyAnalyticsSchema,
  getSurveyById,
  runSurveyAnalytics,
} from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

type SurveyAnalyticsPageProps = {
  params: Promise<{ surveyId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const TAG_VALUES = ["low", "medium", "high"] as const;
const MAX_PROFILE_CONCEPTS = 6;
const MAX_BREAKDOWN_ROWS = 6;

function formatMetricValue(metric: SurveyAnalyticsMetricResult) {
  if (metric.value == null) {
    return "No data";
  }

  if (metric.kind === "share_contains" || metric.kind === "share_equals") {
    return `${(metric.value * 100).toFixed(1)}%`;
  }

  if (Number.isInteger(metric.value)) {
    return String(metric.value);
  }

  return metric.value.toFixed(2);
}

function formatPlainValue(value: number | null | undefined, kind: "number" | "share" = "number") {
  if (value == null) {
    return "No data";
  }

  if (kind === "share") {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2);
}

function getGroupLabel(row: SurveyAnalyticsQueryRow, fieldKey: string) {
  const value = row.group[fieldKey];
  if (value == null || value === "") {
    return "Unknown";
  }
  return String(value);
}

function groupFieldsBySource(fields: SurveyAnalyticsFieldDefinition[]) {
  return {
    profile: fields.filter((field) => field.source === "profile"),
    context: fields.filter((field) => field.source === "context"),
    geo: fields.filter((field) => field.source === "geo"),
    response: fields.filter((field) => field.source === "response"),
  };
}

function getConceptShortLabel(field: SurveyAnalyticsFieldDefinition) {
  return field.label
    .replace(/\s+value$/i, "")
    .replace(/\s+tag$/i, "")
    .replace(/: .+$/, "");
}

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function getHumanTag(value: string | null | undefined) {
  switch (value) {
    case "high":
      return "alta";
    case "medium":
      return "media";
    case "low":
      return "baja";
    default:
      return null;
  }
}

function describeAverage(value: number | null | undefined) {
  if (value == null) {
    return "sin datos suficientes";
  }

  if (value >= 3.75) {
    return "alto";
  }

  if (value <= 2.25) {
    return "bajo";
  }

  return "medio";
}

function metricKeyFor(prefix: string, field: SurveyAnalyticsFieldDefinition) {
  return `${prefix}_${field.key.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "")}`;
}

function getMetric(
  row: SurveyAnalyticsQueryRow | null | undefined,
  key: string,
): SurveyAnalyticsMetricResult | null {
  return row?.metrics[key] ?? null;
}

function getSingleGroup(result: { result: { groups: SurveyAnalyticsQueryRow[] } } | null) {
  return result?.result.groups[0] ?? null;
}

function getMetricValue(
  row: SurveyAnalyticsQueryRow | null | undefined,
  key: string,
) {
  return row?.metrics[key]?.value ?? null;
}

function getDominantTag(row: SurveyAnalyticsQueryRow | null, tagField: SurveyAnalyticsFieldDefinition) {
  const values = TAG_VALUES.map((tag) => {
    const key = `${metricKeyFor("share", tagField)}_${tag}`;
    return {
      tag,
      value: getMetricValue(row, key),
    };
  }).filter((entry): entry is { tag: (typeof TAG_VALUES)[number]; value: number } => entry.value != null);

  return values.sort((left, right) => right.value - left.value)[0] ?? null;
}

function getDifferenceLabel(value: number | null) {
  if (value == null) {
    return "No comparable data";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function buildBaselineMetrics(
  profileValueFields: SurveyAnalyticsFieldDefinition[],
  tagFields: SurveyAnalyticsFieldDefinition[],
  assetField: SurveyAnalyticsFieldDefinition | null,
): SurveyAnalyticsMetric[] {
  return [
    { key: "responses", kind: "count" },
    ...profileValueFields.map((field) => ({
      key: metricKeyFor("avg", field),
      kind: "average" as const,
      field: field.key,
    })),
    ...tagFields.flatMap((field) =>
      TAG_VALUES.map((tag) => ({
        key: `${metricKeyFor("share", field)}_${tag}`,
        kind: "share_equals" as const,
        field: field.key,
        value: tag,
      })),
    ),
    ...(assetField
      ? FLEXPULSE_DER_ASSET_VALUES.slice(0, 8).map((asset) => ({
          key: `asset_${asset}`,
          kind: "share_contains" as const,
          field: assetField.key,
          value: asset,
        }))
      : []),
  ];
}

function buildSegmentMetrics(profileValueFields: SurveyAnalyticsFieldDefinition[]) {
  return [
    { key: "responses", kind: "count" as const },
    ...profileValueFields.map((field) => ({
      key: metricKeyFor("avg", field),
      kind: "average" as const,
      field: field.key,
    })),
  ];
}

function buildSelectedFilters(input: {
  countryField: SurveyAnalyticsFieldDefinition | null;
  audienceField: SurveyAnalyticsFieldDefinition | null;
  languageField: SurveyAnalyticsFieldDefinition | null;
  tagField: SurveyAnalyticsFieldDefinition | null;
  assetField: SurveyAnalyticsFieldDefinition | null;
  selectedCountry: string | null;
  selectedAudience: string | null;
  selectedLanguage: string | null;
  selectedTag: string | null;
  selectedAsset: string | null;
}): SurveyAnalyticsFilter[] {
  const filters: SurveyAnalyticsFilter[] = [];

  if (input.countryField && input.selectedCountry) {
    filters.push({ field: input.countryField.key, op: "eq", value: input.selectedCountry });
  }
  if (input.audienceField && input.selectedAudience) {
    filters.push({ field: input.audienceField.key, op: "eq", value: input.selectedAudience });
  }
  if (input.languageField && input.selectedLanguage) {
    filters.push({ field: input.languageField.key, op: "eq", value: input.selectedLanguage });
  }
  if (input.tagField && input.selectedTag) {
    filters.push({ field: input.tagField.key, op: "eq", value: input.selectedTag });
  }
  if (input.assetField && input.selectedAsset) {
    filters.push({ field: input.assetField.key, op: "contains", value: input.selectedAsset });
  }

  return filters;
}

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

function optionsFromRows(rows: SurveyAnalyticsQueryRow[], fieldKey: string) {
  return rows
    .map((row) => {
      const value = row.group[fieldKey];
      return typeof value === "string" && value.trim()
        ? { value, label: `${value} (${formatMetricValue(row.metrics.responses)})` }
        : null;
    })
    .filter((option): option is { value: string; label: string } => Boolean(option));
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
      <a href="#profile-overview">Profile overview</a>
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
                  ? `${getHumanTag(dominantTag.tag) ?? dominantTag.tag} dominante · ${formatPlainValue(
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
                  {visibleFields.map((field) => {
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

  const schema = await getSurveyAnalyticsSchema(surveyId);

  const fieldsBySource = groupFieldsBySource(schema.fields);
  const profileValueFields = fieldsBySource.profile.filter(
    (field) => field.value_type === "number" && /^profile\.[^.]+\.value$/i.test(field.key),
  );
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
  const selectedFilters = buildSelectedFilters({
    countryField,
    audienceField,
    languageField,
    tagField: tagProfileField,
    assetField,
    selectedCountry,
    selectedAudience,
    selectedLanguage,
    selectedTag,
    selectedAsset,
  });
  const hasActiveFilters = selectedFilters.length > 0;

  const [
    baselineProfile,
    selectedProfile,
    languageBreakdown,
    countryBreakdown,
    audienceBreakdown,
    profileBySegment,
    tagDistribution,
  ] = schema.ready_response_count > 0
    ? await Promise.all([
        runSurveyAnalytics(surveyId, {
          metrics: baselineMetrics,
        }),
        runSurveyAnalytics(surveyId, {
          filters: selectedFilters,
          metrics: baselineMetrics,
        }),
        languageField
          ? runSurveyAnalytics(surveyId, {
              group_by: [languageField.key],
              metrics: [{ key: "responses", kind: "count" }],
            })
          : Promise.resolve(null),
        countryField
          ? runSurveyAnalytics(surveyId, {
              group_by: [countryField.key],
              metrics: [{ key: "responses", kind: "count" }],
            })
          : Promise.resolve(null),
        audienceField
          ? runSurveyAnalytics(surveyId, {
              group_by: [audienceField.key],
              metrics: [{ key: "responses", kind: "count" }],
            })
          : Promise.resolve(null),
        profileValueFields.length > 0 && primarySegmentField
          ? runSurveyAnalytics(surveyId, {
              group_by: [primarySegmentField.key],
              metrics: segmentMetrics,
            })
          : Promise.resolve(null),
        tagProfileField
          ? runSurveyAnalytics(surveyId, {
              group_by: [tagProfileField.key],
              metrics: [{ key: "responses", kind: "count" }],
            })
          : Promise.resolve(null),
      ])
    : [null, null, null, null, null, null, null];

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

      <MetricGrid
        metrics={[
          {
            label: "Mapped responses",
            value: String(schema.ready_response_count),
            hint: "Ready profile records",
          },
          {
            label: "Profile concepts",
            value: String(profileValueFields.length),
            hint: "Numerical profile axes",
          },
          {
            label: "Segment fields",
            value: String(
              [countryField, languageField, audienceField].filter(Boolean).length,
            ),
            hint: "Country, language, audience",
          },
          {
            label: "Geo levels",
            value: String(fieldsBySource.geo.length > 0 ? schema.supported_geo_levels.length : 0),
            hint: "Supported hierarchy levels for future drill-down",
          },
        ]}
      />

      {schema.ready_response_count === 0 ? (
        <section className="surface-card">
          <div className="empty-state">
            <h3>No mapped responses yet</h3>
            <p>
              The analytics engine is available, but cohort profiles need mapped responses in
              ready state. Use the sandbox seeder or collect responses to populate this explorer.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section id="profile-overview" className="content-grid analytics-section-grid">
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
