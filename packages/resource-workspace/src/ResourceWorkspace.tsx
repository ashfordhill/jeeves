import { EmptyState, Feedback, PageHeader, ProductShell } from "@jeeves/product-ui";
import { type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import {
  type ResourcePage,
  type WorkspaceClient,
  WorkspaceError,
  workspaceErrorMessage,
} from "./client.ts";
import {
  fieldLabel,
  type ResourceRecord,
  recordLabel,
  type WorkspaceCollection,
} from "./definition.ts";
import { RecordDetails, RecordForm, recordValue } from "./RecordForm.tsx";

function AccountForm({ client }: { client: WorkspaceClient }) {
  const prefix = useId();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const submitting = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await client.authenticate(mode, { email: email.trim(), password });
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof WorkspaceError && failure.status === 401
            ? "Email or password was not recognized."
            : workspaceErrorMessage(failure),
        );
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <section className="jrw-auth" aria-label="Account access">
      <div className="jrw-auth-mark" aria-hidden="true">
        ↗
      </div>
      <h1>{mode === "login" ? "Welcome back" : "Your workspace starts here"}</h1>
      <p className="jrw-muted">
        {mode === "login"
          ? "Sign in to your private workspace."
          : "Create an account to organize your records."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="jrw-field">
          <label htmlFor={`${prefix}-email`}>Email</label>
          <input
            id={`${prefix}-email`}
            type="email"
            autoComplete="username"
            maxLength={254}
            required
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
        </div>
        <div className="jrw-field">
          <label htmlFor={`${prefix}-password`}>Password</label>
          <input
            id={`${prefix}-password`}
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={12}
            maxLength={128}
            required
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <span className="jrw-hint">At least 12 characters</span>
        </div>
        {error ? <Feedback kind="error">{error}</Feedback> : null}
        <button className="jrw-primary" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          className="jrw-text-button"
          disabled={busy}
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(undefined);
            setPassword("");
          }}
        >
          {mode === "login" ? "Create an account" : "Use existing account"}
        </button>
      </form>
    </section>
  );
}

