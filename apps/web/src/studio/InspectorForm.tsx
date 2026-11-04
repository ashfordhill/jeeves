import {
  containerClassification,
  type DesignDocument,
  legacyStudioKind,
  type StudioElementField,
  type StudioFieldGroup,
  type StudioSettings,
  type StudioViewNode,
  studioDefinitions,
  studioFieldGroups,
  studioProviderChoices,
} from "@jeeves/spec";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { type DraftValues, formDrafts } from "../draw/form-drafts.ts";
import { draftSettings, inspectorSpec, originChoices, ownerChoices } from "./inspector-drafts.ts";

const canonical = studioDefinitions.service.fields.filter((field) => field.control === "text");

/** Select conditions are applied as one draft change, even while another field is invalid. */
function selectChange(
  fields: readonly StudioElementField[],
  values: DraftValues,
  path: string,
  value: string,
) {
  const changes: DraftValues = { [path]: value };
  if (path === "settings.engine") {
    const settings = { ...draftSettings(values), engine: value } as StudioSettings;
    if (
      !studioProviderChoices(settings).some(
        (choice) => choice.value === values["settings.provider"],
      )
    )
      changes["settings.provider"] = "unspecified";
  }
  for (const field of fields) {
    if (!("when" in field) || field.when?.path !== path) continue;
    if (value !== field.when.equals) changes[field.path] = undefined;
    else if (values[path] !== value)
      changes[field.path] = field.control === "select" ? "unspecified" : undefined;
  }
  return changes;
}

export function InspectorForm({
  projectId,
  node,
  design,
  onElement,
  onConnection,
}: {
  projectId: string;
  node: StudioViewNode;
  design: DesignDocument;
  onElement: (id: string) => void;
  onConnection: (id: string) => void;
}) {
  const ref = node.refs[0];
  const spec = useMemo(
    () => ref && inspectorSpec(projectId, ref, node.name, design),
    [projectId, ref, node.name, design],
  );
  if (!spec) return node.description ? <p>{node.description}</p> : null;
  return (
    <TargetForm
      spec={spec}
      design={design}
      node={node}
      onElement={onElement}
      onConnection={onConnection}
    />
  );
}

