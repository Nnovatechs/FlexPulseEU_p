import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { savePrivacySettingsAction } from "@/features/privacy/actions";
import { getDpaConfig, isDpaConfigComplete } from "@/features/privacy/dpa";
import { getCurrentDpaAcceptance } from "@/features/privacy/dpa-repository";
import { getCurrentOwnerLegalProfile } from "@/features/privacy/repository";
import { isOwnerDpaProfileComplete } from "@/features/privacy/types";
import { appRoutes } from "@/lib/config/routes";

type PrivacySettingsPageProps = {
  searchParams?: Promise<{
    error?: string;
    saved?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "missing-fields": "Complete all required fields before saving.",
  "invalid-email": "Enter valid contact email addresses.",
  "dpa-fields-required":
    "Complete and save the controller and authorised representative details before reviewing the DPA.",
};

export default async function PrivacySettingsPage({
  searchParams,
}: PrivacySettingsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const profile = await getCurrentOwnerLegalProfile();
  const dpaConfig = getDpaConfig();
  const dpaReady =
    isOwnerDpaProfileComplete(profile) && isDpaConfigComplete(dpaConfig);
  const dpaAcceptance =
    dpaReady && profile ? await getCurrentDpaAcceptance(profile) : null;
  const errorMessage = resolvedSearchParams.error
    ? errorMessages[resolvedSearchParams.error]
    : null;

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[
          { label: "Workspace", href: appRoutes.dashboard },
          { label: "Account" },
        ]}
        title="Privacy Settings"
        description="Define the legal identity shown to participants in surveys you publish."
      />

      {resolvedSearchParams.saved === "1" ? (
        <div className="notice notice--info" role="status">
          Privacy Settings saved. New surveys can now use this information when
          they are published.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <section className="surface-card">
        <div className="notice notice--info">
          The controller name, country, and contact details below are public
          information. They will appear in the privacy notice shown to survey
          participants.
        </div>

        <form action={savePrivacySettingsAction} className="stack-form">
          <label className="field">
            <span>Controller or institution name</span>
            <input
              name="controllerName"
              defaultValue={profile?.controllerName ?? ""}
              autoComplete="organization"
              required
            />
          </label>

          <label className="field">
            <span>Country or region</span>
            <input
              name="controllerCountry"
              defaultValue={profile?.controllerCountry ?? ""}
              autoComplete="country-name"
              required
            />
          </label>

          <label className="field">
            <span>Public contact email</span>
            <input
              name="contactEmail"
              type="email"
              defaultValue={profile?.contactEmail ?? ""}
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            <span>Privacy contact email</span>
            <input
              name="privacyEmail"
              type="email"
              defaultValue={profile?.privacyEmail ?? ""}
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            <span>Data Protection Officer email (optional)</span>
            <input
              name="dpoEmail"
              type="email"
              defaultValue={profile?.dpoEmail ?? ""}
              autoComplete="email"
            />
          </label>

          <div className="notice notice--info">
            The following details identify the Controller and its authorised
            representative in the Data Processing Agreement. They are stored in
            the acceptance record but are not shown in the public survey privacy
            notice.
          </div>

          <label className="field">
            <span>Controller registered address</span>
            <textarea
              name="controllerAddress"
              defaultValue={profile?.controllerAddress ?? ""}
              autoComplete="street-address"
              rows={3}
            />
          </label>

          <label className="field">
            <span>Authorised representative name</span>
            <input
              name="representativeName"
              defaultValue={profile?.representativeName ?? ""}
              autoComplete="name"
            />
          </label>

          <label className="field">
            <span>Authorised representative role or title</span>
            <input
              name="representativeTitle"
              defaultValue={profile?.representativeTitle ?? ""}
              autoComplete="organization-title"
            />
          </label>

          <button type="submit" className="button button--primary">
            Save Privacy Settings
          </button>
        </form>
      </section>

      <section className="surface-card stack-form">
        <div>
          <p className="legal-eyebrow">Controller–processor agreement</p>
          <h2>Data Processing Agreement</h2>
          <p className="muted">
            Review the agreement generated from the saved Controller details and
            the hosted platform&apos;s Processor details.
          </p>
        </div>

        {dpaAcceptance ? (
          <div className="notice notice--info" role="status">
            Current DPA accepted on{" "}
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date(dpaAcceptance.acceptedAt))}
            .
          </div>
        ) : !isOwnerDpaProfileComplete(profile) ? (
          <div className="notice notice--info">
            Save all required Controller and representative details to review the
            agreement.
          </div>
        ) : !isDpaConfigComplete(dpaConfig) ? (
          <div className="notice notice--error">
            The platform operator must complete the private DPA deployment
            configuration before this agreement can be reviewed.
          </div>
        ) : null}

        <div>
          {dpaReady ? (
            <Link href={appRoutes.dpa} className="button button--primary">
              {dpaAcceptance ? "View accepted DPA" : "Review DPA"}
            </Link>
          ) : (
            <button type="button" className="button button--ghost" disabled>
              Review DPA
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
