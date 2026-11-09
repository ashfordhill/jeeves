import type { DesignDocument } from "@jeeves/spec";
import { useEffect, useId, useMemo, useSyncExternalStore } from "react";
import { formDrafts } from "../project/form-drafts.ts";
import { connectionSpec } from "./connection-drafts.ts";

/** Connection policy is retained source intent; only its useful label is normally editable. */
export function ConnectionForm({
  projectId,
  connection,
  design,
}: {
  projectId: string;
  connection: string;
  design: DesignDocument;
}) {
  const spec = useMemo(
    () => connectionSpec(projectId, connection, design),
    [projectId, connection, design],
  );
  return spec ? <TargetConnectionForm spec={spec} design={design} /> : null;
}
function TargetConnectionForm({
  spec,
  design,
}: {
  spec: NonNullable<ReturnType<typeof connectionSpec>>;
  design: DesignDocument;
}) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const entry = formDrafts.open(spec, design);
  useEffect(() => () => formDrafts.leave(entry.key), [entry.key]);
  const id = useId();
  const error = entry.errors["planned.label"];
  return (
    <form
      className="studio-inspector-form"
      aria-label="Connection settings"
      onSubmit={(event) => {
        event.preventDefault();
        void formDrafts.flush(entry.key);
      }}
    >
      <div className="studio-form-field">
        <label htmlFor={id}>Action</label>
        <input
          id={id}
          value={String(entry.values["planned.label"] ?? "")}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) =>
            formDrafts.change(entry.key, { "planned.label": event.currentTarget.value })
          }
          onBlur={() => void formDrafts.flush(entry.key)}
        />
        {error ? (
          <span id={`${id}-error`} className="studio-field-error">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
