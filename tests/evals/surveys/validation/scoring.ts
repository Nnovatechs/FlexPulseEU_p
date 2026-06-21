export type ValidationEvalReportRow = {
  fixture_id: string;
  purpose: string;
  expected_overall: "pass" | "fail";
  actual_passed: boolean;
  status: "pass" | "fail";
  expected_issue_types?: Array<"pii" | "semantic" | "quality" | "prompt_injection">;
  actual_issue_types: string[];
  issues: Array<{ question_key: string; type: string; message: string }>;
};

function percentage(value: number) {
  return Math.round(value * 100);
}

function deriveVerdict(score: number) {
  if (score >= 90) return "pass" as const;
  if (score >= 75) return "warning" as const;
  return "fail" as const;
}

export function summarizeValidationEvalRows(rows: ValidationEvalReportRow[]) {
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

  const piiFixtures = rows.filter((row) => row.expected_issue_types?.includes("pii"));
  const semanticFixtures = rows.filter((row) =>
    row.expected_issue_types?.includes("semantic"),
  );
  const qualityFixtures = rows.filter((row) => row.expected_issue_types?.includes("quality"));
  const injectionFixtures = rows.filter((row) =>
    row.expected_issue_types?.includes("prompt_injection"),
  );
  const intentAwareFixtures = rows.filter((row) =>
    ["valid-trust-automation-en", "intent-drift-economic-incentive-en", "polarity-drift-frequency-tolerance-en"].includes(
      row.fixture_id,
    ),
  );

  const accuracy = rows.length === 0 ? 0 : matchedRows.length / rows.length;
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

  const piiSafetyScore =
    piiFixtures.length === 0
      ? 100
      : percentage(
          piiFixtures.filter((row) => row.actual_issue_types.includes("pii")).length /
            piiFixtures.length,
        );
  const semanticAlignmentScore =
    semanticFixtures.length === 0
      ? 100
      : percentage(
          semanticFixtures.filter((row) => row.actual_issue_types.includes("semantic")).length /
            semanticFixtures.length,
        );
  const publishabilityScore =
    qualityFixtures.length === 0
      ? 100
      : percentage(
          qualityFixtures.filter((row) => row.actual_issue_types.includes("quality")).length /
            qualityFixtures.length,
        );
  const injectionSafetyScore =
    injectionFixtures.length === 0
      ? 100
      : percentage(
          injectionFixtures.filter((row) =>
            row.actual_issue_types.includes("prompt_injection"),
          ).length / injectionFixtures.length,
        );
  const intentAlignmentScore =
    intentAwareFixtures.length === 0
      ? 100
      : percentage(intentAwareFixtures.filter((row) => row.status === "pass").length / intentAwareFixtures.length);

  const overallScore = Math.round(
    piiSafetyScore * 0.25 +
      semanticAlignmentScore * 0.25 +
      intentAlignmentScore * 0.2 +
      publishabilityScore * 0.15 +
      injectionSafetyScore * 0.15,
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
    evaluation: {
      overall_score: overallScore,
      verdict: deriveVerdict(overallScore),
      pii_safety_score: piiSafetyScore,
      semantic_alignment_score: semanticAlignmentScore,
      intent_alignment_score: intentAlignmentScore,
      publishability_score: publishabilityScore,
      injection_safety_score: injectionSafetyScore,
      strengths: [
        piiSafetyScore === 100 ? "PII controls matched all current golden expectations." : null,
        semanticAlignmentScore === 100
          ? "Semantic drift controls matched all current golden expectations."
          : null,
        positiveControlPassRate === 1
          ? "Acceptable controls passed without false positives."
          : null,
      ].filter(Boolean),
      risks: [
        intentAlignmentScore < 100
          ? "Intent-aware fixtures still show gaps when edits stay broadly energy-related."
          : null,
        publishabilityScore < 100
          ? "Publishability and wording quality controls still miss some malformed items."
          : null,
      ].filter(Boolean),
    },
    mismatch_fixture_ids: rows
      .filter((row) => row.status === "fail")
      .map((row) => row.fixture_id),
  };
}
