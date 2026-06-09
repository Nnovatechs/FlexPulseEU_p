import Link from "next/link";
import { getLegalConfig } from "@/lib/config/legal";

export default function PrivacyPage() {
  const legal = getLegalConfig();

  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="legal-eyebrow">Privacy information</p>
        <h1>Data protection and survey participation</h1>
        <p>
          This page explains the basic data protection setup for public surveys
          collected through this deployment of FlexPulseEU.
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
        </section>

        <section>
          <h2>How is the data used?</h2>
          <p>
            Responses are used to run the survey, process submitted answers, and
            produce aggregated research or analytics for the controller. Published
            analytics should not identify individual respondents.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
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
