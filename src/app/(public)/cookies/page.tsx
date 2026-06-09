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

        <section>
          <h2>Necessary cookies</h2>
          <p>
            Necessary cookies may be used for authentication, security, routing,
            deployment protection, and basic application functionality. They are
            not used for advertising.
          </p>
        </section>

        <section>
          <h2>Bot protection</h2>
          <p>
            Public survey submissions may use Cloudflare Turnstile to distinguish
            legitimate visitors from automated abuse. Cloudflare may process
            technical signals needed to provide that security check.
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
