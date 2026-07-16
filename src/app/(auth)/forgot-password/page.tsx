import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { appRoutes } from "@/lib/config/routes";

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const hasMissingEmailError = resolvedSearchParams.error === "missing-email";
  const resetRequested = resolvedSearchParams.message === "reset-requested";

  return (
    <main className="login-shell">
      <section className="login-panel login-panel--auth">
        <div className="login-card">
          <div className="login-card__header">
            <BrandLogo size={44} priority />
            <h1>Reset your password</h1>
            <p>
              Enter your account email. If it matches an account, we will send
              you a secure recovery link.
            </p>
          </div>

          {hasMissingEmailError ? (
            <div className="notice notice--error">Enter your email address.</div>
          ) : null}

          {resetRequested ? (
            <div className="notice notice--info">
              If an account exists for that email, a recovery link has been sent.
            </div>
          ) : null}

          <form action={requestPasswordResetAction} className="stack-form">
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>

            <button type="submit" className="button button--primary button--full">
              Send recovery link
            </button>
          </form>

          <Link href={appRoutes.login} className="button button--ghost button--full">
            Back to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
