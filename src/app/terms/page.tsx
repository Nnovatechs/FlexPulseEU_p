import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptTermsAction } from "@/features/access/actions";
import { isTermsAcceptanceRequired } from "@/features/access/terms-config";
import { getCurrentTermsAcceptance } from "@/features/access/repository";
import { buildTermsDocument, TERMS_ACCEPTANCE_STATEMENT } from "@/features/access/terms";
import { appRoutes } from "@/lib/config/routes";

type TermsPageProps = {
  searchParams?: Promise<{
    accepted?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "acceptance-required": "Confirm acceptance of the Platform Access Terms before continuing.",
  "document-changed":
    "The terms changed before acceptance. Review the current version and try again.",
};

export default async function TermsPage({ searchParams }: TermsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const document = buildTermsDocument();
  const acceptance = await getCurrentTermsAcceptance();

  if (!isTermsAcceptanceRequired() && acceptance) {
    redirect(appRoutes.dashboard);
  }

  const errorMessage = resolvedSearchParams.error
    ? errorMessages[resolvedSearchParams.error]
    : null;

  return (
    <main className="legal-page terms-page">
      {!acceptance ? (
        <a href="#terms-acceptance" className="terms-jump-button" aria-label="Jump to acceptance">
          <span aria-hidden="true">↓</span>
          <span>Jump to acceptance</span>
        </a>
      ) : null}

      <div className="terms-shell">
        <article className="legal-card terms-card">
          <header className="terms-hero">
            <div className="terms-hero__meta">
              <p className="legal-eyebrow">{document.appliesTo}</p>
              <span className="terms-version">Version {document.version}</span>
            </div>
            <h1>{document.title}</h1>
            <p className="terms-hero__lead">
              Review these terms before entering the protected workspace. They govern
              controlled access to this hosted environment and help keep project use,
              data handling, and stakeholder access aligned.
            </p>
          </header>

          {(resolvedSearchParams.accepted === "1" || acceptance) && (
            <div className="notice notice--info" role="status">
              Current terms accepted.
            </div>
          )}

          {errorMessage ? (
            <div className="notice notice--error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <section className="terms-summary">
            <h2>Before you continue</h2>
            <ul>
              <li>Access is limited to invited project users and stakeholders.</li>
              <li>Do not use the platform to collect unnecessary personal data.</li>
              <li>Do not share credentials or bypass privacy, consent, or security controls.</li>
              <li>These terms apply to the hosted environment, not the open-source repository.</li>
            </ul>
          </section>

          <div className="dpa-document">
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
          </div>

          <footer className="dpa-document__footer">
            <p>
              Contact: <a href={`mailto:${document.contactEmail}`}>{document.contactEmail}</a>
            </p>
            <p>
              Document integrity reference: <code>{document.documentHash}</code>
            </p>
          </footer>

          {acceptance ? (
            <section id="terms-acceptance" className="terms-acceptance-section">
              <div>
                <p className="legal-eyebrow">Accepted</p>
                <h2>Platform access enabled</h2>
                <p>
                  Accepted on{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "long",
                    timeStyle: "long",
                    timeZone: "UTC",
                  }).format(new Date(acceptance.acceptedAt))}{" "}
                  UTC.
                </p>
              </div>
              <div className="terms-action-card__actions">
                <Link href={appRoutes.dashboard} className="button button--ghost">
                  Continue to workspace
                </Link>
              </div>
            </section>
          ) : (
            <section id="terms-acceptance" className="terms-acceptance-section">
              <div>
                <p className="legal-eyebrow">Acceptance</p>
                <h2>Confirm platform access</h2>
                <p>
                  You must explicitly accept the current Platform Access Terms before
                  entering the protected workspace.
                </p>
              </div>
              <form action={acceptTermsAction} className="stack-form">
                <input type="hidden" name="documentHash" value={document.documentHash} />
                <label className="consent-row">
                  <input name="accepted" type="checkbox" value="true" required />
                  <span>{TERMS_ACCEPTANCE_STATEMENT}</span>
                </label>
                <div className="terms-action-card__actions">
                  <button type="submit" className="button button--primary">
                    Accept terms
                  </button>
                </div>
              </form>
            </section>
          )}
        </article>
      </div>
    </main>
  );
}
