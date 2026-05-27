export type ProductionTranslationLoopEvalRow = {
  fixture_id: string;
  purpose: string;
  source_language: string;
  target_language: string;
  expected_final_pass: boolean;
  initial_passed: boolean;
  final_passed: boolean;
  attempts: number;
  retry_used: boolean;
  recovered_after_retry: boolean;
  initial_issue_types: string[];
  final_issue_types: string[];
  initial_issues: Array<{ language: string; question_key?: string; type: string; message: string }>;
  final_issues: Array<{ language: string; question_key?: string; type: string; message: string }>;
};

function countRowsWithIssueType(
  rows: ProductionTranslationLoopEvalRow[],
  issueType: string,
  stage: "initial" | "final",
) {
  const field = stage === "initial" ? "initial_issue_types" : "final_issue_types";
  return rows.filter((row) => row[field].includes(issueType)).length;
}

function rate(matched: number, total: number) {
  return total === 0 ? 0 : matched / total;
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deriveVerdict(score: number) {
  if (score >= 90) return "pass" as const;
  if (score >= 75) return "warning" as const;
  return "fail" as const;
}

function buildPerLanguageSummary(rows: ProductionTranslationLoopEvalRow[]) {
  return rows.reduce<
    Record<
      string,
      {
        fixture_count: number;
        initial_passed_count: number;
        final_passed_count: number;
        retried_count: number;
        recovered_count: number;
        average_attempts: number;
        initial_pass_rate: number;
        final_pass_rate: number;
        retry_trigger_rate: number;
        retry_recovery_rate: number;
      }
    >
  >((summary, row) => {
    const current = summary[row.target_language] ?? {
      fixture_count: 0,
      initial_passed_count: 0,
      final_passed_count: 0,
      retried_count: 0,
      recovered_count: 0,
      average_attempts: 0,
      initial_pass_rate: 0,
      final_pass_rate: 0,
      retry_trigger_rate: 0,
      retry_recovery_rate: 0,
    };

    current.fixture_count += 1;
    current.initial_passed_count += row.initial_passed ? 1 : 0;
    current.final_passed_count += row.final_passed ? 1 : 0;
    current.retried_count += row.retry_used ? 1 : 0;
    current.recovered_count += row.recovered_after_retry ? 1 : 0;
    current.average_attempts =
      (current.average_attempts * (current.fixture_count - 1) + row.attempts) /
      current.fixture_count;
    current.initial_pass_rate = rate(current.initial_passed_count, current.fixture_count);
    current.final_pass_rate = rate(current.final_passed_count, current.fixture_count);
    current.retry_trigger_rate = rate(current.retried_count, current.fixture_count);
    current.retry_recovery_rate = rate(current.recovered_count, current.retried_count);
    summary[row.target_language] = current;
    return summary;
  }, {});
}

export function summarizeProductionTranslationLoopRows(
  rows: ProductionTranslationLoopEvalRow[],
) {
  const initialPassRate = rate(
    rows.filter((row) => row.initial_passed).length,
    rows.length,
  );
  const finalPassRate = rate(
    rows.filter((row) => row.final_passed).length,
    rows.length,
  );
  const retriedRows = rows.filter((row) => row.retry_used);
  const retryTriggerRate = rate(retriedRows.length, rows.length);
  const retryRecoveryRate = rate(
    retriedRows.filter((row) => row.recovered_after_retry).length,
    retriedRows.length,
  );
  const averageAttempts = average(rows.map((row) => row.attempts));

  const finalParityFailureRate = rate(countRowsWithIssueType(rows, "parity", "final"), rows.length);
  const finalQualityFailureRate = rate(
    countRowsWithIssueType(rows, "quality", "final"),
    rows.length,
  );
  const finalCulturalFailureRate = rate(
    countRowsWithIssueType(rows, "cultural", "final"),
    rows.length,
  );
  const finalPiiFailureRate = rate(countRowsWithIssueType(rows, "pii", "final"), rows.length);

  const semanticParityScore = Math.max(0, 100 - finalParityFailureRate * 100);
  const publishabilityScore = Math.max(0, 100 - finalQualityFailureRate * 100);
  const culturalLocalizationScore = Math.max(0, 100 - finalCulturalFailureRate * 100);
  const piiSafetyScore = Math.max(0, 100 - finalPiiFailureRate * 100);
  const firstPassLocalizationScore = Math.round(initialPassRate * 100);
  const retryRecoveryScore = Math.round(
    (retriedRows.length === 0 ? finalPassRate : retryRecoveryRate) * 100,
  );
  const finalPublishableOutputScore = Math.round(finalPassRate * 100);
  const overallScore = Math.round(
    finalPublishableOutputScore * 0.4 +
      firstPassLocalizationScore * 0.15 +
      retryRecoveryScore * 0.15 +
      semanticParityScore * 0.15 +
      culturalLocalizationScore * 0.1 +
      piiSafetyScore * 0.05,
  );

  const strengths: string[] = [];
  const risks: string[] = [];

  if (finalPassRate >= 0.9) {
    strengths.push("The production localization loop usually reaches a validator-clean final draft.");
  } else {
    risks.push("Too many target-language runs still end with validator issues after the retry loop.");
  }

  if (retriedRows.length === 0 || retryRecoveryRate >= 0.75) {
    strengths.push("When retries are needed, validator feedback usually helps the translator converge.");
  } else {
    risks.push("Retry feedback is not reliably recovering failed first drafts.");
  }

  if (initialPassRate >= 0.7) {
    strengths.push("Most first-pass translations are already close to publishable without revision.");
  } else {
    risks.push("First-pass translations still need too many validator-guided revisions.");
  }

  if (finalCulturalFailureRate > 0.2) {
    risks.push("Cultural localization problems still survive into some final outputs.");
  }

  if (finalPiiFailureRate === 0) {
    strengths.push("No final localized outputs introduced new personal-data collection requests.");
  }

  return {
    fixture_count: rows.length,
    initial_pass_rate: initialPassRate,
    final_pass_rate: finalPassRate,
    retry_trigger_rate: retryTriggerRate,
    retry_recovery_rate: retryRecoveryRate,
    average_attempts: averageAttempts,
    final_issue_counts_by_type: rows.flatMap((row) => row.final_issue_types).reduce<Record<string, number>>(
      (summary, issueType) => {
        summary[issueType] = (summary[issueType] ?? 0) + 1;
        return summary;
      },
      {},
    ),
    initial_issue_counts_by_type: rows.flatMap((row) => row.initial_issue_types).reduce<Record<string, number>>(
      (summary, issueType) => {
        summary[issueType] = (summary[issueType] ?? 0) + 1;
        return summary;
      },
      {},
    ),
    language_loop_kpis: buildPerLanguageSummary(rows),
    evaluation: {
      overall_score: overallScore,
      verdict: deriveVerdict(overallScore),
      first_pass_localization_score: firstPassLocalizationScore,
      retry_recovery_score: retryRecoveryScore,
      final_publishable_output_score: finalPublishableOutputScore,
      semantic_parity_score: semanticParityScore,
      publishability_score: publishabilityScore,
      cultural_localization_score: culturalLocalizationScore,
      pii_safety_score: piiSafetyScore,
      strengths,
      risks,
    },
  };
}
