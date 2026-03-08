const readinessItems = [
  "Apache-2.0 licensing and baseline project governance",
  "Protected-main workflow through pull requests and required checks",
  "Secure defaults for configuration and future third-party integrations",
  "Minimal CI pipeline for linting, type checking, tests, and production build",
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Foundation repository</p>
        <h1>FlexPulseEU</h1>
        <p className="lead">
          A secure and evaluation-ready project base for the future development
          of surveys, semantic mapping, and related research workflows.
        </p>
      </section>

      <section className="card-grid" aria-label="Repository readiness checklist">
        {readinessItems.map((item) => (
          <article key={item} className="card">
            <h2>Ready from day one</h2>
            <p>{item}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
