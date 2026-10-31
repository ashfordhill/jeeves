import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { type ResourcePage, type WorkspaceClient, workspaceErrorMessage } from "./client.ts";
import {
  fieldLabel,
  formInput,
  type ResourceRecord,
  recordLabel,
  type WorkspaceCollection,
} from "./definition.ts";

export function RecordDialog({
  title,
  busy = false,
  onClose,
  children,
}: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="jrw-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="jrw-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="jrw-icon-button"
          aria-label={`Close ${title}`}
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}

function ParentPicker({
  client,
  relation,
  value,
  onChange,
  error,
}: {
  client: WorkspaceClient;
  relation: WorkspaceCollection["relationships"][number];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const parent = client.definition.collections.find((item) => item.id === relation.target);
  if (!parent) throw new Error("Unvalidated relationship target");
  const id = useId();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState<ResourcePage>();
  const [loading, setLoading] = useState(true),
    [failure, setFailure] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<ResourceRecord>();
  const cursor = cursors.at(-1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry deliberately repeats the parent choice request.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setFailure(undefined);
    setPage(undefined);
    client
      .list(relation.target, cursor, controller.signal)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch((error: unknown) => {
        if (active) setFailure(workspaceErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, relation.target, cursor, retry]);
  useEffect(() => {
    if (!value || selected?.id === value) return;
    const controller = new AbortController();
    let active = true;
    client
      .read(relation.target, value, controller.signal)
      .then((record) => {
        if (active) setSelected(record);
      })
      .catch((error: unknown) => {
        if (active) setFailure(workspaceErrorMessage(error));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, relation.target, value, selected?.id]);
  const options = page?.items ?? [];
  return (
    <div className="jrw-field jrw-parent">
      <label htmlFor={id}>
        {relation.label}
        <span className="jrw-required">Required</span>
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setSelected(options.find((item) => item.id === next));
          onChange(next);
        }}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="">Choose {relation.label.toLowerCase()}</option>
        {value && !options.some((record) => record.id === value) ? (
          <option value={value}>
            {selected?.id === value ? recordLabel(parent, selected) : "Selected record"}
          </option>
        ) : null}
        {options.map((record) => (
          <option value={record.id} key={record.id}>
            {recordLabel(parent, record)}
          </option>
        ))}
      </select>
      {error ? (
        <span id={`${id}-error`} className="jrw-field-error">
          {error}
        </span>
      ) : null}
      <div className="jrw-parent-controls">
        <span>
          {loading ? "Loading choices…" : `${options.length} choices on page ${cursors.length}`}
        </span>
        <button
          type="button"
          disabled={loading || cursors.length === 1}
          onClick={() => setCursors((prior) => prior.slice(0, -1))}
        >
          Previous choices
        </button>
        <button
          type="button"
          disabled={loading || !page?.nextCursor}
          onClick={() => setCursors((prior) => [...prior, page?.nextCursor ?? undefined])}
        >
          Next choices
        </button>
      </div>
      {failure ? (
        <div role="alert" className="jrw-field-error">
          {failure}{" "}
          <button type="button" onClick={() => setRetry((prior) => prior + 1)}>
            Retry choices
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function RecordForm({
  client,
  collection,
  record,
  onClose,
  onSaved,
}: {
  client: WorkspaceClient;
  collection: WorkspaceCollection;
  record?: ResourceRecord;
  onClose: () => void;
  onSaved: (record: ResourceRecord) => void;
}) {
  const prefix = useId();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [
        ...collection.fields.filter((field) => field.type !== "timestamp"),
        ...collection.relationships,
      ].map((field) => [field.name, String(record?.[field.name] ?? "")]),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const change = (name: string, value: string) => {
    setValues((prior) => ({ ...prior, [name]: value }));
    setErrors((prior) => {
      const next = { ...prior };
      delete next[name];
      return next;
    });
  };
  const submit = async () => {
    if (submitting.current) return;
    const parsed = formInput(collection, values, record);
    setErrors(parsed.errors);
    setFailure(undefined);
    if (!parsed.data) return;
    if (record && !parsed.changed) {
      onClose();
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const saved = record
        ? await client.update(collection.id, record.id, parsed.data)
        : await client.create(collection.id, parsed.data);
      if (active.current) onSaved(saved);
    } catch (error) {
      if (active.current) setFailure(workspaceErrorMessage(error));
    } finally {
      submitting.current = false;
      if (active.current) setSaving(false);
    }
  };
  return (
    <RecordDialog
      title={`${record ? "Edit" : "New"} ${collection.singularLabel}`}
      busy={saving}
      onClose={onClose}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="jrw-dialog-body">
          {record ? <p className="jrw-muted">{recordLabel(collection, record)}</p> : null}
          <fieldset disabled={saving} className="jrw-fields">
            {collection.fields
              .filter((field) => field.type !== "timestamp")
              .map((field) => {
                const id = `${prefix}-${field.id}`,
                  description = errors[field.name] ? `${id}-error` : `${id}-hint`;
                const common = {
                  id,
                  name: field.name,
                  value: values[field.name] ?? "",
                  "aria-invalid": !!errors[field.name],
                  "aria-describedby": description,
                  onChange: (event: { currentTarget: { value: string } }) =>
                    change(field.name, event.currentTarget.value),
                };
                return (
                  <div className="jrw-field" key={field.id}>
                    <label htmlFor={id}>
                      {field.label}
                      <span className="jrw-required">
                        {field.required ? "Required" : "Optional"}
                      </span>
                    </label>
                    {field.type === "enum" ? (
                      <select {...common}>
                        <option value="">{field.required ? "Choose a value" : "Not set"}</option>
                        {field.values.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "text" && field.maxLength > 500 ? (
                      <textarea {...common} rows={3} maxLength={field.maxLength} />
                    ) : (
                      <input
                        {...common}
                        type={
                          field.type === "integer"
                            ? "number"
                            : field.type === "http-url"
                              ? "url"
                              : "text"
                        }
                        {...(field.type === "integer"
                          ? { min: field.minimum, max: field.maximum, step: 1 }
                          : { maxLength: field.type === "text" ? field.maxLength : 8192 })}
                      />
                    )}
                    {errors[field.name] ? (
                      <span id={`${id}-error`} className="jrw-field-error">
                        {errors[field.name]}
                      </span>
                    ) : (
                      <span id={`${id}-hint`} className="jrw-hint">
                        {field.type === "text"
                          ? `Up to ${field.maxLength.toLocaleString()} characters`
                          : field.type === "integer"
                            ? `Whole number · ${field.minimum} to ${field.maximum}`
                            : field.type === "http-url"
                              ? "HTTP or HTTPS link"
                              : "Choose from the available values"}
                      </span>
                    )}
                  </div>
                );
              })}
            {collection.relationships.map((relation) => (
              <ParentPicker
                key={relation.id}
                client={client}
                relation={relation}
                value={values[relation.name] ?? ""}
                onChange={(value) => change(relation.name, value)}
                error={errors[relation.name]}
              />
            ))}
          </fieldset>
          {Object.keys(errors).length ? (
            <p role="alert" className="jrw-field-error">
              Review the highlighted fields.
            </p>
          ) : null}
          {failure ? (
            <p role="alert" className="jrw-field-error">
              {failure}
            </p>
          ) : null}
        </div>
        <footer className="jrw-dialog-footer">
          <button type="button" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="jrw-primary" disabled={saving}>
            {saving ? "Saving…" : "Save record"}
          </button>
        </footer>
      </form>
    </RecordDialog>
  );
}

export function recordValue(
  collection: WorkspaceCollection,
  property: string,
  record: ResourceRecord,
): string {
  const value = record[property];
  if (value === null || value === undefined || value === "") return "Not set";
  if (
    property === "createdAt" ||
    collection.fields.some((field) => field.name === property && field.type === "timestamp")
  )
    return `${new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(String(value)))} UTC`;
  return String(value);
}
function RelatedRecordLabel({
  client,
  target,
  id,
}: {
  client: WorkspaceClient;
  target: string;
  id: string;
}) {
  const parent = client.definition.collections.find((item) => item.id === target);
  const [label, setLabel] = useState<string>(),
    [failure, setFailure] = useState(false);
  useEffect(() => {
    let active = true;
    client
      .read(target, id)
      .then((record) => {
        if (active && parent) setLabel(recordLabel(parent, record));
      })
      .catch(() => {
        if (active) setFailure(true);
      });
    // Ignore a closed view's result; the transport still bounds this read and rejects an account change.
    return () => {
      active = false;
    };
  }, [client, target, id, parent]);
  return (
    <span>{failure ? "Related record unavailable" : (label ?? "Loading related record…")}</span>
  );
}

export function RecordDetails({
  client,
  collection,
  id,
  onClose,
  onEdit,
}: {
  client: WorkspaceClient;
  collection: WorkspaceCollection;
  id: string;
  onClose: () => void;
  onEdit: (record: ResourceRecord) => void;
}) {
  const [record, setRecord] = useState<ResourceRecord>(),
    [failure, setFailure] = useState<string>();
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    client
      .read(collection.id, id, controller.signal)
      .then((result) => {
        if (active) setRecord(result);
      })
      .catch((error: unknown) => {
        if (active) setFailure(workspaceErrorMessage(error));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, collection.id, id]);
  return (
    <RecordDialog
      title={record ? recordLabel(collection, record) : collection.label}
      onClose={onClose}
    >
      <div className="jrw-dialog-body">
        {failure ? (
          <p role="alert" className="jrw-field-error">
            {failure}
          </p>
        ) : !record ? (
          <p role="status">Loading record…</p>
        ) : (
          <dl className="jrw-record-detail">
            {[
              ...collection.fields.map((field) => field.name),
              ...collection.relationships.map((relation) => relation.name),
              "id",
              "createdAt",
            ].map((property) => (
              <div key={property}>
                <dt>{fieldLabel(collection, property)}</dt>
                <dd>
                  {collection.relationships.some((relation) => relation.name === property) ? (
                    <RelatedRecordLabel
                      client={client}
                      target={
                        collection.relationships.find((relation) => relation.name === property)
                          ?.target ?? ""
                      }
                      id={String(record[property])}
                    />
                  ) : collection.fields.some(
                      (field) => field.name === property && field.type === "http-url",
                    ) && record[property] ? (
                    <a href={String(record[property])} target="_blank" rel="noreferrer noopener">
                      {recordValue(collection, property, record)}
                    </a>
                  ) : (
                    recordValue(collection, property, record)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <footer className="jrw-dialog-footer">
        <button type="button" onClick={onClose}>
          Close record
        </button>
        {record && collection.operations.includes("update") ? (
          <button type="button" className="jrw-primary" onClick={() => onEdit(record)}>
            Edit record
          </button>
        ) : null}
      </footer>
    </RecordDialog>
  );
}
