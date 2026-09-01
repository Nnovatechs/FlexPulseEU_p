import { INSTRUMENT_HEALTH_METHODOLOGY_VERSION, INSTRUMENT_HEALTH_POLICY_V1 } from "@/features/surveys/analytics/instrument-health-semantics";

export default function InstrumentHealthMethodologyPage() {
  const policy = INSTRUMENT_HEALTH_POLICY_V1;
  const concentration = Math.round(policy.topTwoConcentrationAtOrAbove * 100);
  const citc = policy.correctedItemTotalReviewBelow.toFixed(2);
  const spread = policy.lowItemSpreadBelow.toFixed(2);
  const htmt = policy.htmtOverlapAtOrAbove.toFixed(2);

  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="legal-eyebrow">Instrument Health</p>
        <h1>How Instrument Health works</h1>
        <p>
          Instrument Health brings together evidence about scoring integrity, response
          distributions, item coherence and construct relationships for the current survey
          version.
        </p>
        <p>
          The analysis follows the measurement structure defined for each construct. Reflective
          candidates receive internal-consistency and item-coherence analysis. Descriptive
          composites are summarised through their component distributions. Conditional modules
          are evaluated using the respondents and items applicable to each module.
        </p>

        <section>
          <h2>Analysis signals</h2>
          <p>FlexPulse highlights patterns that are useful during instrument review:</p>
          <ul>
            <li>
              Upper-end concentration: at least {concentration}% of valid responses are in
              categories 4–5.
            </li>
            <li>
              Lower-end concentration: at least {concentration}% of valid responses are in
              categories 1–2.
            </li>
            <li>Low response spread: the item standard deviation is below {spread}.</li>
            <li>
              Item-total relationship: reflective items are compared with the remaining items in
              their construct, using {citc} as the review reference.
            </li>
            <li>
              Construct overlap: HTMT uses {htmt} as the screening reference. Each pair reports its
              complete-case n. Overlap signals follow the sample-adequacy cuts below.
            </li>
          </ul>
          <p>
            These signals are considered together with construct purpose, sample composition,
            linguistic review, cognitive feedback and subsequent validation evidence.
          </p>
        </section>

        <section>
          <h2>Measurement roles</h2>
          <ul>
            <li>
              Reflective candidate: a construct that can be examined with alpha, corrected
              item-total correlations and HTMT when enough items are present.
            </li>
            <li>
              Descriptive composite: a profile score summarised through its component
              distributions. Internal consistency is not used as a decision criterion.
            </li>
            <li>
              Conditional module: items that apply only to some respondents. Coverage and scores
              are reported by applicable group, not as a single global scale.
            </li>
            <li>Single item: reliability statistics that require multiple items are omitted.</li>
          </ul>
        </section>

        <section>
          <h2>What is calculated</h2>
          <p>
            For each construct the analysis reports coverage, median, IQR and SD. Reflective
            candidates also receive Cronbach’s alpha with a bootstrap confidence interval,
            average inter-item correlation, corrected item-total range, and alpha-if-deleted.
            Item detail keeps the full 1–5 distribution, exact floor and ceiling, polarity and
            reverse scoring, plus eligible, answered and missing counts.
          </p>
        </section>

        <section>
          <h2>Sample adequacy</h2>
          <p>
            Small samples never hide descriptive results. The n used for each statistic stays visible.
            Sample thresholds only control whether automated review signals are activated:
          </p>
          <ul>
            <li>
              n &lt; {policy.sampleAdequacy.descriptiveOnlyBelow}: descriptives, alpha and HTMT remain
              visible when they can be computed. Concentration, zero-variance, item-total and HTMT
              overlap signals stay inactive.
            </li>
            <li>
              n {policy.sampleAdequacy.descriptiveOnlyBelow}–{policy.sampleAdequacy.fullScreeningAtOrAbove - 1}:
              distribution and overlap signals may appear, labelled as a preliminary distribution.
            </li>
            <li>
              n ≥ {policy.sampleAdequacy.fullScreeningAtOrAbove}: the standard screening policy applies.
            </li>
          </ul>
          <p>
            These cuts are applied to the applicable n of the item, module or HTMT pair, not to the
            survey total.
          </p>
        </section>

        <section>
          <h2>Conditional modules</h2>
          <p>
            Conditional modules use the respondents and items that apply to each group. Coverage and
            scores are reported by applicable group, not as a single global scale.
          </p>
        </section>

        <section>
          <h2>Reproducibility</h2>
          <p>
            Each analysis records the survey version, measurement hash, mapping hash and
            analysis-methodology version used to produce the results. This keeps results
            reproducible as the platform evolves.
          </p>
        </section>

        <p className="legal-meta">Methodology version {INSTRUMENT_HEALTH_METHODOLOGY_VERSION}</p>
      </article>
    </main>
  );
}
