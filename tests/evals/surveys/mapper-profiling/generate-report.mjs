import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REPORT_VERSION = 1;
const outputRoot = path.join(process.cwd(), ".tmp", "evals");

async function readJson(relativePath) {
  const filePath = path.join(outputRoot, relativePath);
  return JSON.parse(await readFile(filePath, "utf8"));
}

function rateFromRow(report, checkId) {
  const row = report.rows.find((candidate) => candidate.check_id === checkId);
  if (!row) {
    throw new Error(`Missing report row "${checkId}".`);
  }

  return row.checks === 0 ? 1 : row.matches / row.checks;
}

function kpi({
  id,
  category,
  label,
  value,
  threshold,
  source,
  direction = "gte",
  unit = "rate",
}) {
  const passed = direction === "gte" ? value >= threshold : value <= threshold;

  return {
    id,
    category,
    label,
    value,
    unit,
    threshold,
    direction,
    status: passed ? "pass" : "fail",
    source,
  };
}

function formatValue(value, unit) {
  if (unit === "count") {
    return String(value);
  }

  return `${(value * 100).toFixed(1)}%`;
}

function buildMarkdown(report) {
  const lines = [
    "# Mapper and Profiling KPI Report",
    "",
    `Generated at: ${report.generated_at}`,
    "",
    "## Dataset",
    "",
    `- Golden personas: ${report.dataset.golden_personas}`,
    `- Synthetic cohort respondents: ${report.dataset.synthetic_cohort_respondents}`,
    `- Synthetic archetypes: ${report.dataset.synthetic_archetypes}`,
    `- Total evaluated response records: ${report.dataset.total_evaluated_response_records}`,
    "",
    "## KPI Summary",
    "",
    `- KPI count: ${report.summary.kpi_count}`,
    `- Passed KPIs: ${report.summary.passed_kpi_count}`,
    `- Failed KPIs: ${report.summary.failed_kpi_count}`,
    `- KPI pass rate: ${formatValue(report.summary.kpi_pass_rate, "rate")}`,
    "",
    "| Category | KPI | Value | Threshold | Status |",
    "| --- | --- | ---: | ---: | --- |",
    ...report.kpis.map((entry) =>
      [
        entry.category,
        entry.label,
        formatValue(entry.value, entry.unit),
        formatValue(entry.threshold, entry.unit),
        entry.status,
      ].join(" | "),
    ),
    "",
    "## Source Reports",
    "",
    ...report.source_reports.map((source) => `- ${source}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const mapperReport = await readJson("mapper/latest/report.json");
const profilingReport = await readJson("profiling/latest/report.json");
const syntheticReport = await readJson("synthetic-cohorts/latest/report.json");

const kpis = [
  kpi({
    id: "mapper_profile_exact_match_rate",
    category: "Mapper correctness",
    label: "Full profile exact match rate",
    value: mapperReport.exact_profile_pass_rate,
    threshold: 1,
    source: "mapper/latest/report.json",
  }),
  kpi({
    id: "mapper_value_exact_match_rate",
    category: "Mapper correctness",
    label: "Canonical value exact match rate",
    value: mapperReport.value_exact_match_rate,
    threshold: 1,
    source: "mapper/latest/report.json",
  }),
  kpi({
    id: "mapper_tag_exact_match_rate",
    category: "Mapper correctness",
    label: "Derived tag exact match rate",
    value: mapperReport.tag_exact_match_rate,
    threshold: 1,
    source: "mapper/latest/report.json",
  }),
  kpi({
    id: "mapper_facet_exact_match_rate",
    category: "Mapper correctness",
    label: "Facet exact match rate",
    value: mapperReport.facet_exact_match_rate,
    threshold: 1,
    source: "mapper/latest/report.json",
  }),
  kpi({
    id: "profiling_schema_contract_rate",
    category: "Analytics consistency",
    label: "Schema field contract pass rate",
    value: rateFromRow(profilingReport, "schema_fields"),
    threshold: 1,
    source: "profiling/latest/report.json",
  }),
  kpi({
    id: "profiling_small_cohort_recovery_rate",
    category: "Analytics consistency",
    label: "Small cohort recovery pass rate",
    value: rateFromRow(profilingReport, "country_cohort_recovery"),
    threshold: 1,
    source: "profiling/latest/report.json",
  }),
  kpi({
    id: "profiling_filter_geo_rate",
    category: "Analytics consistency",
    label: "Filter and geo grouping pass rate",
    value: rateFromRow(profilingReport, "filters_and_geo_grouping"),
    threshold: 1,
    source: "profiling/latest/report.json",
  }),
  kpi({
    id: "synthetic_archetype_band_recovery_rate",
    category: "Synthetic cohort recovery",
    label: "Archetype band recovery rate",
    value: rateFromRow(syntheticReport, "archetype_band_recovery"),
    threshold: 0.95,
    source: "synthetic-cohorts/latest/report.json",
  }),
  kpi({
    id: "synthetic_aggregate_consistency_rate",
    category: "Synthetic cohort recovery",
    label: "Analytics vs independent aggregate consistency",
    value: rateFromRow(syntheticReport, "aggregate_consistency"),
    threshold: 1,
    source: "synthetic-cohorts/latest/report.json",
  }),
  kpi({
    id: "synthetic_ranking_contradiction_rate",
    category: "Synthetic cohort recovery",
    label: "Ranking and contradictory facet recovery rate",
    value: rateFromRow(syntheticReport, "ranking_and_contradiction_recovery"),
    threshold: 1,
    source: "synthetic-cohorts/latest/report.json",
  }),
  kpi({
    id: "synthetic_sparse_response_rate",
    category: "Robustness",
    label: "Sparse response handling pass rate",
    value: rateFromRow(syntheticReport, "sparse_response_handling"),
    threshold: 1,
    source: "synthetic-cohorts/latest/report.json",
  }),
  kpi({
    id: "synthetic_cohort_respondent_count",
    category: "Dataset coverage",
    label: "Synthetic cohort respondent count",
    value: syntheticReport.respondent_count,
    threshold: 250,
    source: "synthetic-cohorts/latest/report.json",
    unit: "count",
  }),
  kpi({
    id: "synthetic_archetype_count",
    category: "Dataset coverage",
    label: "Synthetic archetype count",
    value: syntheticReport.archetype_count,
    threshold: 8,
    source: "synthetic-cohorts/latest/report.json",
    unit: "count",
  }),
];

const passedKpis = kpis.filter((entry) => entry.status === "pass").length;
const report = {
  report_version: REPORT_VERSION,
  generated_at: new Date().toISOString(),
  scope: {
    system_under_eval: ["response_mapper", "survey_analytics"],
    evaluation_type: [
      "golden_contract_dataset",
      "deterministic_synthetic_cohort_dataset",
    ],
    excluded_from_scope: [
      "real_population_validation",
      "field-study calibration",
      "database persistence wiring",
    ],
  },
  dataset: {
    golden_personas: mapperReport.persona_count,
    synthetic_cohort_respondents: syntheticReport.respondent_count,
    synthetic_archetypes: syntheticReport.archetype_count,
    total_evaluated_response_records:
      mapperReport.persona_count + syntheticReport.respondent_count,
  },
  summary: {
    kpi_count: kpis.length,
    passed_kpi_count: passedKpis,
    failed_kpi_count: kpis.length - passedKpis,
    kpi_pass_rate: kpis.length === 0 ? 1 : passedKpis / kpis.length,
  },
  kpis,
  source_reports: [
    ".tmp/evals/mapper/latest/report.json",
    ".tmp/evals/profiling/latest/report.json",
    ".tmp/evals/synthetic-cohorts/latest/report.json",
  ],
};

const outputDir = path.join(outputRoot, "mapper-profiling", "latest");
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(outputDir, "summary.md"), buildMarkdown(report));
