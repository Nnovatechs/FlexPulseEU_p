import Link from "next/link";
import { getLegalConfig } from "@/lib/config/legal";

export default function CookiesPage() {
  const legal = getLegalConfig();

  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="legal-eyebrow">Cookie notice</p>
        <h1>Cookies and similar technologies</h1>
        <p>
          This deployment of FlexPulseEU uses only the technical cookies and
          similar technologies needed to run the application, protect submissions,
          and maintain secure sessions where applicable.
        </p>
        <p>
          Cookie notice version: <strong>{legal.cookieNoticeVersion}</strong>.
        </p>

        <section>
          <h2>Necessary cookies</h2>
          <p>
            Necessary cookies may be used for authentication, security, routing,
            deployment protection, and basic application functionality. They are
            not used for advertising.
          </p>
          <p>
            These technologies support requested application functionality and
            secure operation. FlexPulseEU does not intentionally use advertising,
            marketing, or cross-site profiling cookies in this D2 deployment.
          </p>
        </section>

        <section>
          <h2>Bot protection</h2>
          <p>
            Public survey submissions may use Cloudflare Turnstile to distinguish
            legitimate visitors from automated abuse. Cloudflare may process
            technical signals needed to provide that security check.
          </p>
          <p>
            Turnstile is treated as a security measure for protecting public
            submission forms from automated abuse. If Turnstile is not configured
            for a deployment, this section does not apply to that deployment.
          </p>
        </section>

        <section>
          <h2>Analytics and marketing</h2>
          <p>
            This stage does not intentionally use advertising cookies or
            respondent-facing marketing trackers. If optional analytics are added
            later, this notice should be updated before use.
          </p>
        </section>

        <section>
          <h2>Cookie banner</h2>
          <p>
            This deployment does not show a separate cookie banner because it does
            not intentionally use optional advertising, marketing, or behavioural
            analytics cookies. If non-essential cookies or trackers are introduced
            later, a consent mechanism should be added before they are enabled.
          </p>
        </section>

        <section>
          <h2>More information</h2>
          <p>
            Read the <Link href={legal.privacyUrl}>privacy information</Link> for
            more detail about survey participation and data processing.
          </p>
        </section>
      </article>
    </main>
  );
}
