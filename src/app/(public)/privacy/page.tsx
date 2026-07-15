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
        <h1>Data protection and survey participation</h1>
        <p>
          This page explains the basic data protection setup for public surveys
          collected through this deployment of FlexPulseEU.
        </p>
        <p>
          Privacy notice version: <strong>{legal.privacyNoticeVersion}</strong>.
        </p>

        <section>
          <h2>Who is responsible for the survey?</h2>
          <p>
            The organisation responsible for the purpose of the survey is{" "}
            <strong>{legal.controllerName}</strong>. This organisation acts as the
            data controller for the survey responses.
          </p>
          <p>
            Controller country or region: <strong>{legal.controllerCountry}</strong>.
          </p>
          {legal.controllerContactEmail ? (
            <p>
              Controller contact:{" "}
              <a href={`mailto:${legal.controllerContactEmail}`}>
                {legal.controllerContactEmail}
              </a>
            </p>
          ) : null}
        </section>

        <section>
          <h2>What role does FlexPulseEU have?</h2>
          <p>
            <strong>{legal.processorName}</strong> provides and operates the
            technical platform used to collect, store, process, and analyse survey
            responses on behalf of the controller.
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
        </section>

        <section>
          <h2>Legal basis and consent</h2>
          <p>
            Participation is voluntary. By ticking the consent box before
            submission, you consent to the processing of your survey response for
            the stated research, validation, and aggregated analytics purposes.
            You may withdraw consent later by contacting the controller or the
            privacy contact below. Withdrawal does not affect processing already
            performed before withdrawal.
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
            do not submit the survey. For privacy questions, contact{" "}
            {legal.privacyEmail ? (
              <a href={`mailto:${legal.privacyEmail}`}>{legal.privacyEmail}</a>
            ) : (
              "the survey controller"
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
