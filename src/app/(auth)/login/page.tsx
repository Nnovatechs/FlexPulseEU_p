import Link from "next/link";
import { appRoutes } from "@/lib/config/routes";

const providerOptions = ["Continue with Google", "Continue with LinkedIn"];

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-panel login-panel--hero">
        <p className="section-header__eyebrow">FlexPulseEU access</p>
        <h1>Survey operations for multilingual research.</h1>
        <p>
          A restrained, professional workspace for generating, refining,
          publishing, and reviewing survey instruments.
        </p>

        <div className="feature-list">
          <article className="feature-item">
            <strong>Survey generation</strong>
            <span>Define stakeholder, language scope, and ontology concepts.</span>
          </article>
          <article className="feature-item">
            <strong>Editing and validation</strong>
            <span>Review and adjust generated content before publication.</span>
          </article>
          <article className="feature-item">
            <strong>Filling and analytics</strong>
            <span>Move from respondent experience to interpretable results.</span>
          </article>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__header">
            <p className="section-header__eyebrow">Sign in</p>
            <h2>Welcome back</h2>
            <p>
              This is a frontend-only mockup. The visual flow is already shaped
              for a later integration with real authentication and middleware.
            </p>
          </div>

          <form className="stack-form">
            <label className="field">
              <span>Email</span>
              <input type="email" placeholder="name@institution.eu" />
            </label>

            <label className="field">
              <span>Password</span>
              <input type="password" placeholder="••••••••••••" />
            </label>

            <Link href={appRoutes.dashboard} className="button button--primary">
              Continue with email
            </Link>
          </form>

          <div className="divider">
            <span>or</span>
          </div>

          <div className="stack-list">
            {providerOptions.map((provider) => (
              <Link
                key={provider}
                href={appRoutes.dashboard}
                className="button button--secondary button--full"
              >
                {provider}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
