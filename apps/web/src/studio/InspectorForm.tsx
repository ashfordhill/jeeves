import {
  buildStudioCommand,
  containerClassification,
  type DesignDocument,
  type StudioComponentDefinition,
  type StudioComponentField,
  type StudioComponentSettings,
  type StudioConnectionSettings,
  type StudioElementField,
  type StudioFieldGroup,
  type StudioPerformanceField,
  type StudioSettings,
  studioComponentDefinitions,
  studioComponentRequirements,
  studioDefinitions,
  studioFieldGroups,
  studioPerformanceFields,
  studioProviderChoices,
  validateStudio,
} from "@jeeves/spec";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  type DraftSpec,
  type DraftValues,
  type FormDraft,
  formDrafts,
} from "../project/form-drafts.ts";
import { commitAction } from "./actions.ts";
import {
  componentFieldApplies,
  componentSelectChange,
  componentSpec,
  deadLetterChoices,
} from "./component-drafts.ts";
import {
  draftSettings,
  type InspectorTarget,
  inspectorSpec,
  originChoices,
  ownerChoices,
} from "./inspector-drafts.ts";

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

type InspectorField = StudioElementField | StudioPerformanceField | StudioComponentField;
type Choice = { value: string; label: string };

/** One autosaving control. Text/integer edits debounce; selects commit through `onSelect`. */
function DraftField({
  idPrefix,
  field,
  draft,
  references,
  help,
  onSelect,
}: {
  idPrefix: string;
  field: InspectorField;
  draft: FormDraft;
  references: readonly Choice[];
  help?: boolean;
  onSelect: (value: string) => void;
}) {
  const value = draft.values[field.path];
  const error = draft.errors[field.path];
  const inputId = `${idPrefix}-${field.path}`;
  const errorId = `${inputId}-error`;
  const common = {
    id: inputId,
    "aria-invalid": !!error,
    "aria-describedby": error ? errorId : undefined,
    onBlur: () => void formDrafts.flush(draft.key),
  };
  // An optional setting left empty is unspecified (absent), never an empty string or zero.
  const optional = "optional" in field && !!field.optional;
  const empty = field.path.startsWith("settings.") && optional;
  const change = (next: unknown) =>
    formDrafts.change(draft.key, { [field.path]: empty && next === "" ? undefined : next });
  return (
    <div className="studio-form-field">
      <label htmlFor={inputId}>{field.label}</label>
      {field.control === "text" ? (
        field.path === "element.description" || field.path === "component.description" ? (
          <textarea
            {...common}
            rows={3}
            value={String(value ?? "")}
            onChange={(event) => change(event.currentTarget.value)}
          />
        ) : (
          <input
            {...common}
            placeholder={empty ? "Unspecified" : undefined}
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
          onChange={(event) => onSelect(event.currentTarget.value)}
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
            <>
              {optional ? <option value="">Unspecified</option> : null}
              {field.choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </>
          )}
        </select>
      )}
      {error ? (
        <span id={errorId} className="studio-field-error">
          {error}
        </span>
      ) : null}
      {"unit" in field && field.unit ? <small>{field.unit}</small> : null}
      {help && field.help ? <small className="studio-field-help">{field.help}</small> : null}
    </div>
  );
}

const retryText = (settings?: StudioConnectionSettings) => {
  const retry = settings?.retry;
  return [
    settings?.timeoutMs ? `timeout ${settings.timeoutMs} ms` : "timeout unspecified",
    !retry || retry.mode === "unspecified"
      ? "retry unspecified"
      : retry.mode === "none"
        ? "no retry"
        : `${retry.attempts} ${retry.attempts === 1 ? "retry" : "retries"}, ${retry.delayMs} ms apart`,
  ].join(" · ");
};

/**
 * A module's (C3 component's) form: General, Options and Connections, autosaving like a tile's.
 * Nothing mounts it yet; a service tile's module list will open it.
 */
