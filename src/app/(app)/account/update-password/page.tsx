import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { updatePasswordAction } from "@/lib/auth/actions";
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
  "update-failed": "The password could not be updated. Request a new recovery link and try again.",
};

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = resolvedSearchParams.error
    ? errorMessages[resolvedSearchParams.error]
    : null;
  const passwordUpdated = resolvedSearchParams.message === "password-updated";

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[
          { label: "Workspace", href: appRoutes.dashboard },
          { label: "Account" },
        ]}
        title="Change password"
        description="Set a new password for your FlexPulse-EU account."
      />

      <section className="surface-card">
        {errorMessage ? <div className="notice notice--error">{errorMessage}</div> : null}

        {passwordUpdated ? (
          <div className="stack-form">
            <div className="notice notice--info">Your password has been updated.</div>
            <Link href={appRoutes.dashboard} className="button button--primary">
              Return to surveys
            </Link>
          </div>
        ) : (
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

            <button type="submit" className="button button--primary">
              Update password
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
