import { EmptyState, Feedback } from "@jeeves/product-ui";
import { useApis } from "@jeeves/web-runtime";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { paths } from "../clients/qrwty.openapi.ts";
import type { app } from "../jeeves.generated.ts";
import { Analytics } from "./Analytics.tsx";
import { message } from "./apiMessage.ts";
import { CopyLink } from "./CopyLink.tsx";
import { Icon } from "./Icon.tsx";
import { QrDetails } from "./QrDetails.tsx";
import { hasDraftChanges, QrStudio, type StudioDraft } from "./QrStudio.tsx";

export type Qr = paths["/api/qr/{id}"]["get"]["responses"][200]["content"]["application/json"];
export const publicLink = (id: string) => `${window.location.origin}/q/${id}`;
export function destinationError(value: string) {
  try {
    const url = new URL(value);
    if (
      !/^https?:\/\//i.test(value) ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      value.match(/^https?:\/\/[^/?#]*@/i)
    )
      throw new Error();
    return "";
  } catch {
    return "Enter an absolute HTTP or HTTPS destination without credentials.";
  }
}

export function QrDashboard({
  csrfToken,
  onUnauthorized,
  section,
}: {
  csrfToken: string;
  onUnauthorized: () => void;
  section: string;
}) {
  const { qrwty: client } = useApis<typeof app.apis>();
  const [items, setItems] = useState<Qr[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const mounted = useRef(true);
  const loadVersion = useRef(0);
  const drafts = useRef(new Map<string, StudioDraft>());
  const studioId = /^#studio\/([0-9a-f-]{36})$/i.exec(section)?.[1];
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if ([...drafts.current.values()].some(hasDraftChanges)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    if (section.startsWith("#studio") || section === "#analytics") window.scrollTo(0, 0);
    else if (section === "#library" || section === "#create")
      document.getElementById(section.slice(1))?.scrollIntoView();
  }, [section]);

  async function load(next?: string) {
    const version = ++loadVersion.current;
    setLoading(true);
    setListError("");
    try {
      const { data, error, response } = await client.GET("/api/qr", {
        params: { query: { limit: 25, ...(next ? { cursor: next } : {}) } },
      });
      if (!mounted.current || version !== loadVersion.current) return;
      if (response.status === 401) return onUnauthorized();
      if (!data) {
        setListError(message(error));
        return;
      }
      setItems((previous) => {
        const rows = next ? [...previous, ...data.items] : data.items;
        return [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
      });
      setCursor(data.nextCursor);
    } catch {
      if (mounted.current && version === loadVersion.current)
        setListError("Unable to load QR links. Please retry.");
    } finally {
      if (mounted.current && version === loadVersion.current) setLoading(false);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload on client replacement; load uses the current client and mounted/version refs.
  useEffect(() => {
    mounted.current = true;
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      mounted.current = false;
      loadVersion.current++;
    };
  }, [client]);

  async function create(event: FormEvent) {
    event.preventDefault();
    const invalid = destinationError(destination);
    if (invalid) {
      setError(invalid);
      return;
    }
    setCreating(true);
    setError("");
    setCreated(null);
    try {
      const { data, error, response } = await client.POST("/api/qr", {
        body: { destination, title: title || null },
        headers: { "x-csrf-token": csrfToken },
      });
      if (!mounted.current) return;
      if (response.status === 401) return onUnauthorized();
      if (!data) {
        setError(message(error));
        return;
      }
      setDestination("");
      setTitle("");
      setCreated(data.id);
      await load();
    } catch {
      if (mounted.current) setError("Unable to create your QR link. Please try again.");
    } finally {
      if (mounted.current) setCreating(false);
    }
  }

  if (section === "#analytics") return <Analytics onUnauthorized={onUnauthorized} />;
  if (studioId)
    return (
      <QrStudio
        key={studioId}
        id={studioId}
        csrfToken={csrfToken}
        drafts={drafts.current}
        onUnauthorized={onUnauthorized}
      />
    );
  if (section === "#studio")
    return (
      <section className="panel studio-chooser">
        <span className="section-icon">
          <Icon name="palette" />
        </span>
        <h2>Choose a link. Make it yours.</h2>
        <p className="muted">Your Studio designs keep the same permanent QR link.</p>
        {loading && <Feedback>Loading your links…</Feedback>}
        {listError && (
          <Feedback kind="error">
            {listError}{" "}
            <button type="button" onClick={() => void load()}>
              Retry
            </button>
          </Feedback>
        )}
        <div className="studio-chooser-links">
          {items.map((qr) => (
            <a className="button" key={qr.id} href={`#studio/${qr.id}`}>
              {qr.title || "Untitled QR"}
              <Icon name="arrow" />
            </a>
          ))}
        </div>
        <a className="button primary" href="#create">
          <Icon name="plus" />
          Create a QR link
        </a>
      </section>
    );
  return (
    <div className="library-layout">
      <section className="panel create-panel" id="create" aria-labelledby="create-heading">
        <span className="section-icon">
          <Icon name="plus" />
        </span>
        <h2 id="create-heading">Make a connection.</h2>
        <p className="muted">
          Start with a destination. Your QR link stays yours when plans change.
        </p>
        <form data-testid="qr-create-form" onSubmit={create}>
          <label>
            Destination
            <input
              data-testid="qr-destination"
              type="url"
              placeholder="https://example.com"
              required
              maxLength={8192}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </label>
          <label>
            Title (optional)
            <input
              data-testid="qr-title"
              placeholder="e.g. Spring collection"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <button className="primary" data-testid="qr-create" disabled={creating} type="submit">
            {creating ? "Creating…" : "Create QR link"}
            <Icon name="arrow" />
          </button>
        </form>
        {error && <Feedback kind="error">{error}</Feedback>}
        {created && (
          <Feedback>
            Ready to share. <a href={publicLink(created)}>{publicLink(created)}</a>
          </Feedback>
        )}
        <div className="create-note">
          <Icon name="link" />
          <p>
            One permanent link.
            <br />
            <span className="muted">Update the destination, keep the code.</span>
          </p>
        </div>
      </section>
      <section id="library" aria-label="Your QR links" className="qr-list">
        <div className="section-heading">
          <div>
            <h2>Your links</h2>
            <small>Newest first{items.length > 0 ? ` · ${items.length} loaded` : ""}</small>
          </div>
          <button type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {loading && <Feedback>Loading QR links…</Feedback>}
        {listError && (
          <Feedback kind="error">
            {listError}{" "}
            <button type="button" onClick={() => void load()}>
              Retry
            </button>
          </Feedback>
        )}
        {!loading && !listError && items.length === 0 && (
          <EmptyState
            title="Your next idea starts with a link."
            action={
              <a className="button" href="#create">
                Create your first QR link
                <Icon name="arrow" />
              </a>
            }
          >
            A menu, a launch, a little something worth sharing. Give it a code that can grow with
            you.
          </EmptyState>
        )}
        {items.map((qr) => (
          <article className="panel qr-row" data-testid="qr-row" data-qr-id={qr.id} key={qr.id}>
            <div className="section-heading">
              <div className="qr-identity">
                <span className="section-icon">
                  <Icon name="link" />
                </span>
                <h3>{qr.title || "Untitled"}</h3>
              </div>
              <div className="row-actions">
                <a className="button" data-testid="studio-open" href={`#studio/${qr.id}`}>
                  <Icon name="palette" />
                  Studio
                </a>
                <button
                  type="button"
                  data-testid="qr-select"
                  aria-expanded={selected === qr.id}
                  aria-controls={`details-${qr.id}`}
                  onClick={() => setSelected(selected === qr.id ? null : qr.id)}
                >
                  {selected === qr.id ? "Close details" : "Manage"}
                </button>
              </div>
            </div>
            <p className="destination">{qr.destination}</p>
            <p className="created-at">
              Created{" "}
              <time dateTime={qr.createdAt}>
                {new Date(qr.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            </p>
            <p className="public-link">
              <a data-testid="qr-public-link" href={publicLink(qr.id)}>
                {publicLink(qr.id)}
              </a>
            </p>
            <CopyLink value={publicLink(qr.id)} />
            <div id={`details-${qr.id}`} hidden={selected !== qr.id}>
              {selected === qr.id && (
                <QrDetails
                  qr={qr}
                  csrfToken={csrfToken}
                  onUnauthorized={onUnauthorized}
                  onSaved={(updated) =>
                    setItems((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))
                  }
                />
              )}
            </div>
          </article>
        ))}
        {cursor && (
          <button type="button" disabled={loading} onClick={() => void load(cursor)}>
            Load more
          </button>
        )}
      </section>
    </div>
  );
}