export function ComponentForm({
  projectId,
  id,
  design,
  onConnection,
  onComponent,
}: {
  projectId: string;
  id: string;
  design: DesignDocument;
  onConnection: (id: string) => void;
  onComponent: (id: string) => void;
}) {
  const spec = useMemo(() => componentSpec(projectId, id, design), [projectId, id, design]);
  if (!spec) return null;
  return (
    <ComponentDraftForm
      spec={spec}
      id={id}
      design={design}
      onConnection={onConnection}
      onComponent={onComponent}
    />
  );
}

function ComponentDraftForm({
  spec,
  id,
  design,
  onConnection,
  onComponent,
}: {
  spec: DraftSpec;
  id: string;
  design: DesignDocument;
  onConnection: (id: string) => void;
  onComponent: (id: string) => void;
}) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const entry = formDrafts.open(spec, design);
  useEffect(() => () => formDrafts.leave(entry.key), [entry.key]);
  const tabId = useId();
  const [selectedTab, setSelectedTab] = useState<StudioFieldGroup>("General");
  const [removing, setRemoving] = useState(false);
  const studio = design.architecture?.studio;
  const index = studio?.components?.findIndex((item) => item.id === id) ?? -1;
  const findings = useMemo(
    () =>
      validateStudio(design).filter(
        (item) =>
          item.target.path?.[2] === "components" &&
          item.target.path[3] === index &&
          (item.code === "CONFIG_REQUIRED" || item.code === "CONFIG_INVALID"),
      ),
    [design, index],
  );
  const component = studio?.components?.[index];
  if (!component) return null;
  const definition = studioComponentDefinitions[
    component.settings.kind
  ] as StudioComponentDefinition;
  const settings = draftSettings(entry.values) as Partial<StudioComponentSettings>;
  const host = design.elements.find((item) => item.id === component.host);
  const name = (elementId: string) =>
    design.elements.find((item) => item.id === elementId)?.name ?? elementId;
  const componentName = (componentId: string) =>
    studio?.components?.find((item) => item.id === componentId)?.name ?? componentId;
  const links = (studio?.componentConnections ?? []).filter(
    (link) => link.from === id || (link.to.kind === "component" && link.to.id === id),
  );
  const requirements = studioComponentRequirements(component.settings);
  const unmet = new Set(findings.map((item) => item.message));
  const otherGaps = findings.filter(
    (item) => !requirements.some((requirement) => requirement.reason === item.message),
  );
  const general = definition.fields.filter((field) => field.group === "General");
  const options = definition.fields.filter(
    (field) => field.group === "Options" && componentFieldApplies(field, settings),
  );
  const groups: { group: StudioFieldGroup; fields: readonly StudioComponentField[] }[] = [
    { group: "General", fields: general },
    ...(options.length ? [{ group: "Options" as const, fields: options }] : []),
    ...(links.length || definition.targets.length
      ? [{ group: "Connections" as const, fields: [] }]
      : []),
  ];
  const active = groups.some((group) => group.group === selectedTab) ? selectedTab : "General";
  const current = groups.find((group) => group.group === active) ?? groups[0];
  const remove = async () => {
    setRemoving(true);
    await formDrafts.flushProject(spec.projectId, true);
    await commitAction(
      spec.projectId,
      (latest) => buildStudioCommand(latest, { type: "removeComponent", components: [id] }).ops,
    );
    setRemoving(false);
  };
  return (
    <form
      className="studio-inspector-form"
      aria-label={`${definition.name} settings`}
      onSubmit={(event) => {
        event.preventDefault();
        void formDrafts.flush(entry.key);
      }}
    >
      <dl className="studio-component-meta">
        <dt>Component</dt>
        <dd>{definition.name}</dd>
        {host ? (
          <>
            <dt>Inside</dt>
            <dd>{host.name}</dd>
          </>
        ) : null}
        <dt>Typical</dt>
        <dd>
          {definition.thirdParty.length ? definition.thirdParty.join(", ") : "Generated stub"}
        </dd>
      </dl>
      {requirements.length || otherGaps.length ? (
        <ul className="studio-readiness" aria-label="Readiness">
          {requirements.map((requirement) => (
            <li key={requirement.reason} data-met={!unmet.has(requirement.reason)}>
              {unmet.has(requirement.reason)
                ? requirement.reason
                : `Needs ${requirement.kinds.length > 2 ? "a target" : requirement.kinds.join(" or ")}: connected`}
            </li>
          ))}
          {otherGaps.map((item) => (
            <li key={item.message} data-met={false}>
              {item.message}
            </li>
          ))}
        </ul>
      ) : null}
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
        {current?.fields.map((field) => (
          <DraftField
            key={field.path}
            idPrefix={tabId}
            field={field}
            draft={entry}
            help
            references={field.control === "reference" ? deadLetterChoices(design, component) : []}
            onSelect={(value) =>
              formDrafts.change(
                entry.key,
                field.control === "select"
                  ? componentSelectChange(definition, entry.values, field.path, value)
                  : { [field.path]: value || undefined },
                true,
              )
            }
          />
        ))}
        {active === "General" ? (
          <div className="studio-membership">
            <button
              type="button"
              className="studio-danger"
              disabled={removing}
              onClick={() => void remove()}
            >
              {removing ? "Removing…" : "Remove component"}
            </button>
          </div>
        ) : null}
        {active === "Connections" ? (
          <div className="studio-dependencies">
            {links.length ? null : (
              <p className="studio-field-help">
                No links yet. Drag this component's + handle to a box, or out to add one.
              </p>
            )}
            {links.map((link) => {
              const outgoing = link.from === id;
              const via =
                link.to.kind === "element"
                  ? design.connections.find((item) => item.id === (link.to as { via: string }).via)
                  : undefined;
              const binding = via && studio?.connections.find((item) => item.connection === via.id);
              const other =
                link.to.kind === "element"
                  ? name(link.to.id)
                  : componentName(outgoing ? link.to.id : link.from);
              const protocol = via ? via.planned.protocol : "In process";
              return (
                <div className="studio-dependency-row" key={link.id}>
                  <button
                    type="button"
                    onClick={() =>
                      via
                        ? onConnection(via.id)
                        : onComponent(
                            outgoing && link.to.kind === "component" ? link.to.id : link.from,
                          )
                    }
                  >
                    {outgoing ? `→ ${other}` : `← ${other}`}
                    <span>
                      {link.label ?? via?.planned.label ?? "Uses"}
                      {protocol && protocol !== "Unspecified" ? ` · ${protocol}` : ""}
                      {component.settings.kind === "external-call" && via
                        ? ` · ${retryText(binding?.settings)}`
                        : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Unlink ${other}`}
                    onClick={() =>
                      void commitAction(
                        spec.projectId,
                        (latest) =>
                          buildStudioCommand(latest, {
                            type: "disconnectComponent",
                            links: [link.id],
                          }).ops,
                      )
                    }
                  >
                    Unlink
                  </button>
                </div>
              );
            })}
            {component.settings.kind === "external-call" ? (
              <p className="studio-field-help">
                Timeout and retries belong to the traced connection; open it to edit them.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}

/**
 * The inspector for a tile's element, or for the system when `element` is undefined: General,
 * Options and Connections.
 */
export function TargetInspector({
  projectId,
  element,
  label,
  design,
  onConnection,
}: {
  projectId: string;
  element?: string;
  /** The system's name when the design has no architecture yet. */
  label: string;
  design: DesignDocument;
  onConnection: (id: string) => void;
}) {
  const target = useMemo<InspectorTarget>(
    () => (element ? { kind: "element", id: element } : { kind: "system" }),
    [element],
  );
  const spec = useMemo(
    () => inspectorSpec(projectId, target, label, design),
    [projectId, target, label, design],
  );
  if (!spec) return null;
  return <TargetForm spec={spec} design={design} target={target} onConnection={onConnection} />;
}

/** The system's description reads as its goal. */
const systemFields = canonical.map((field) =>
  field.path === "element.description" ? { ...field, label: "Goal" } : field,
);

function TargetForm({
  spec,
  design,
  target: ref,
  onConnection,
}: {
  spec: NonNullable<ReturnType<typeof inspectorSpec>>;
  design: DesignDocument;
  target: InspectorTarget;
  onConnection: (id: string) => void;
}) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const entry = formDrafts.open(spec, design);
  useEffect(() => () => formDrafts.leave(entry.key), [entry.key]);
  const tabId = useId();
  const [selectedTab, setSelectedTab] = useState<StudioFieldGroup>("General");
  const settings = draftSettings(entry.values) as StudioSettings;
  const definition = settings.kind ? studioDefinitions[settings.kind] : undefined;
  const groups: { group: StudioFieldGroup; fields: InspectorField[] }[] = definition
    ? studioFieldGroups(settings).map((item) => ({
        group: item.group,
        // Provider choices are narrowed per engine, so they widen to plain string choices here.
        fields: [...item.fields] as unknown as InspectorField[],
      }))
    : [{ group: "General", fields: ref.kind === "system" ? systemFields : canonical }];
  // Service and resource performance intent joins Options (after the definition fields).
  const performance = definition ? studioPerformanceFields[settings.kind] : [];
  if (performance.length) {
    const options = groups.find((group) => group.group === "Options");
    if (options) options.fields = [...options.fields, ...performance];
    else groups.splice(1, 0, { group: "Options", fields: [...performance] });
  }
  const connections =
    ref.kind === "element"
      ? design.connections.filter(
          (item) => item.from.element === ref.id || item.to.element === ref.id,
        )
      : [];
  if (connections.length && !groups.some((group) => group.group === "Connections"))
    groups.push({ group: "Connections", fields: [] });
  const active = groups.some((group) => group.group === selectedTab) ? selectedTab : "General";
  const current = groups.find((group) => group.group === active) ?? { fields: canonical };
  const applications = design.elements.filter(
    (item) =>
      containerClassification(item).kind === "Application" &&
      !(ref.kind === "element" && ref.id === item.id),
  );
  const optionsFor = (field: InspectorField) => {
    if (field.control !== "reference") return [];
    if (field.reference.target === "owner") return ownerChoices(design);
    if (field.reference.target === "origin") return originChoices(design);
    if (field.reference.target === "application")
      return applications.map((item) => ({ value: item.id, label: item.name }));
    if (field.reference.target !== "connection" || ref.kind !== "element") return [];
    const kind = field.reference.resource;
    return connections
      .filter(
        (item) =>
          item.from.element === ref.id &&
          design.architecture?.studio?.elements.find(
            (binding) => binding.element === item.to.element,
          )?.settings.kind === kind,
      )
      .map((item) => ({
        value: item.id,
        label: `${design.elements.find((element) => element.id === item.to.element)?.name} · ${item.planned.label} (${item.planned.protocol})`,
      }));
  };
  return (
    <form
      className="studio-inspector-form"
      aria-label={`${definition?.name ?? (ref.kind === "system" ? "System" : "General")} settings`}
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
        {current.fields.map((field) => (
          <DraftField
            key={field.path}
            idPrefix={tabId}
            field={field}
            draft={entry}
            references={optionsFor(field)}
            help={performance.includes(field as StudioPerformanceField)}
            onSelect={(value) =>
              formDrafts.change(
                entry.key,
                field.control === "select" && !("optional" in field && field.optional)
                  ? selectChange(definition?.fields ?? [], entry.values, field.path, value)
                  : { [field.path]: value || undefined },
                true,
              )
            }
          />
        ))}
        {active === "Connections" && connections.length ? (
          <div className="studio-dependencies">
            {connections.map((item) => {
              const from = design.elements.find(
                (element) => element.id === item.from.element,
              )?.name;
              const to = design.elements.find((element) => element.id === item.to.element)?.name;
              const protocol = item.planned.protocol;
              return (
                <div className="studio-dependency-row" key={item.id}>
                  <button type="button" onClick={() => onConnection(item.id)}>
                    {from} → {to}
                    <span>
                      {item.planned.label}
                      {protocol && protocol !== "Unspecified" ? ` · ${protocol}` : ""}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </form>
  );
}
