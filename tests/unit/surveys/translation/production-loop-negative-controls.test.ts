import { describe, expect, it } from "vitest";
import { summarizeProductionTranslationLoopRows } from "../../../evals/surveys/translation/production-loop-scoring";
import { productionTranslationLoopNegativeControls } from "../../../fixtures/surveys/translation/production-loop-fixtures";

describe("production translation loop negative controls", () => {
  it.each(productionTranslationLoopNegativeControls)(
    "treats $id as a strict pipeline failure",
    (control) => {
      const finalPassed = control.final_issues.length === 0;

      expect(finalPassed).toBe(false);

      const summary = summarizeProductionTranslationLoopRows([
        {
          fixture_id: control.id,
          purpose: control.purpose,
          source_language: control.source_language,
          target_language: control.target_language,
          expected_final_pass: false,
          initial_passed: false,
          final_passed: finalPassed,
          attempts: 3,
          retry_used: true,
          recovered_after_retry: false,
          initial_issue_types: [control.final_issues[0]?.type ?? "parity"],
          final_issue_types: [...new Set(control.final_issues.map((issue) => issue.type))],
          initial_issues: control.final_issues,
          final_issues: control.final_issues,
        },
      ]);

      expect(summary.final_pass_rate).toBe(0);
      expect(summary.evaluation.risks.some((risk) => risk.includes("validator issues"))).toBe(
        true,
      );
    },
  );
});
