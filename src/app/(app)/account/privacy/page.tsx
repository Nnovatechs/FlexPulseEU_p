import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  saveDpaSigningDetailsAction,
  saveParticipantPrivacySettingsAction,
} from "@/features/privacy/actions";
import { getDpaConfig, isDpaConfigComplete } from "@/features/privacy/dpa";
import { getCurrentDpaAcceptance } from "@/features/privacy/dpa-repository";
import { getCurrentOwnerLegalProfile } from "@/features/privacy/repository";
import {
  isOwnerDpaProfileComplete,
  isOwnerLegalProfileComplete,
} from "@/features/privacy/types";
import { appRoutes } from "@/lib/config/routes";

type PrivacySettingsPageProps = {
  searchParams?: Promise<{
    error?: string;
    participantSaved?: string;
    dpaSaved?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "participant-missing-fields": "Complete all required participant privacy fields before saving.",
  "participant-invalid-email": "Enter valid participant privacy contact email addresses.",
  "participant-profile-required":
    "Save the participant privacy details before saving the DPA signing details.",
  "dpa-missing-fields": "Complete all required DPA signing fields before saving.",
  "dpa-fields-required":
    "Complete and save the controller and authorised representative details before reviewing the DPA.",
};

export default async function PrivacySettingsPage({
  searchParams,
}: PrivacySettingsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const profile = await getCurrentOwnerLegalProfile();
  const participantProfileReady = isOwnerLegalProfileComplete(profile);
  const dpaConfig = getDpaConfig();
  const dpaConfigReady = isDpaConfigComplete(dpaConfig);
  const dpaFieldsReady = isOwnerDpaProfileComplete(profile);
  const dpaAcceptance =
    dpaFieldsReady && dpaConfigReady && profile
      ? await getCurrentDpaAcceptance(profile)
      : null;
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

      {resolvedSearchParams.participantSaved === "1" ? (
        <div className="notice notice--info" role="status">
          Participant privacy details saved. New surveys can now use this
          information when they are published.
        </div>
      ) : null}

      {resolvedSearchParams.dpaSaved === "1" ? (
        <div className="notice notice--info" role="status">
          DPA signing details saved. You can now review the agreement.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <section className="surface-card">
        <div>
          <p className="legal-eyebrow">Participant-facing notice</p>
          <h2>Participant privacy details</h2>
          <p className="muted">
            These details are shown to survey participants in the privacy notice
            for surveys you publish.
          </p>
        </div>

        <div className="notice notice--info">
          The controller name, country, and contact details below are public
          information. They will appear in the privacy notice shown to survey
          participants.
        </div>

        <form action={saveParticipantPrivacySettingsAction} className="stack-form">
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

          <div className="privacy-settings__actions">
            <button
              type="submit"
              className="button button--primary privacy-settings__save"
            >
              Save participant privacy details
            </button>
            {participantProfileReady ? (
              <Link
                href={appRoutes.privacySettingsPreview}
                className="button button--ghost privacy-settings__preview"
              >
                Preview participant privacy notice
              </Link>
            ) : (
              <span
                className="privacy-settings__preview-wrap"
                title="To preview the participant privacy notice, fill in and save the participant privacy details above."
              >
                <button
                  type="button"
                  className="button button--ghost privacy-settings__preview"
                  disabled
                >
                  Preview participant privacy notice
                </button>
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="surface-card stack-form">
        <div>
          <p className="legal-eyebrow">Contractual details</p>
          <h2>DPA signing details</h2>
          <p className="muted">
            These details are used only for the Data Processing Agreement and
            are not shown in the participant privacy notice.
          </p>
        </div>

        <div className="notice notice--info">
          The following details identify the Controller and its authorised
          representative in the Data Processing Agreement. They are stored in
          the acceptance record but are not shown in the public survey privacy
          notice.
        </div>

        <form action={saveDpaSigningDetailsAction} className="stack-form">
          <label className="field">
            <span>Controller registered address</span>
            <textarea
              name="controllerAddress"
              defaultValue={profile?.controllerAddress ?? ""}
              autoComplete="street-address"
              rows={3}
              required
            />
          </label>

          <label className="field">
            <span>Authorised representative name</span>
            <input
              name="representativeName"
              defaultValue={profile?.representativeName ?? ""}
              autoComplete="name"
              required
            />
          </label>

          <label className="field">
            <span>Authorised representative role or title</span>
            <input
              name="representativeTitle"
              defaultValue={profile?.representativeTitle ?? ""}
              autoComplete="organization-title"
              required
            />
          </label>

          <div className="privacy-settings__actions">
            <button
              type="submit"
              className="button button--primary privacy-settings__save"
            >
              Save DPA signing details
            </button>
            {dpaAcceptance ? (
              <div className="notice notice--info" role="status">
                Current DPA accepted on{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "long",
                  timeStyle: "short",
                }).format(new Date(dpaAcceptance.acceptedAt))}
                .
              </div>
            ) : null}

            {participantProfileReady && dpaFieldsReady && dpaConfigReady ? (
              <Link
                href={appRoutes.dpa}
                className="button button--ghost privacy-settings__preview"
              >
                Preview &amp; Sign DPA
              </Link>
            ) : (
              <span
                className="privacy-settings__preview-wrap"
                title={
                  !participantProfileReady
                    ? "To preview and sign the DPA, first save the participant privacy details above."
                    : !dpaFieldsReady
                      ? "To preview and sign the DPA, fill in and save the DPA information above."
                      : "To preview and sign the DPA, the platform operator must first complete the private DPA configuration."
                }
              >
                <button
                  type="button"
                  className="button button--ghost privacy-settings__preview"
                  disabled
                >
                  Preview &amp; Sign DPA
                </button>
              </span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
