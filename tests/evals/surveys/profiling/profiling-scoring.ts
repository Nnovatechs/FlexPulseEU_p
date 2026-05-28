type ProfilingEvalRow = {
  check_id: string;
  checks: number;
  matches: number;
  status: "pass" | "fail";
};

function rate(matches: number, checks: number) {
  return checks === 0 ? 1 : matches / checks;
}

export function summarizeProfilingEvalRows(rows: ProfilingEvalRow[]) {
  const checks = rows.reduce((sum, row) => sum + row.checks, 0);
  const matches = rows.reduce((sum, row) => sum + row.matches, 0);
  const passCount = rows.filter((row) => row.status === "pass").length;

  return {
    check_count: rows.length,
    pass_count: passCount,
    check_pass_rate: rate(passCount, rows.length),
    aggregate_exact_match_rate: rate(matches, checks),
    totals: {
      checks,
      matches,
    },
  };
}