function TargetForm({
  spec,
  design,
  node,
  onElement,
  onConnection,
}: {
  spec: NonNullable<ReturnType<typeof inspectorSpec>>;
  design: DesignDocument;
  node: StudioViewNode;
  onElement: (id: string) => void;
  onConnection: (id: string) => void;
}) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const entry = formDrafts.open(spec, design);
  useEffect(() => () => formDrafts.leave(entry.key), [entry.key]);
  const tabId = useId();
  const [selectedTab, setSelectedTab] = useState<StudioFieldGroup>("General");
  const settings = draftSettings(entry.values) as StudioSettings;
  const definition = settings.kind ? studioDefinitions[settings.kind] : undefined;
  const groups: ReturnType<typeof studioFieldGroups> = definition
    ? studioFieldGroups(settings)
    : [{ group: "General", fields: canonical }];
  const ref = node.refs[0];
  const memberIds =
    ref?.kind === "package"
      ? (design.architecture?.studio?.packages.find((item) => item.id === ref.id)?.members ?? [])
      : [];
  const ids = ref?.kind === "element" ? [ref.id] : memberIds;
  const connections = design.connections.filter(
    (item) => ids.includes(item.from.element) || ids.includes(item.to.element),
  );
  if (connections.length && !groups.some((group) => group.group === "Connections"))
    groups.push({ group: "Connections", fields: [] });
  const active = groups.some((group) => group.group === selectedTab) ? selectedTab : "General";
  const current = groups.find((group) => group.group === active) ?? { fields: canonical };
  const applications = design.elements.filter(
    (item) =>
      containerClassification(item).kind === "Application" &&
      !(ref?.kind === "element" && ref.id === item.id),
  );
  const optionsFor = (field: ReturnType<typeof studioFieldGroups>[number]["fields"][number]) => {
    if (field.control !== "reference") return [];
    if (field.reference.target === "owner") return ownerChoices(design);
    if (field.reference.target === "origin") return originChoices(design);
    if (field.reference.target === "application")
      return applications.map((item) => ({ value: item.id, label: item.name }));
    if (field.reference.target !== "connection" || ref?.kind !== "element") return [];
    const kind = field.reference.resource;
    return connections
      .filter(
        (item) =>
          item.from.element === ref.id &&
          !item.from.attachment &&
          !item.to.attachment &&
          !item.config?.fromCapability &&
          !item.config?.toCapability &&
          (design.architecture?.studio?.elements.find(
            (binding) => binding.element === item.to.element,
          )?.settings.kind ??
            design.elements
              .filter((element) => element.id === item.to.element)
              .map(legacyStudioKind)[0]) === kind,
      )
      .map((item) => ({
        value: item.id,
        label: `${design.elements.find((element) => element.id === item.to.element)?.name} · ${item.planned?.label ?? item.label ?? "Uses"}${item.planned?.protocol || item.protocol ? ` (${item.planned?.protocol ?? item.protocol})` : ""}`,
      }));
  };
  return (
    <form
      className="studio-inspector-form"
      aria-label={`${definition?.name ?? (ref?.kind === "package" ? "Package" : "General")} settings`}
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
              id={`${tabId}-${group}-tab`}
              aria-selected={active === group}
              aria-controls={`${tabId}-${group}`}
              onClick={() => {
                void formDrafts.flush(entry.key);
                setSelectedTab(group);
              }}
            >
              {group}
            </button>
          ))}
        </div>
      ) : null}
      <div
        role="tabpanel"
        id={`${tabId}-${active}`}
        aria-label={groups.length === 1 ? active : undefined}
        aria-labelledby={groups.length > 1 ? `${tabId}-${active}-tab` : undefined}
      >
        {current.fields.map((field) => {
          const value = entry.values[field.path];
          const error = entry.errors[field.path];
          const inputId = `${tabId}-${field.path}`;
          const errorId = `${inputId}-error`;
          const common = {
            id: inputId,
            "aria-invalid": !!error,
            "aria-describedby": error ? errorId : undefined,
            onBlur: () => void formDrafts.flush(entry.key),
          };
          const change = (value: unknown) => formDrafts.change(entry.key, { [field.path]: value });
          const references = optionsFor(field);
          return (
            <div className="studio-form-field" key={field.path}>
              <label htmlFor={inputId}>{field.label}</label>
              {field.control === "text" ? (
                field.path === "element.description" ? (
                  <textarea
                    {...common}
                    rows={3}
                    value={String(value ?? "")}
                    onChange={(event) => change(event.currentTarget.value)}
                  />
                ) : (
                  <input
                    {...common}
                    value={String(value ?? "")}
                    onChange={(event) => change(event.currentTarget.value)}
                  />
                )
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
                    change(
                      event.currentTarget.validity.badInput
                        ? ""
                        : event.currentTarget.value === ""
                          ? undefined
                          : Number(event.currentTarget.value),
                    )
                  }
                />
              ) : (
                <select
                  {...common}
                  value={String(value ?? "")}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    formDrafts.change(
                      entry.key,
                      field.control === "select"
                        ? selectChange(definition?.fields ?? [], entry.values, field.path, value)
                        : { [field.path]: value || undefined },
                      true,
                    );
                  }}
                >
                  {field.control === "reference" ? (
                    <>
                      <option value="">Unspecified</option>
                      {value && !references.some((item) => item.value === value) ? (
                        <option value={String(value)} disabled>
                          Existing selection
                        </option>
                      ) : null}
                      {references.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </>
                  ) : (
                    field.choices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))
                  )}
                </select>
              )}
              {error ? (
                <span id={errorId} className="studio-field-error">
                  {error}
                </span>
              ) : null}
              {"unit" in field && field.unit ? <small>{field.unit}</small> : null}
            </div>
          );
        })}
        {active === "General" && memberIds.length ? (
          <div className="studio-member-list">
            <h3>Members</h3>
            {memberIds.map((id) => (
              <button type="button" key={id} onClick={() => onElement(id)}>
                {design.elements.find((item) => item.id === id)?.name}
              </button>
            ))}
          </div>
        ) : null}
        {active === "Connections" && connections.length ? (
          <div className="studio-dependencies">
            {connections.map((item) => {
              const from = design.elements.find(
                (element) => element.id === item.from.element,
              )?.name;
              const to = design.elements.find((element) => element.id === item.to.element)?.name;
              const protocol = item.planned?.protocol ?? item.protocol;
              return (
                <button type="button" key={item.id} onClick={() => onConnection(item.id)}>
                  {from} → {to}
                  <span>
                    {item.planned?.label ?? item.label ?? "Uses"}
                    {protocol && protocol !== "Unspecified" ? ` · ${protocol}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </form>
  );
}
