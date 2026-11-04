import {
  buildStudioCommand,
  type DesignDocument,
  studioDefinitions,
  studioFieldGroups,
  studioLimits,
  studioServiceSettingsSchema,
} from "@jeeves/spec";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { type DraftSpec, type DraftValues, formDrafts } from "../draw/form-drafts.ts";

function settings(values: DraftValues) {
  return Object.fromEntries(
    Object.entries(values).flatMap(([path, value]) =>
      path.startsWith("settings.") && value !== undefined ? [[path.slice(9), value]] : [],
    ),
  );
}

function serviceSpec(projectId: string, id: string, label: string): DraftSpec {
  return {
    projectId,
    target: `element:${id}`,
    definition: "studio-service@1.0.0",
    label,
    read(design) {
      const binding = design.architecture?.studio?.elements.find((item) => item.element === id);
      const element = design.elements.find((item) => item.id === id);
      if (
        !element ||
        binding?.definition.id !== "studio-service" ||
        binding.definition.version !== "1.0.0" ||
        binding.settings.kind !== "service"
      )
        return;
      return {
        "element.name": element.name,
        "element.description": element.description ?? "",
        ...Object.fromEntries(
          Object.entries(binding.settings).map(([path, value]) => [`settings.${path}`, value]),
        ),
      };
    },
    validate(values) {
      const errors: Record<string, string> = {};
      if (typeof values["element.name"] !== "string" || !values["element.name"].trim())
        errors["element.name"] = "Enter a name";
      else if (values["element.name"].length > studioLimits.name)
        errors["element.name"] = `Use ${studioLimits.name} characters or fewer`;
      if (
        typeof values["element.description"] !== "string" ||
        values["element.description"].length > studioLimits.description
      )
        errors["element.description"] = `Use ${studioLimits.description} characters or fewer`;
      const parsed = studioServiceSettingsSchema.safeParse(settings(values));
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          errors[`settings.${String(issue.path[0])}`] = issue.message;
      return errors;
    },
    build(design, values, paths) {
      return buildStudioCommand(design, {
        type: "edit",
        element: id,
        ...(paths.includes("element.name") && { name: String(values["element.name"]) }),
        ...(paths.includes("element.description") && {
          description: String(values["element.description"]),
        }),
        ...(paths.some((path) => path.startsWith("settings.")) && {
          settings: studioServiceSettingsSchema.parse(settings(values)),
        }),
      }).ops;
    },
  };
}

/** UX06a's representative finite form; other definitions remain read-only until UX07. */
export function ServiceForm({
  projectId,
  id,
  name,
  design,
}: {
  projectId: string;
  id: string;
  name: string;
  design: DesignDocument;
}) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const spec = useMemo(() => serviceSpec(projectId, id, name), [projectId, id, name]);
  const entry = formDrafts.open(spec, design);
  useEffect(() => () => formDrafts.leave(entry.key), [entry.key]);
  const parsed = studioServiceSettingsSchema.safeParse(settings(entry.values));
  const groups = studioFieldGroups(
    parsed.success ? parsed.data : studioDefinitions.service.defaults,
  );
  return (
    <form
      className="studio-service-form"
      aria-label="Microservice settings"
      onSubmit={(event) => {
        event.preventDefault();
        void formDrafts.flush(entry.key);
      }}
    >
      {groups.map((group) => (
        <fieldset key={group.group}>
          <legend>{group.group}</legend>
          {group.fields.map((field) => {
            if (field.control !== "text" && field.control !== "select") return null;
            const value = String(entry.values[field.path] ?? "");
            const error = entry.errors[field.path];
            const inputId = `service-${id}-${field.path}`;
            const errorId = `${inputId}-error`;
            return (
              <div className="studio-form-field" key={field.path}>
                <label htmlFor={inputId}>{field.label}</label>
                {field.control === "text" ? (
                  field.path === "element.description" ? (
                    <textarea
                      id={inputId}
                      value={value}
                      rows={3}
                      aria-invalid={!!error}
                      aria-describedby={error ? errorId : undefined}
                      onChange={(event) =>
                        formDrafts.change(entry.key, { [field.path]: event.currentTarget.value })
                      }
                      onBlur={() => void formDrafts.flush(entry.key)}
                    />
                  ) : (
                    <input
                      id={inputId}
                      value={value}
                      aria-invalid={!!error}
                      aria-describedby={error ? errorId : undefined}
                      onChange={(event) =>
                        formDrafts.change(entry.key, { [field.path]: event.currentTarget.value })
                      }
                      onBlur={() => void formDrafts.flush(entry.key)}
                    />
                  )
                ) : (
                  <select
                    id={inputId}
                    value={value}
                    onChange={(event) => {
                      const next = event.currentTarget.value;
                      formDrafts.change(
                        entry.key,
                        {
                          [field.path]: next,
                          ...(field.path === "settings.execution" && {
                            "settings.host": next === "managed" ? "unspecified" : undefined,
                          }),
                        },
                        true,
                      );
                    }}
                    onBlur={() => void formDrafts.flush(entry.key)}
                  >
                    {field.choices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                )}
                {error ? (
                  <span id={errorId} className="studio-field-error">
                    {error}
                  </span>
                ) : null}
              </div>
            );
          })}
        </fieldset>
      ))}
    </form>
  );
}

export function DraftFeedback({ projectId }: { projectId: string }) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const entries = formDrafts
    .forProject(projectId)
    .filter((entry) => entry.problem || entry.pending);
  if (!entries.length) return null;
  return (
    <div className="studio-draft-feedback">
      {entries.map((entry) => (
        <div key={entry.key} role={entry.problem?.kind === "failed" ? "alert" : "status"}>
          <span>
            {entry.spec.label}: {entry.problem?.message ?? "Saving…"}
          </span>
          {entry.problem?.kind === "failed" ? (
            <button type="button" onClick={() => formDrafts.retry(entry.key)}>
              Retry
            </button>
          ) : null}
          {entry.problem ? (
            <button type="button" onClick={() => formDrafts.discard(entry.key)}>
              {entry.problem.kind === "failed" ? "Discard" : "Dismiss"}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