function CollectionPage({
  client,
  collection,
}: {
  client: WorkspaceClient;
  collection: WorkspaceCollection;
}) {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState<ResourcePage>();
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0),
    [notice, setNotice] = useState<string>();
  const [form, setForm] = useState<{ record?: ResourceRecord }>(),
    [details, setDetails] = useState<string>();
  const cursor = cursors.at(-1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Refresh deliberately repeats the current page request.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    setPage(undefined);
    client
      .list(collection.id, cursor, controller.signal)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch((failure: unknown) => {
        if (active) setError(workspaceErrorMessage(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, collection.id, cursor, refresh]);
  const create = collection.operations.includes("create");
  const newRecord = (
    <button
      type="button"
      className="jrw-primary"
      onClick={() => {
        setNotice(undefined);
        setForm({});
      }}
    >
      New record
    </button>
  );
  return (
    <>
      <PageHeader
        eyebrow="Your workspace"
        title={collection.label}
        description={collection.description}
        actions={
          <div className="jrw-actions">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setNotice(undefined);
                setRefresh((prior) => prior + 1);
              }}
            >
              Refresh records
            </button>
            {create ? newRecord : null}
          </div>
        }
      />
      {notice ? <Feedback>{notice}</Feedback> : null}
      {error ? <Feedback kind="error">{error}</Feedback> : null}
      {loading ? (
        <div className="jrw-loading" role="status">
          Loading records…
        </div>
      ) : page?.items.length ? (
        <div className="jrw-records">
          <div className="jrw-list-summary">
            <span>
              {page.items.length} {page.items.length === 1 ? "record" : "records"} on this page
            </span>
            <span>Newest first</span>
          </div>
          <section
            className="jrw-table-scroll"
            aria-label={`${collection.label} records`}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: The overflowing records region needs keyboard scrolling.
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  {collection.columns.map((property) => (
                    <th key={property} scope="col">
                      {fieldLabel(collection, property)}
                    </th>
                  ))}
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((record) => (
                  <tr key={record.id}>
                    {collection.columns.map((property) => (
                      <td key={property} data-label={fieldLabel(collection, property)}>
                        {property === collection.primaryField ? (
                          <button
                            type="button"
                            className="jrw-record-link"
                            onClick={() => setDetails(record.id)}
                          >
                            {recordValue(collection, property, record)}
                          </button>
                        ) : (
                          <span>{recordValue(collection, property, record)}</span>
                        )}
                      </td>
                    ))}
                    <td className="jrw-row-actions" data-label="Actions">
                      <button
                        type="button"
                        aria-label={`View ${recordLabel(collection, record)}`}
                        onClick={() => setDetails(record.id)}
                      >
                        View
                      </button>
                      {collection.operations.includes("update") ? (
                        <button
                          type="button"
                          aria-label={`Edit ${recordLabel(collection, record)}`}
                          onClick={() => setForm({ record })}
                        >
                          Edit
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : page ? (
        <EmptyState
          title={
            cursors.length === 1
              ? `No ${collection.label.toLowerCase()} yet`
              : "No records on this page"
          }
          action={create ? newRecord : undefined}
        >
          {create
            ? "Add your first record to get started."
            : "Records shared with your account will appear here."}
        </EmptyState>
      ) : null}
      <nav className="jrw-pagination" aria-label="Record pages">
        <span>Page {cursors.length}</span>
        <div>
          <button
            type="button"
            disabled={loading || cursors.length === 1}
            onClick={() => {
              setNotice(undefined);
              setCursors((prior) => prior.slice(0, -1));
            }}
          >
            Previous page
          </button>
          <button
            type="button"
            disabled={loading || !page?.nextCursor}
            onClick={() => {
              setNotice(undefined);
              setCursors((prior) => [...prior, page?.nextCursor ?? undefined]);
            }}
          >
            Next page
          </button>
        </div>
      </nav>
      {form ? (
        <RecordForm
          client={client}
          collection={collection}
          record={form.record}
          onClose={() => setForm(undefined)}
          onSaved={(record) => {
            setForm(undefined);
            setNotice(`Saved ${recordLabel(collection, record)}.`);
            if (!form.record) setCursors([undefined]);
            setRefresh((prior) => prior + 1);
          }}
        />
      ) : null}
      {details ? (
        <RecordDetails
          client={client}
          collection={collection}
          id={details}
          onClose={() => setDetails(undefined)}
          onEdit={(record) => {
            setDetails(undefined);
            setForm({ record });
          }}
        />
      ) : null}
    </>
  );
}

export interface ResourceWorkspaceProps {
  client: WorkspaceClient;
  extraContent?: ReactNode;
}
/** The client's validated definition owns screens and transport. Extra content is a narrow additive seam. */
export function ResourceWorkspace({ client, extraContent }: ResourceWorkspaceProps) {
  const identity = useSyncExternalStore(client.subscribe, client.identity, client.identity);
  const [loading, setLoading] = useState(!identity),
    [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0),
    [signingOut, setSigningOut] = useState(false);
  const [hash, setHash] = useState(() => globalThis.location?.hash ?? "");
  const logoutPending = useRef(false);
  useEffect(() => {
    const update = () => setHash(location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry deliberately repeats session restoration.
  useEffect(() => {
    if (client.identity()) {
      setLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    client
      .restore(controller.signal)
      .catch((failure: unknown) => {
        if (active) setError(workspaceErrorMessage(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, retry]);
  const definition = client.definition;
  const collection =
    definition.collections.find((item) => hash === `#collection/${item.id}`) ??
    definition.collections[0];
  if (!collection) throw new Error("Workspace has no collection");
  const logout = async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setSigningOut(true);
    setError(undefined);
    try {
      await client.logout();
    } catch (failure) {
      setError(workspaceErrorMessage(failure));
    } finally {
      logoutPending.current = false;
      setSigningOut(false);
    }
  };
  return (
    <div className="jrw-root" data-preset={definition.preset}>
      <ProductShell
        name={definition.title}
        tagline={definition.tagline}
        mark={
          <span className="jrw-mark" aria-hidden="true">
            {definition.title.charAt(0)}
          </span>
        }
        navigation={
          identity
            ? definition.collections.map((item) => ({
                href: `#collection/${item.id}`,
                label: item.label,
                current: item.id === collection.id,
              }))
            : []
        }
        footer={
          identity ? (
            <div className="jrw-account">
              <span>Private workspace</span>
              <button type="button" disabled={signingOut} onClick={() => void logout()}>
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : (
            <span>Your records stay with your account.</span>
          )
        }
      >
        {!identity && (loading || error) ? (
          <PageHeader
            eyebrow="Account access"
            title={definition.title}
            description="Connect to open your workspace."
          />
        ) : null}
        {error ? (
          <Feedback kind="error">
            {error}
            {!identity ? (
              <button type="button" onClick={() => setRetry((prior) => prior + 1)}>
                Retry connection
              </button>
            ) : null}
          </Feedback>
        ) : null}
        {loading ? (
          <div className="jrw-loading" role="status">
            Opening workspace…
          </div>
        ) : identity ? (
          <CollectionPage
            key={`${identity.id}:${collection.id}`}
            client={client}
            collection={collection}
          />
        ) : error ? null : (
          <AccountForm client={client} />
        )}
        {identity ? extraContent : null}
      </ProductShell>
    </div>
  );
}
