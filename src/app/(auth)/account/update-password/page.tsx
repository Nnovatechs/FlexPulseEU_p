import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import {
  FormPendingOverlay,
  PendingSubmitButton,
} from "@/components/pending-view-overlay";
import { updatePasswordAction } from "@/lib/auth/actions";
import { requireCurrentSession } from "@/lib/auth/session";
import { appRoutes } from "@/lib/config/routes";

type UpdatePasswordPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "missing-password": "Enter and confirm your new password.",
  "password-too-short": "Your new password must contain at least 8 characters.",
  "password-mismatch": "The passwords do not match.",
  "password-compromised":
    "That password is too common or appears in known data breaches. Choose a longer unique password. Your password was not changed.",
  "update-failed":
    "The password was not changed. Request a new recovery link and try again.",
};

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  await requireCurrentSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = resolvedSearchParams.error
    ? (errorMessages[resolvedSearchParams.error] ??
      "The password was not changed. Try again.")
    : null;
  const passwordUpdated = resolvedSearchParams.message === "password-updated";

  return (
    <main className="login-shell">
      <section className="login-panel login-panel--auth">
        <div className="login-card">
          <div className="login-card__header">
            <BrandLogo size={44} priority />
            <h1>Change password</h1>
            <p>Set a new password for your FlexPulse-EU account.</p>
          </div>

          {errorMessage ? (
            <div className="notice notice--error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          {passwordUpdated ? (
            <div className="stack-form">
              <div className="notice notice--info" role="status">
                Your password has been updated.
              </div>
              <Link href={appRoutes.dashboard} className="button button--primary button--full">
                Continue to workspace
              </Link>
            </div>
          ) : (
            <>
              <form action={updatePasswordAction} className="stack-form">
                <label className="field">
                  <span>New password</span>
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </label>

                <label className="field">
                  <span>Confirm new password</span>
                  <input
                    name="confirmPassword"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </label>

                <PendingSubmitButton className="button button--primary button--full">
                  Update password
                </PendingSubmitButton>
                <FormPendingOverlay
                  title="Updating password"
                  description="Saving your new password…"
                />
              </form>

              {resolvedSearchParams.error === "update-failed" ? (
                <Link
                  href={appRoutes.forgotPassword}
                  className="button button--ghost button--full"
                >
                  Request a new recovery link
                </Link>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
