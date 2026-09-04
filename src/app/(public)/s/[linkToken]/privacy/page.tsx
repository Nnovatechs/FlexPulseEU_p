import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DERIVED_PROCESSING_COPY,
  EXTERNAL_PANEL_TOKENIZATION_COPY,
  INTERNATIONAL_TRANSFERS_COPY,
  SUPERVISORY_AUTHORITY_COPY,
} from "@/features/privacy/notice-copy";
import { getPublicSurveyLegalSnapshot } from "@/features/privacy/repository";
import { buildLegacySurveyLegalSnapshot } from "@/features/privacy/types";
import { getPublicSurveyRuntimeByLinkToken } from "@/features/surveys/use-cases";
import { getLegalConfig } from "@/lib/config/legal";
import { getRawLocationRetentionLabel } from "@/lib/config/response-retention";
import { appRoutes } from "@/lib/config/routes";

type SurveyPrivacyPageProps = {
  params: Promise<{ linkToken: string }>;
};

export default async function SurveyPrivacyPage({
  params,
}: SurveyPrivacyPageProps) {
  const { linkToken } = await params;
  const runtime = await getPublicSurveyRuntimeByLinkToken(linkToken);

  if (!runtime) {
    notFound();
  }

  const record = await getPublicSurveyLegalSnapshot(runtime.survey.id);
  const snapshot =
    record?.snapshot ??
    buildLegacySurveyLegalSnapshot(
      getLegalConfig(),
      getRawLocationRetentionLabel(),
    );

  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="legal-eyebrow">Survey privacy notice</p>
        <h1>Privacy information for this survey</h1>
        <p>
          This notice identifies the organisation responsible for this survey
          and explains how submitted responses are handled.
        </p>
        <p>
          Privacy notice version:{" "}
          <strong>{snapshot.notices.privacyNoticeVersion}</strong>.
        </p>

        <section>
          <h2>Who is responsible for this survey?</h2>
          <p>
            <strong>{snapshot.controller.name}</strong> is the data controller
            responsible for the purpose and use of the survey responses.
          </p>
          <p>
            Country or region: <strong>{snapshot.controller.country}</strong>.
          </p>
          {snapshot.controller.contactEmail ? (
            <p>
              Public contact:{" "}
              <a href={`mailto:${snapshot.controller.contactEmail}`}>
                {snapshot.controller.contactEmail}
              </a>
            </p>
          ) : null}
          {snapshot.controller.privacyEmail ? (
            <p>
              Privacy contact:{" "}
              <a href={`mailto:${snapshot.controller.privacyEmail}`}>
                {snapshot.controller.privacyEmail}
              </a>
            </p>
          ) : null}
          {snapshot.controller.dpoEmail ? (
            <p>
              Data Protection Officer:{" "}
              <a href={`mailto:${snapshot.controller.dpoEmail}`}>
                {snapshot.controller.dpoEmail}
              </a>
            </p>
          ) : null}
        </section>

        <section>
          <h2>What information is collected?</h2>
          <p>
            The survey stores the answers you choose to submit. It does not ask
            for your name, email address, account identifier, or signature.
            Some surveys may request country and postal-code context for
            aggregated regional analysis.
          </p>
          <p>{EXTERNAL_PANEL_TOKENIZATION_COPY}</p>
        </section>

        <section>
          <h2>Why is the information used?</h2>
          <p>
            Responses are processed to conduct, validate, and document the
            stated research and to produce aggregated analysis for the
            controller. Individual answers are not used for unrelated
            advertising, cross-customer benchmarking, or product training.
          </p>
          <p>{DERIVED_PROCESSING_COPY}</p>
        </section>

        <section>
          <h2>How long is the information retained?</h2>
          <p>
            Raw country and postal-code inputs are marked for cleanup after{" "}
            {snapshot.retention.rawLocation}.
          </p>
          <p>{snapshot.retention.responses}</p>
        </section>

        <section>
          <h2>Platform and service providers</h2>
          <p>
            <strong>{snapshot.platform.processorName}</strong> provides the
            technical platform on behalf of the controller. Hosted infrastructure,
            database, bot-prevention, and regional enrichment providers may process
            the minimum information required to operate the survey.
          </p>
          <p>{INTERNATIONAL_TRANSFERS_COPY}</p>
          <p>
            Read the{" "}
            <Link href={snapshot.platform.privacyUrl}>
              platform privacy notice
            </Link>{" "}
            and <Link href={snapshot.platform.cookiesUrl}>cookie notice</Link>.
          </p>
        </section>

        <section>
          <h2>Your choices and rights</h2>
          <p>
            Participation is voluntary. Depending on applicable law and whether
            a response can reasonably be linked back to you, you may request
            access, deletion, restriction, objection, or withdrawal by
            contacting the controller.
          </p>
          <p>{SUPERVISORY_AUTHORITY_COPY}</p>
          <p>
            After identifying context has been removed, the controller may no
            longer be able to identify an individual response without
            collecting additional information.
          </p>
        </section>

        <p>
          <Link href={appRoutes.publicSurveyLink(linkToken)}>
            Return to the survey
          </Link>
        </p>
      </article>
    </main>
  );
}
