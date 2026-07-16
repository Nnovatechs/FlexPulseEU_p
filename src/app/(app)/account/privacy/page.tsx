import { PageHeader } from "@/components/layout/page-header";
import { savePrivacySettingsAction } from "@/features/privacy/actions";
import { getCurrentOwnerLegalProfile } from "@/features/privacy/repository";
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
};

export default async function PrivacySettingsPage({
  searchParams,
}: PrivacySettingsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const profile = await getCurrentOwnerLegalProfile();
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

          <button type="submit" className="button button--primary">
            Save Privacy Settings
          </button>
        </form>
      </section>
    </div>
  );
}
