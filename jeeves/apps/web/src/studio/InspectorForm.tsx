import {
  buildStudioCommand,
  containerClassification,
  type DesignDocument,
  normalSettingFields,
  type StudioComponentDefinition,
  type StudioComponentField,
  type StudioComponentSettings,
  type StudioConnectionSettings,
  type StudioElementField,
  type StudioFieldGroup,
  type StudioPerformanceField,
  type StudioSettings,
  studioComponentDefinitions,
  studioDefinitions,
  studioFieldGroups,
  studioPerformanceFields,
  studioProviderChoices,
  validateStudio,
} from "@jeeves/spec";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import { useGenerationSupport } from "./generation-support.ts";
import {
  draftSettings,
  type InspectorTarget,
  inspectorSpec,
  originChoices,
  ownerChoices,
} from "./inspector-drafts.ts";
import { PresetAttachment } from "./PresetAttachment.tsx";
import { StudioIcon } from "./StudioIcon.tsx";

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

/**
 * The system's, a tile's and a module's description all read as Description here. The
 * definitions keep their "Purpose" label because chat's `describeStudioDefinition` returns those
 * fields verbatim, and this view must not change chat tool text.
 */
const descriptions = new Set(["element.description", "component.description"]);

/**
 * The description box: 6 rows, growing with its text to half the rail's height, then scrolling.
 * Dragging its corner sets the height by hand, and the box stops growing until it is reopened.
 */
function DescriptionBox({ value, ...props }: ComponentProps<"textarea"> & { value: string }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const fitted = useRef<string>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refit whenever the text changes
  useLayoutEffect(() => {
    const element = box.current;
    if (!element || (fitted.current !== undefined && element.style.height !== fitted.current))
      return;
    element.style.height = "";
    const rows = element.offsetHeight;
    const border = element.offsetHeight - element.clientHeight;
    const rail = element.closest(".studio-rail")?.clientHeight ?? Number.POSITIVE_INFINITY;
    element.style.height = `${Math.max(rows, Math.min(element.scrollHeight + border, rail / 2))}px`;
    fitted.current = element.style.height;
  }, [value]);
  return <textarea ref={box} rows={6} value={value} {...props} />;
}

