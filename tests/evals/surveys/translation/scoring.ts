export type TranslationEvalReportRow = {
  fixture_id: string;
  purpose: string;
  source_language: string;
  target_language: string;
  expected_overall: "pass" | "fail";
  actual_passed: boolean;
  status: "pass" | "fail";
  expected_issue_types?: Array<"parity" | "quality" | "pii" | "cultural">;
  actual_issue_types: string[];
  issues: Array<{ language: string; question_key?: string; type: string; message: string }>;
};

const CANONICAL_LANGUAGES = ["English", "Spanish", "French", "Croatian"] as const;

function percentage(value: number) {
  return Math.round(value * 100);
}

function deriveVerdict(score: number) {
  if (score >= 90) return "pass" as const;
  if (score >= 75) return "warning" as const;
  return "fail" as const;
}

function buildPerLanguageRates(
  rows: TranslationEvalReportRow[],
  predicate: (row: TranslationEvalReportRow) => boolean,
  success: (row: TranslationEvalReportRow) => boolean,
) {
  return rows.reduce<
    Record<
      string,
      {
        fixture_count: number;
        matched_count: number;
        rate: number;
      }
    >
  >((summary, row) => {
    if (!predicate(row)) {
      return summary;
    }

    const current = summary[row.target_language] ?? {
      fixture_count: 0,
      matched_count: 0,
      rate: 0,
    };
    current.fixture_count += 1;
    current.matched_count += success(row) ? 1 : 0;
    current.rate =
      current.fixture_count === 0 ? 0 : current.matched_count / current.fixture_count;
    summary[row.target_language] = current;
    return summary;
  }, {});
}

