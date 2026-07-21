import Link from "next/link";
import { getLegalConfig } from "@/lib/config/legal";
import { getRawLocationRetentionLabel } from "@/lib/config/response-retention";

export default function PrivacyPage() {
  const legal = getLegalConfig();
  const rawLocationRetentionLabel = getRawLocationRetentionLabel();

  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="legal-eyebrow">Privacy information</p>
        <h1>FlexPulseEU platform privacy</h1>
        <p>
          This page explains how this deployment of FlexPulseEU operates the
          technical platform. Each public survey also provides a
          survey-specific privacy notice identifying its data controller.
        </p>
        <p>
          Privacy notice version: <strong>{legal.privacyNoticeVersion}</strong>.
        </p>

        <section>
          <h2>Who operates this platform?</h2>
          <p>
            <strong>{legal.processorName}</strong> operates this deployment of
            FlexPulseEU and provides the technical survey infrastructure.
          </p>
          {legal.privacyEmail ? (
            <p>
              Platform privacy contact:{" "}
              <a href={`mailto:${legal.privacyEmail}`}>
                {legal.privacyEmail}
              </a>
            </p>
          ) : null}
        </section>

        <section>
          <h2>What role does FlexPulseEU have?</h2>
          <p>
            <strong>{legal.processorName}</strong> provides and operates the
            technical platform used to collect, store, process, and analyse survey
            responses on behalf of the controller identified in each survey&apos;s
            privacy notice.
          </p>
          <p>
            FlexPulseEU does not use individual respondent answers for unrelated
            secondary purposes, cross-customer benchmarking, or product training in
            this stage.
          </p>
        </section>

        <section>
          <h2>What data is collected?</h2>
          <p>
            The survey collects the answers you submit. Some surveys may also ask
            for regional context such as country and postal code, only for
            aggregated research and analysis.
          </p>
          <p>
            Public submissions are protected with bot-prevention checks to reduce
            automated abuse.
          </p>
          <p>
            When you submit a public survey, the platform stores a consent record
            with the response, including the time of submission, the consent text
            shown in the form, and the privacy/cookie notice versions accepted.
            The platform does not ask public respondents for names, email
            addresses, account identifiers, or signatures.
          </p>
        </section>

        <section>
          <h2>How is the data used?</h2>
          <p>
            Responses are used to run the survey, process submitted answers, and
            produce aggregated research or analytics for the controller. Published
            analytics should not identify individual respondents.
          </p>
          <p>
            Regional context may be normalized or enriched with external context
            such as approximate weather/location information. Raw country and
            postal-code inputs are retained temporarily for this processing,
            marked for cleanup after {rawLocationRetentionLabel}, and handled
            through a protected internal cleanup process.
          </p>
          <p>
            Responses and derived mappings are retained only for as long as
            necessary to conduct, validate, and document the stated research,
            after which they are deleted or irreversibly anonymised.
          </p>
        </section>

        <section>
          <h2>Legal basis and consent</h2>
          <p>
            Participation is voluntary. By ticking the consent box before
            submission, you consent to the processing of your survey response for
            the stated research, validation, and aggregated analytics purposes.
            You may withdraw consent later by contacting the survey controller
            identified in the survey-specific privacy notice. Withdrawal does
            not affect processing already performed before withdrawal.
          </p>
        </section>

        <section>
          <h2>Service providers</h2>
          <p>
            This deployment may use hosted infrastructure and security services
            such as Vercel, Supabase, Cloudflare Turnstile, and Open-Meteo to run
            the application, store responses, protect public submissions, and
            enrich regional context. These services are used only for operating
            the survey workflow and related analysis.
          </p>
        </section>

        <section>
          <h2>Your choices and rights</h2>
          <p>
            Participation is voluntary. If you do not agree with this information,
            do not submit the survey. For questions about the operation of this
            platform, contact{" "}
            {legal.privacyEmail ? (
              <a href={`mailto:${legal.privacyEmail}`}>
                {legal.privacyEmail}
              </a>
            ) : (
              "the platform operator"
            )}
            .
          </p>
          <p>
            Depending on applicable law and the data that can be linked to your
            response, you may request access, deletion, restriction, objection, or
            withdrawal of consent through the controller contact.
          </p>
        </section>

        <section>
          <h2>Cookies</h2>
          <p>
            See the <Link href={legal.cookiesUrl}>cookie notice</Link> for the
            cookies and similar technologies used by this deployment.
          </p>
        </section>
      </article>
    </main>
  );
}
