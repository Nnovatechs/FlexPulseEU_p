type Metric = {
  label: string;
  value: string;
  hint: string;
};

type MetricGridProps = {
  metrics: Metric[];
};

export function MetricGrid({ metrics }: MetricGridProps) {
  return (
    <section className="metric-grid" aria-label="Key metrics">
      {metrics.map((metric) => (
        <article key={metric.label} className="metric-card">
          <p>{metric.label}</p>
          <strong>{metric.value}</strong>
          <small>{metric.hint}</small>
        </article>
      ))}
    </section>
  );
}