export function summarizeTranslationEvalRows(rows: TranslationEvalReportRow[]) {
  const positiveControls = rows.filter((row) => row.expected_overall === "pass");
  const negativeControls = rows.filter((row) => row.expected_overall === "fail");
  const matchedRows = rows.filter((row) => row.status === "pass");
  const issueTypeExpectationRows = rows.filter(
    (row) => (row.expected_issue_types?.length ?? 0) > 0,
  );

  const issueCountsByType = rows.reduce<Record<string, number>>((counts, row) => {
    for (const issueType of row.actual_issue_types) {
      counts[issueType] = (counts[issueType] ?? 0) + 1;
    }
    return counts;
  }, {});

  const positiveControlPassRate =
    positiveControls.length === 0
      ? 1
      : positiveControls.filter((row) => row.actual_passed).length / positiveControls.length;
  const negativeControlDetectionRate =
    negativeControls.length === 0
      ? 1
      : negativeControls.filter((row) => !row.actual_passed).length /
        negativeControls.length;
  const issueTypeMatchRate =
    issueTypeExpectationRows.length === 0
      ? 1
      : issueTypeExpectationRows.filter((row) =>
          (row.expected_issue_types ?? []).every((type) =>
            row.actual_issue_types.includes(type),
          ),
        ).length / issueTypeExpectationRows.length;

  const parityFixtures = rows.filter((row) => row.expected_issue_types?.includes("parity"));
  const qualityFixtures = rows.filter((row) => row.expected_issue_types?.includes("quality"));
  const piiFixtures = rows.filter((row) => row.expected_issue_types?.includes("pii"));
  const culturalFixtures = rows.filter((row) => row.expected_issue_types?.includes("cultural"));

  const observedSourceLanguages = new Set(rows.map((row) => row.source_language));
  const observedTargetLanguages = new Set(rows.map((row) => row.target_language));
  const sourceLanguageCoverageScore = percentage(
    CANONICAL_LANGUAGES.filter((language) => observedSourceLanguages.has(language)).length /
      CANONICAL_LANGUAGES.length,
  );
  const targetLanguageCoverageScore = percentage(
    CANONICAL_LANGUAGES.filter((language) => observedTargetLanguages.has(language)).length /
      CANONICAL_LANGUAGES.length,
  );

  const semanticParityScore =
    parityFixtures.length === 0
      ? 100
      : percentage(
          parityFixtures.filter((row) => row.actual_issue_types.includes("parity")).length /
            parityFixtures.length,
        );
  const naturalLocalizationScore = Math.round(
    percentage(positiveControlPassRate) * 0.7 +
      (qualityFixtures.length === 0
        ? 100
        : percentage(
            qualityFixtures.filter((row) => row.actual_issue_types.includes("quality")).length /
              qualityFixtures.length,
          )) *
        0.3,
  );
  const piiSafetyScore =
    piiFixtures.length === 0
      ? 100
      : percentage(
          piiFixtures.filter((row) => row.actual_issue_types.includes("pii")).length /
            piiFixtures.length,
        );
  const culturalLocalizationScore =
    culturalFixtures.length === 0
      ? null
      : percentage(
          culturalFixtures.filter((row) => row.actual_issue_types.includes("cultural")).length /
            culturalFixtures.length,
        );

  const languagePositiveControlPassRates = buildPerLanguageRates(
    rows,
    (row) => row.expected_overall === "pass",
    (row) => row.actual_passed,
  );
  const languageNegativeControlDetectionRates = buildPerLanguageRates(
    rows,
    (row) => row.expected_overall === "fail",
    (row) => !row.actual_passed,
  );
  const languageIssueTypeMatchRates = buildPerLanguageRates(
    rows,
    (row) => (row.expected_issue_types?.length ?? 0) > 0,
    (row) =>
      (row.expected_issue_types ?? []).every((type) =>
        row.actual_issue_types.includes(type),
      ),
  );

  const accuracy = rows.length === 0 ? 0 : matchedRows.length / rows.length;
  const overallScore = Math.round(
    semanticParityScore * 0.3 +
      naturalLocalizationScore * 0.25 +
      piiSafetyScore * 0.2 +
      sourceLanguageCoverageScore * 0.1 +
      targetLanguageCoverageScore * 0.1 +
      (culturalLocalizationScore ?? 80) * 0.05,
  );

  return {
    fixture_count: rows.length,
    accuracy,
    positive_control_count: positiveControls.length,
    positive_control_pass_rate: positiveControlPassRate,
    negative_control_count: negativeControls.length,
    negative_control_detection_rate: negativeControlDetectionRate,
    issue_type_match_rate: issueTypeMatchRate,
    issue_counts_by_type: issueCountsByType,
    language_positive_control_pass_rates: languagePositiveControlPassRates,
    language_negative_control_detection_rates: languageNegativeControlDetectionRates,
    language_issue_type_match_rates: languageIssueTypeMatchRates,
    evaluation: {
      overall_score: overallScore,
      verdict: deriveVerdict(overallScore),
      semantic_parity_score: semanticParityScore,
      natural_localization_score: naturalLocalizationScore,
      pii_safety_score: piiSafetyScore,
      cultural_localization_score: culturalLocalizationScore,
      cultural_bias_detection_rate:
        culturalFixtures.length === 0
          ? null
          : culturalFixtures.filter((row) => row.actual_issue_types.includes("cultural")).length /
            culturalFixtures.length,
      source_language_coverage_score: sourceLanguageCoverageScore,
      target_language_coverage_score: targetLanguageCoverageScore,
      strengths: [
        semanticParityScore === 100
          ? "Current parity-drift fixtures are being detected consistently."
          : null,
        positiveControlPassRate === 1
          ? "Natural localized controls are passing without false positives."
          : null,
        piiSafetyScore === 100
          ? "Added-PII controls are being detected consistently."
          : null,
        culturalLocalizationScore === 100
          ? "The stable cultural battery is being classified as cultural rather than being absorbed into parity."
          : null,
      ].filter(Boolean),
      risks: [
        culturalLocalizationScore == null
          ? "There is still no stable cultural-specific golden set scored separately from parity."
          : culturalLocalizationScore < 100
            ? "Some cultural-bias fixtures are still being absorbed into parity or other issue types."
          : null,
        sourceLanguageCoverageScore < 100
          ? "Not all canonical languages are yet covered as source languages."
          : null,
        targetLanguageCoverageScore < 100
          ? "Not all canonical languages are yet covered as target languages."
          : null,
      ].filter(Boolean),
    },
    mismatch_fixture_ids: rows
      .filter((row) => row.status === "fail")
      .map((row) => row.fixture_id),
  };
}