/** One autosaving control. Text/integer edits debounce; selects commit through `onSelect`. */
function DraftField({
  idPrefix,
  field,
  draft,
  references,
  help,
  className,
  onSelect,
}: {
  idPrefix: string;
  field: InspectorField;
  draft: FormDraft;
  references: readonly Choice[];
  help?: boolean;
  className?: string;
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
  const description = descriptions.has(field.path);
  return (
    <div className={className ? `studio-form-field ${className}` : "studio-form-field"}>
      <label htmlFor={inputId}>{description ? "Description" : field.label}</label>
      {field.control === "text" ? (
        description ? (
          <DescriptionBox
            {...common}
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
 * A module's (C3 component's) form, opened from its tile's Modules list: readiness, then General
 * (with Remove module), Options and Connections (its links, Unlink, and Link to), autosaving like
 * a tile's.
 */
export function ComponentForm({
  projectId,
  id,
  design,
  onConnection,
  onComponent,
  onRemoved,
}: {
  projectId: string;
  id: string;
  design: DesignDocument;
  onConnection: (id: string) => void;
  onComponent: (id: string) => void;
  /** The module was removed. */
  onRemoved?: () => void;
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
      onRemoved={onRemoved}
    />
  );
}

function ComponentDraftForm({
  spec,
  id,
  design,
  onConnection,
  onComponent,
  onRemoved,
}: {
  spec: DraftSpec;
  id: string;
  design: DesignDocument;
  onConnection: (id: string) => void;
  onComponent: (id: string) => void;
  onRemoved?: () => void;
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
  const installed = useGenerationSupport();
  const component = studio?.components?.[index];
  if (!component) return null;
  const definition = studioComponentDefinitions[
    component.settings.kind
  ] as StudioComponentDefinition;
  const settings = draftSettings(entry.values) as Partial<StudioComponentSettings>;
  const name = (elementId: string) =>
    design.elements.find((item) => item.id === elementId)?.name ?? elementId;
  const componentName = (componentId: string) =>
    studio?.components?.find((item) => item.id === componentId)?.name ?? componentId;
  const links = (studio?.componentConnections ?? []).filter(
    (link) => link.from === id || (link.to.kind === "component" && link.to.id === id),
  );
  const controls = normalSettingFields(design, installed, { component: id });
  const editable = (field: StudioComponentField) =>
    !field.path.startsWith("settings.") ||
    controls.some((control) => `settings.${control.sourcePaths[0]?.at(-1)}` === field.path);
  const general = definition.fields.filter((field) => field.group === "General" && editable(field));
  const options = definition.fields.filter(
    (field) =>
      field.group === "Options" && componentFieldApplies(field, settings) && editable(field),
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
    const removed = await commitAction(
      spec.projectId,
      (latest) => buildStudioCommand(latest, { type: "removeComponent", components: [id] }).ops,
    );
    setRemoving(false);
    if (removed) onRemoved?.();
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
              {removing ? "Removing…" : "Remove module"}
            </button>
          </div>
        ) : null}
        {active === "Connections" ? (
          <div className="studio-dependencies">
            {links.length ? null : <p className="studio-field-help">No links yet.</p>}
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
                Timeout and retry declarations remain preserved on the traced connection. They have
                no normal editable consumer.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {findings.length ? (
        <ul className="studio-readiness" aria-label="Readiness">
          {findings.map((item) => (
            <li key={item.message} data-met={false}>
              {item.message}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

/**
 * The inspector for a tile's element, or for the system when `element` is undefined: one page
 * with the header (icon, Name, kind), Description, Options when it has fields, and the Modules
 * slot when `modules` is given. A tile's `warnings` sit in its header; the system's follow its
 * Description, before Add a supported feature.
 */
export function TargetInspector({
  projectId,
  element,
  label,
  design,
  warnings,
  modules,
}: {
  projectId: string;
  element?: string;
  /** The system's name when the design has no architecture yet. */
  label: string;
  design: DesignDocument;
  warnings?: ReactNode;
  /** The Modules section's content. */
  modules?: ReactNode;
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
  return (
    <TargetForm spec={spec} design={design} target={target} warnings={warnings} modules={modules} />
  );
}

function TargetForm({
  spec,
  design,
  target: ref,
  warnings,
  modules,
}: {
  spec: NonNullable<ReturnType<typeof inspectorSpec>>;
  design: DesignDocument;
  target: InspectorTarget;
  warnings?: ReactNode;
  modules?: ReactNode;
}) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const entry = formDrafts.open(spec, design);
  useEffect(() => () => formDrafts.leave(entry.key), [entry.key]);
  const idPrefix = useId();
  const installed = useGenerationSupport();
  const settings = draftSettings(entry.values) as StudioSettings;
  const definition = settings.kind ? studioDefinitions[settings.kind] : undefined;
  const controls =
    ref.kind === "element" ? normalSettingFields(design, installed, { element: ref.id }) : [];
  const editable = (field: InspectorField) =>
    !field.path.startsWith("settings.") ||
    controls.some((control) => `settings.${control.sourcePaths[0]?.at(-1)}` === field.path);
  const fields = (
    definition
      ? // Provider choices are narrowed per engine, so they widen to plain string choices here.
        (studioFieldGroups(settings).flatMap((item) => item.fields) as unknown as InspectorField[])
      : canonical
  ).filter((field) => field.path !== "owner" && editable(field));
  const name = fields.find((field) => field.path === "element.name");
  const description = fields.find((field) => field.path === "element.description");
  // Options: the kind's installed, useful settings (today only its Options group has any), then
  // its installed performance controls.
  const performance = definition ? studioPerformanceFields[settings.kind].filter(editable) : [];
  const options = [
    ...fields.filter((field) => field !== name && field !== description),
    ...performance,
  ];
  const connections =
    ref.kind === "element"
      ? design.connections.filter(
          (item) => item.from.element === ref.id || item.to.element === ref.id,
        )
      : [];
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
  const draftField = (field: InspectorField, className?: string) => (
    <DraftField
      key={field.path}
      idPrefix={idPrefix}
      field={field}
      draft={entry}
      className={className}
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
  );
  const kind = ref.kind === "system" ? "System" : definition?.name;
  return (
    <form
      className="studio-inspector-form"
      aria-label={`${definition?.name ?? (ref.kind === "system" ? "System" : "General")} settings`}
      onSubmit={(event) => {
        event.preventDefault();
        void formDrafts.flush(entry.key);
      }}
    >
      <header className="lane-inspector-header">
        <div className="lane-inspector-title" data-family={definition?.visual.color ?? "generic"}>
          {ref.kind === "element" ? (
            <span className="lane-inspector-icon">
              <StudioIcon name={definition?.visual.icon} size={22} />
            </span>
          ) : null}
          {name ? draftField(name, "lane-inspector-name") : null}
        </div>
        {kind ? <p className="lane-inspector-kind">{kind}</p> : null}
        {ref.kind === "element" ? warnings : null}
      </header>
      {description ? draftField(description) : null}
      {ref.kind === "system" ? (
        <>
          {warnings}
          <PresetAttachment projectId={spec.projectId} design={design} />
        </>
      ) : null}
      {options.length ? (
        <section aria-labelledby={`${idPrefix}-options`}>
          <h3 id={`${idPrefix}-options`} className="lane-inspector-section">
            Options
          </h3>
          {options.map((field) => draftField(field))}
        </section>
      ) : null}
      {modules ? (
        <section aria-labelledby={`${idPrefix}-modules`}>
          <h3 id={`${idPrefix}-modules`} className="lane-inspector-section">
            Modules
          </h3>
          {modules}
        </section>
      ) : null}
    </form>
  );
}
