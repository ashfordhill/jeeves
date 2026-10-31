import { useId } from "react";

export type CountPoint = { date: string; count: number };
export type Metric = { label: string; value: string | number; detail?: string; testId?: string };
export function Metrics({ items }: { items: readonly Metric[] }) {
  return (
    <dl className="jui-metrics">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            <span data-testid={item.testId}>{item.value}</span>
            {item.detail && <small>{item.detail}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A visual overview paired with a complete mouse-accessible data table; no charting dependency. */
export function CountChart({
  title,
  points,
  unit = "Events",
  tableLabel = "View daily counts",
}: {
  title: string;
  points: readonly CountPoint[];
  unit?: string;
  tableLabel?: string;
}) {
  const id = useId();
  if (
    points.length > 366 ||
    points.some((point) => !Number.isSafeInteger(point.count) || point.count < 0)
  )
    throw new Error("Count chart requires at most 366 nonnegative integer points");
  const peak = Math.max(0, ...points.map((point) => point.count));
  const max = Math.max(1, peak);
  const width = 900,
    height = 230,
    left = 8,
    right = 8,
    top = 12,
    bottom = 12;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const step = plotWidth / Math.max(1, points.length),
    barWidth = Math.min(42, step * 0.7);
  const first = points[0]?.date,
    last = points.at(-1)?.date;
  return (
    <figure className="jui-count-chart">
      <figcaption>{title}</figcaption>
      <p className="jui-chart-scale">
        Daily peak: {peak.toLocaleString()} {unit.toLowerCase()}
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
      >
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-description`}>
          {unit} per day{first ? ` from ${first} to ${last}` : ""}. Full values are available in the
          table below.
        </desc>
        <line className="jui-chart-grid" x1={left} x2={width - right} y1={top} y2={top} />
        <line
          className="jui-chart-grid"
          x1={left}
          x2={width - right}
          y1={height - bottom}
          y2={height - bottom}
        />
        {points.map((point, index) => {
          const barHeight = (point.count / max) * plotHeight;
          return (
            <rect
              className="jui-chart-bar"
              key={point.date}
              x={left + step * (index + 0.5) - barWidth / 2}
              y={height - bottom - barHeight}
              width={barWidth}
              height={barHeight}
              rx={Math.min(4, barWidth / 3)}
            >
              <title>
                {point.date}: {point.count.toLocaleString()} {unit.toLowerCase()}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="jui-chart-dates">
        <span>{first}</span>
        {points.length > 1 && <span>{last}</span>}
      </div>
      <details className="jui-chart-table">
        <summary>{tableLabel}</summary>
        <div>
          <table>
            <caption>{title} · UTC</caption>
            <thead>
              <tr>
                <th scope="col">Date (UTC)</th>
                <th scope="col">{unit}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{point.date}</th>
                  <td>{point.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
