import {
  signInWithPasswordAction,
  signUpWithPasswordAction,
} from "@/lib/auth/actions";
import { appRoutes } from "@/lib/config/routes";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
    mode?: string;
    next?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "missing-credentials": "Enter a valid email and password to continue.",
  "invalid-credentials": "The credentials provided were not accepted.",
  "missing-signup-fields": "Complete all fields to create a new account.",
  "password-mismatch": "The password confirmation does not match.",
  "signup-failed": "The account could not be created with the provided details.",
};

const infoMessages: Record<string, string> = {
  "check-email":
    "Your account was created. Confirm your email if email confirmation is enabled.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorKey = resolvedSearchParams.error;
  const messageKey = resolvedSearchParams.message;
  const mode = resolvedSearchParams.mode === "signup" ? "signup" : "signin";
  const nextPath = resolvedSearchParams.next ?? appRoutes.dashboard;
  const isSignUpMode = mode === "signup";

  return (
    <main className="login-shell">
      <section className="login-panel login-panel--auth">
        <div className="login-card">
          <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
            <a
              href={appRoutes.login}
              className={`auth-mode-switch__item${!isSignUpMode ? " auth-mode-switch__item--active" : ""}`}
            >
              Sign in
            </a>
            <a
              href={`${appRoutes.login}?mode=signup`}
              className={`auth-mode-switch__item${isSignUpMode ? " auth-mode-switch__item--active" : ""}`}
            >
              Create account
            </a>
          </div>

          <div className="login-card__header">
            <p className="section-header__eyebrow">FlexPulseEU</p>
            <h1>{isSignUpMode ? "Create account" : "Sign in"}</h1>
            <p>
              {isSignUpMode
                ? "Create an account to access the protected workspace."
                : "Access the protected workspace with your account."}
            </p>
          </div>

          {messageKey ? (
            <div className="notice notice--info" role="status">
              {infoMessages[messageKey] ?? "Action completed successfully."}
            </div>
          ) : null}

          {errorKey ? (
            <div className="notice notice--error" role="alert">
              {errorMessages[errorKey] ?? "Authentication could not be completed."}
            </div>
          ) : null}

          <form
            className="stack-form"
            action={isSignUpMode ? signUpWithPasswordAction : signInWithPasswordAction}
          >
            <input type="hidden" name="next" value={nextPath} />
            <label className="field">
              <span>Email</span>
              <input type="email" name="email" placeholder="name@institution.eu" />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                placeholder="••••••••••••"
              />
            </label>

            {isSignUpMode ? (
              <label className="field">
                <span>Confirm password</span>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="••••••••••••"
                />
              </label>
            ) : null}

            <button type="submit" className="button button--primary button--full">
              {isSignUpMode ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
