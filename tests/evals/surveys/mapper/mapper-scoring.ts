type MapperEvalRow = {
  persona_id: string;
  value_checks: number;
  value_matches: number;
  tag_checks: number;
  tag_matches: number;
  facet_checks: number;
  facet_matches: number;
  status: "pass" | "fail";
};

function rate(matches: number, checks: number) {
  return checks === 0 ? 1 : matches / checks;
}

export function summarizeMapperEvalRows(rows: MapperEvalRow[]) {
  const totals = rows.reduce(
    (accumulator, row) => ({
      value_checks: accumulator.value_checks + row.value_checks,
      value_matches: accumulator.value_matches + row.value_matches,
      tag_checks: accumulator.tag_checks + row.tag_checks,
      tag_matches: accumulator.tag_matches + row.tag_matches,
      facet_checks: accumulator.facet_checks + row.facet_checks,
      facet_matches: accumulator.facet_matches + row.facet_matches,
    }),
    {
      value_checks: 0,
      value_matches: 0,
      tag_checks: 0,
      tag_matches: 0,
      facet_checks: 0,
      facet_matches: 0,
    },
  );

  return {
    persona_count: rows.length,
    pass_count: rows.filter((row) => row.status === "pass").length,
    exact_profile_pass_rate: rate(
      rows.filter((row) => row.status === "pass").length,
      rows.length,
    ),
    value_exact_match_rate: rate(totals.value_matches, totals.value_checks),
    tag_exact_match_rate: rate(totals.tag_matches, totals.tag_checks),
    facet_exact_match_rate: rate(totals.facet_matches, totals.facet_checks),
    totals,
  };
}
