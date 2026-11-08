// A lane action's Name (the one word on its tile), autosaving like a tile's name: valid text
// saves after 500ms or on blur through `renameAction`; an invalid draft shows the rule's own
// message ("Use 24 characters or fewer.").
import {
  buildStudioCommand,
  type DesignDocument,
  laneActionName,
  type StudioLane,
  studioLaneActionNameSchema,
} from "@jeeves/spec";
import { useEffect, useId, useMemo, useSyncExternalStore } from "react";
import { type DraftErrors, type DraftSpec, formDrafts } from "../project/form-drafts.ts";

const path = "action.name";

/** The draft for one lane's action name, or `undefined` when the design has no such action. */
export function actionSpec(
  projectId: string,
  lane: StudioLane,
  design: DesignDocument,
): DraftSpec | undefined {
  const read: DraftSpec["read"] = (current) => {
    const name = laneActionName(current, lane);
    return name === undefined ? undefined : { [path]: name };
  };
  const label = laneActionName(design, lane);
  if (label === undefined) return;
  return {
    projectId,
    target: `action:${lane}`,
    definition: "studio-action@1",
    label,
    read,
    validate(values) {
      const parsed = studioLaneActionNameSchema.safeParse(values[path]);
      const errors: DraftErrors = {};
      if (!parsed.success) errors[path] = parsed.error.issues[0]?.message ?? "Enter a name";
      return errors;
    },
    build(current, values) {
      return buildStudioCommand(current, {
        type: "renameAction",
        lane,
        name: String(values[path]),
      }).ops;
    },
  };
}

export function ActionForm({
  projectId,
  lane,
  design,
}: {
  projectId: string;
  lane: StudioLane;
  design: DesignDocument;
}) {
  const spec = useMemo(() => actionSpec(projectId, lane, design), [projectId, lane, design]);
  return spec ? <ActionDraftForm spec={spec} design={design} /> : null;
}

function ActionDraftForm({ spec, design }: { spec: DraftSpec; design: DesignDocument }) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const entry = formDrafts.open(spec, design);
  useEffect(() => () => formDrafts.leave(entry.key), [entry.key]);
  const inputId = `${useId()}-${path}`;
  const errorId = `${inputId}-error`;
  const error = entry.errors[path];
  return (
    <form
      className="studio-inspector-form"
      aria-label="Action settings"
      onSubmit={(event) => {
        event.preventDefault();
        void formDrafts.flush(entry.key);
      }}
    >
      <div className="studio-form-field">
        <label htmlFor={inputId}>Name</label>
        <input
          id={inputId}
          value={String(entry.values[path] ?? "")}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => formDrafts.change(entry.key, { [path]: event.currentTarget.value })}
          onBlur={() => void formDrafts.flush(entry.key)}
        />
        {error ? (
          <span id={errorId} className="studio-field-error">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
