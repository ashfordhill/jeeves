import {
  type DesignDocument,
  type StudioConnectionSettings,
  type StudioFieldGroup,
  studioConnectionFieldGroups,
  studioConnectionFields,
} from "@jeeves/spec";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { formDrafts } from "../draw/form-drafts.ts";
import {
  connectionChange,
  connectionQueue,
  connectionSettings,
  connectionSpec,
  type RelationshipTarget,
} from "./connection-drafts.ts";

export function ConnectionForm({
  projectId,
  target,
  design,
}: {
  projectId: string;
  target: RelationshipTarget;
  design: DesignDocument;
}) {
  const spec = useMemo(
    () => connectionSpec(projectId, target, design),
    [projectId, target, design],
  );
  return spec ? <TargetConnectionForm spec={spec} target={target} design={design} /> : null;
}
function TargetConnectionForm({
  spec,
  target,
  design,
}: {
  spec: NonNullable<ReturnType<typeof connectionSpec>>;
  target: RelationshipTarget;
  design: DesignDocument;
}) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const entry = formDrafts.open(spec, design);
  useEffect(() => () => formDrafts.leave(entry.key), [entry.key]);
  const id = useId();
  const [selected, setSelected] = useState<StudioFieldGroup>("General");
  const groups =
    target.kind === "context"
      ? [
          {
            group: "General" as const,
            fields: studioConnectionFields.filter((field) => field.path === "planned.label"),
          },
        ]
      : studioConnectionFieldGroups({
          protocol: String(entry.values["planned.protocol"]),
          interaction: String(entry.values["planned.interaction"]),
          settings: connectionSettings(entry.values) as StudioConnectionSettings,
          queue: connectionQueue(design, target.id),
        });
  const active = groups.find((item) => item.group === selected) ?? groups[0];
  if (!active) return null;
  return (
    <form
      className="studio-inspector-form"
      aria-label="Connection settings"
      onSubmit={(event) => {
        event.preventDefault();
        void formDrafts.flush(entry.key);
      }}
    >
      {groups.length > 1 ? (
        <div className="studio-inspector-tabs" role="tablist" aria-label="Inspector sections">
          {groups.map(({ group }) => (
            <button
              type="button"
              role="tab"
              key={group}
              id={`${id}-${group}-tab`}
              aria-selected={active.group === group}
              aria-controls={`${id}-${group}`}
              onClick={() => {
                void formDrafts.flush(entry.key);
                setSelected(group);
              }}
            >
              {group}
            </button>
          ))}
        </div>
      ) : null}
      <div
        role="tabpanel"
        id={`${id}-${active.group}`}
        aria-label={groups.length === 1 ? active.group : undefined}
        aria-labelledby={groups.length > 1 ? `${id}-${active.group}-tab` : undefined}
      >
        {active.fields.map((field) => {
          const value = entry.values[field.path],
            error = entry.errors[field.path],
            inputId = `${id}-${field.path}`;
          const common = {
            id: inputId,
            "aria-invalid": !!error,
            "aria-describedby": error ? `${inputId}-error` : undefined,
            onBlur: () => void formDrafts.flush(entry.key),
          };
          return (
            <div className="studio-form-field" key={field.path}>
              <label htmlFor={inputId}>{field.label}</label>
              {field.control === "text" ? (
                <input
                  {...common}
                  value={String(value ?? "")}
                  onChange={(event) =>
                    formDrafts.change(entry.key, { [field.path]: event.currentTarget.value })
                  }
                />
              ) : field.control === "integer" ? (
                <input
                  {...common}
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={1}
                  placeholder="Unspecified"
                  value={typeof value === "number" || typeof value === "string" ? value : ""}
                  onInput={(event) =>
                    formDrafts.change(entry.key, {
                      [field.path]: event.currentTarget.validity.badInput
                        ? ""
                        : event.currentTarget.value === ""
                          ? undefined
                          : Number(event.currentTarget.value),
                    })
                  }
                />
              ) : (
                <select
                  {...common}
                  value={String(value ?? "unspecified")}
                  onChange={(event) =>
                    formDrafts.change(
                      entry.key,
                      connectionChange(entry.values, field.path, event.currentTarget.value),
                      true,
                    )
                  }
                >
                  {field.choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              )}
              {error ? (
                <span className="studio-field-error" id={`${inputId}-error`}>
                  {error}
                </span>
              ) : null}
              {"unit" in field && field.unit ? <small>{field.unit}</small> : null}
              {field.path === "settings.retry.mode" && field.help ? (
                <small>{field.help}</small>
              ) : null}
            </div>
          );
        })}
      </div>
    </form>
  );
}
