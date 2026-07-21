import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { acceptDpaAction } from "@/features/privacy/actions";
import {
  buildDpaDocument,
  DPA_ACCEPTANCE_STATEMENT,
  getDpaConfig,
  isDpaConfigComplete,
} from "@/features/privacy/dpa";
import { getCurrentDpaAcceptance } from "@/features/privacy/dpa-repository";
import { getCurrentOwnerLegalProfile } from "@/features/privacy/repository";
import { isOwnerDpaProfileComplete } from "@/features/privacy/types";
import { appRoutes } from "@/lib/config/routes";

type DpaPageProps = {
  searchParams?: Promise<{
    accepted?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "acceptance-required": "Confirm the acceptance statement before continuing.",
  "document-changed":
    "The agreement details changed before acceptance. Review the current document and try again.",
  "processor-config":
    "The platform operator must complete the private DPA deployment configuration.",
};

export default async function DpaPage({ searchParams }: DpaPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const profile = await getCurrentOwnerLegalProfile();
  const config = getDpaConfig();
  const profileComplete = isOwnerDpaProfileComplete(profile);
  const configComplete = isDpaConfigComplete(config);
  const document =
    profileComplete && configComplete && profile
      ? buildDpaDocument(profile, config)
      : null;
  const acceptance =
    document && profile ? await getCurrentDpaAcceptance(profile) : null;
  const errorMessage = resolvedSearchParams.error
    ? errorMessages[resolvedSearchParams.error]
    : null;

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[
          { label: "Workspace", href: appRoutes.dashboard },
          { label: "Privacy Settings", href: appRoutes.privacySettings },
          { label: "DPA" },
        ]}
        title="Data Processing Agreement"
        description="Agreement between the survey Controller and platform Processor."
      />

      {resolvedSearchParams.accepted === "1" && acceptance ? (
        <div className="notice notice--info" role="status">
          DPA accepted successfully. The immutable acceptance record includes
          this exact document, its version and hash, and the acceptance time.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!profileComplete ? (
        <section className="surface-card stack-form">
          <div className="notice notice--info">
            Complete and save the Controller address and authorised
            representative details before reviewing the DPA.
          </div>
          <div>
            <Link href={appRoutes.privacySettings} className="button button--primary">
              Open Privacy Settings
            </Link>
          </div>
        </section>
      ) : !configComplete ? (
        <section className="surface-card">
          <div className="notice notice--error">
            The Processor identity is incomplete. The deployment operator must
            configure LEGAL_PROCESSOR_ADDRESS together with the existing
            LEGAL_PROCESSOR_NAME and LEGAL_PRIVACY_EMAIL values.
          </div>
        </section>
      ) : document ? (
        <>
          <article className="surface-card dpa-document">
            <header className="dpa-document__header">
              <p className="legal-eyebrow">Controller–processor agreement</p>
              <h2>{document.title}</h2>
              <p>
                Version <strong>{document.version}</strong>
              </p>
            </header>

            <section>
              <h3>Parties</h3>
              <div className="dpa-parties">
                <div>
                  <h4>Controller</h4>
                  <p>
                    <strong>{document.controller.legalName}</strong>
                    <br />
                    {document.controller.address}
                    <br />
                    {document.controller.country}
                  </p>
                  <p>
                    Represented by {document.controller.representativeName},{" "}
                    {document.controller.representativeTitle}.
                  </p>
                  <p>
                    Privacy contact:{" "}
                    <a href={`mailto:${document.controller.privacyEmail}`}>
                      {document.controller.privacyEmail}
                    </a>
                  </p>
                </div>
                <div>
                  <h4>Processor</h4>
                  <p>
                    <strong>{document.processor.legalName}</strong>
                    <br />
                    {document.processor.address}
                  </p>
                  <p>
                    Privacy contact:{" "}
                    <a href={`mailto:${document.processor.privacyEmail}`}>
                      {document.processor.privacyEmail}
                    </a>
                  </p>
                </div>
              </div>
            </section>

            {document.sections.map((section) => (
              <section key={section.title}>
                <h3>{section.title}</h3>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.items ? (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            <footer className="dpa-document__footer">
              <p>
                Document integrity reference:{" "}
                <code>{document.documentHash}</code>
              </p>
            </footer>
          </article>

          <section className="surface-card stack-form">
            {acceptance ? (
              <div className="notice notice--info">
                Accepted by the authenticated Controller account on{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "long",
                  timeStyle: "long",
                  timeZone: "UTC",
                }).format(new Date(acceptance.acceptedAt))}{" "}
                UTC. This acceptance remains valid only while the current party
                details and DPA version produce the same document hash.
              </div>
            ) : (
              <form action={acceptDpaAction} className="stack-form">
                <input
                  type="hidden"
                  name="documentHash"
                  value={document.documentHash}
                />
                <label className="consent-row">
                  <input name="accepted" type="checkbox" value="true" required />
                  <span>{DPA_ACCEPTANCE_STATEMENT}</span>
                </label>
                <div>
                  <button type="submit" className="button button--primary">
                    Accept DPA
                  </button>
                </div>
              </form>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
