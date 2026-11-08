import { type DesignDocument, type OperationReceiver, positiveCachePolicy } from "@jeeves/spec";

type Binding = Extract<OperationReceiver["binding"], { kind: "resolve-link" }>;
/** These are the same finite fields accepted by configureOperations, with no policy DSL. */
export function ResolveFields({
  design,
  id,
  role,
  binding,
  onChange,
}: {
  design: DesignDocument;
  id: string;
  role: string;
  binding: Binding;
  onChange: (binding: Binding) => void;
}) {
  const name = (id: string) => design.elements.find((x) => x.id === id)?.name ?? id;
  const links = (kind: "database" | "cache") =>
    design.connections.filter(
      (x) =>
        x.from.element === role &&
        design.architecture?.studio?.elements.some(
          (e) => e.element === x.to.element && e.settings.kind === kind,
        ),
    );
  return (
    <>
      <p>Public GET /links/&#123;code&#125; · 307 Location · no-store on every outcome.</p>
      <p className="studio-field-help">
        400 invalid input · 404 unknown · 410 expired · 503 dependency failure / overload. Immutable
        target; durable expiration evidence and no code reuse. Primary lookup, never replica lag.
      </p>
      {(["storeConnection", "cacheConnection"] as const).map((field) => (
        <label key={field}>
          {field === "storeConnection"
            ? "Authoritative primary read connection"
            : "Positive cache read & fill connection"}
          <select
            aria-label={`${id} resolve ${field}`}
            value={binding[field] ?? ""}
            onChange={(e) => onChange({ ...binding, [field]: e.target.value || null })}
          >
            {field === "cacheConnection" ? <option value="">Unspecified</option> : null}
            {binding[field] &&
            !links(field === "storeConnection" ? "database" : "cache").some(
              (x) => x.id === binding[field],
            ) ? (
              <option value={binding[field] ?? ""}>{binding[field]} · unresolved</option>
            ) : null}
            {links(field === "storeConnection" ? "database" : "cache").map((x) => (
              <option key={x.id} value={x.id}>
                {name(x.to.element)} · {x.id}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="operation-check">
        <input
          type="checkbox"
          aria-label={`${id} pinned positive cache policy`}
          checked={
            binding.cachePolicy?.sha256 === positiveCachePolicy.ref.sha256 &&
            binding.cachePolicy.id === positiveCachePolicy.ref.id &&
            binding.cachePolicy.version === positiveCachePolicy.ref.version
          }
          onChange={(e) =>
            onChange({
              ...binding,
              cachePolicy: e.target.checked ? { ...positiveCachePolicy.ref } : null,
            })
          }
        />
        Declare Positive cache · clamp to record expiry v1
      </label>
      <p className="studio-field-help">
        At most 300s, clamped at each write to record expiry. Cache read/fill ≤50ms; primary
        ≤1000ms. One total 1200ms deadline. At most 64 primary calls shared per runtime instance;
        immediate 503 when full. No retries, negative cache, L1 or response cache. Fill failure
        preserves timely authoritative success.
      </p>
      <p className="studio-field-help">
        A shared API can have several operations. Its optional global request timeout must agree
        with every declared operation; leave it unspecified to retain distinct operation deadlines.
        No setting is rewritten.
      </p>
      <details>
        <summary>Cache policy exact reference · {id}</summary>
        <p>
          Unknown exact references remain unresolved. Template, clock and adapter evidence are
          unavailable.
        </p>
        {(["id", "version", "sha256"] as const).map((field) => (
          <label key={field}>
            {field === "id" ? "Policy ID" : field === "version" ? "Exact version" : "SHA256"}
            <input
              aria-label={`${id} cache policy ${field}`}
              maxLength={field === "id" ? 63 : field === "version" ? 40 : 64}
              value={binding.cachePolicy?.[field] ?? ""}
              onChange={(e) =>
                onChange({
                  ...binding,
                  cachePolicy: {
                    ...(binding.cachePolicy ?? { id: "", version: "", sha256: "" }),
                    [field]: e.target.value,
                  },
                })
              }
            />
          </label>
        ))}
        <button type="button" onClick={() => onChange({ ...binding, cachePolicy: null })}>
          Clear cache policy {id}
        </button>
      </details>
    </>
  );
}
