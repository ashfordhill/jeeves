import { type DateRange, recentRange, utcRange } from "@jeeves/analytics";
import { CountChart, Feedback, Metrics } from "@jeeves/product-ui";
import { useApis } from "@jeeves/web-runtime";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { paths } from "../clients/qrwty.openapi.ts";
import type { app } from "../jeeves.generated.ts";
import { productConfiguration } from "../product.generated.ts";
import { message } from "./apiMessage.ts";
import { Icon } from "./Icon.tsx";

type Summary = paths["/api/analytics"]["get"]["responses"][200]["content"]["application/json"];
const equal = (left: DateRange, right: DateRange) =>
  left.from === right.from && left.to === right.to;
export function Analytics({ onUnauthorized }: { onUnauthorized: () => void }) {
  const { qrwty: client } = useApis<typeof app.apis>();
  const [range, setRange] = useState<DateRange>(() =>
    recentRange(productConfiguration.analyticsDays),
  );
  const [result, setResult] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requested = useRef(range),
    version = useRef(0),
    active = useRef(true),
    unauthorized = useRef(onUnauthorized);
  unauthorized.current = onUnauthorized;
  async function load(next: DateRange) {
    const generation = ++version.current;
    requested.current = next;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const { data, error, response } = await client.GET("/api/analytics", {
        params: { query: next },
      });
      if (!active.current || generation !== version.current) return;
      if (response.status === 401) return unauthorized.current();
      if (!data) {
        setError(message(error));
        return;
      }
      setResult(data);
    } catch {
      if (active.current && generation === version.current)
        setError("We couldn’t load these counts. Your links are still safe. Please retry.");
    } finally {
      if (active.current && generation === version.current) setLoading(false);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload on client replacement; the request range is held in a ref and explicit Apply triggers load.
  useEffect(() => {
    active.current = true;
    let start = true;
    queueMicrotask(() => {
      if (start) void load(requested.current);
    });
    return () => {
      start = false;
      active.current = false;
      version.current++;
    };
  }, [client]);
  let invalid = "";
  try {
    utcRange(range.from, range.to);
  } catch (cause) {
    invalid = cause instanceof Error ? cause.message : "Choose a valid range.";
  }
  function apply(event: FormEvent) {
    event.preventDefault();
    if (!invalid) void load({ ...range });
  }
  const choose = (days: 7 | 30 | 90) => {
    const next = recentRange(days);
    setRange(next);
    void load(next);
  };
  const currentPreset = ([7, 30, 90] as const).find((days) => equal(range, recentRange(days)));
  return (
    <div className="analytics-layout">
      <section className="panel analytics-range" aria-label="Analytics date range">
        <div className="analytics-range-heading">
          <div>
            <h2>Follow the connection</h2>
            <p className="muted">A clear view of how your QR links are being used.</p>
          </div>
          <span className="analytics-timezone">All dates in UTC</span>
        </div>
        <fieldset className="analytics-presets">
          <legend className="sr-only">Quick ranges</legend>
          {([7, 30, 90] as const).map((days) => (
            <button
              type="button"
              key={days}
              aria-pressed={currentPreset === days}
              onClick={() => choose(days)}
            >
              Last {days} days
            </button>
          ))}
        </fieldset>
        <form className="analytics-range-form" onSubmit={apply}>
          <label>
            From
            <input
              data-testid="analytics-from"
              type="date"
              min="1900-01-01"
              max="9998-12-31"
              value={range.from}
              onChange={(event) => setRange({ ...range, from: event.target.value })}
            />
          </label>
          <label>
            Through
            <input
              data-testid="analytics-to"
              type="date"
              min="1900-01-01"
              max="9998-12-31"
              value={range.to}
              onChange={(event) => setRange({ ...range, to: event.target.value })}
            />
          </label>
          <button type="submit" className="primary" disabled={Boolean(invalid)}>
            Apply range
          </button>
          <button type="button" onClick={() => void load(requested.current)} disabled={loading}>
            Refresh analytics
          </button>
        </form>
        {invalid && <Feedback kind="error">{invalid}</Feedback>}
        {!invalid && !equal(range, requested.current) && (
          <p className="analytics-range-note">Apply your date range to update the results.</p>
        )}
      </section>
      {loading && <Feedback>Loading scan counts…</Feedback>}
      {error && (
        <Feedback kind="error">
          {error}{" "}
          <button type="button" onClick={() => void load(requested.current)}>
            Retry analytics
          </button>
        </Feedback>
      )}
      {result && (
        <>
          <div className="analytics-result-heading">
            <p data-testid="analytics-result-range">
              Showing {result.from} – {result.to} · {result.days.length}{" "}
              {result.days.length === 1 ? "day" : "days"} · UTC
            </p>
            <span>Recorded events, not unique people</span>
          </div>
          <Metrics
            items={[
              {
                label: "Scans",
                value: result.total.toLocaleString(),
                detail: "Recorded redirect events",
                testId: "analytics-total",
              },
              {
                label: "Links with scans",
                value: result.activeResources.toLocaleString(),
                detail: "At least one scan in this range",
              },
              {
                label: "Links in your library",
                value: result.totalResources.toLocaleString(),
                detail: "All your current QR links",
              },
            ]}
          />
          <section className="panel analytics-chart">
            <CountChart title="Scans over time" unit="Scans" points={result.days} />
          </section>
          <section className="panel analytics-top" aria-labelledby="analytics-top-title">
            <div className="analytics-range-heading">
              <div>
                <h2 id="analytics-top-title">Your most scanned links</h2>
                <p className="muted">The top ten for the range shown above.</p>
              </div>
              <Icon name="chart" />
            </div>
            {result.top.length === 0 ? (
              <div className="analytics-empty">
                <span className="section-icon">
                  <Icon name="chart" />
                </span>
                <h3>Your next scan starts the story.</h3>
                <p>
                  Share a QR link to see its activity here. You can also choose a different date
                  range.
                </p>
                <a className="button" href="#library">
                  Go to QR library
                </a>
              </div>
            ) : (
              <ol className="analytics-ranking">
                {result.top.map((item, index) => (
                  <li key={item.id}>
                    <span className="analytics-rank">{index + 1}</span>
                    <a href={`#studio/${item.id}`}>
                      <strong>{item.label || "Untitled QR"}</strong>
                      <span>
                        Open in Studio <Icon name="arrow" />
                      </span>
                    </a>
                    <b>
                      {item.count.toLocaleString()}
                      <small>{item.count === 1 ? "scan" : "scans"}</small>
                    </b>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <p className="analytics-method">
            Each recorded redirect counts as one scan, including repeats and automated requests.
            Counts do not identify visitors or confirm that the destination loaded.
          </p>
        </>
      )}
    </div>
  );
}
