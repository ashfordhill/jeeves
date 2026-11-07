// A tile's inspector: its icon, name and kind; the Type list (each kind of its tile type with its
// icon and name, the current one highlighted; a click is `changeKind`, a kind the rules refuse is
// disabled with the reason as its tooltip); then
// General, Options, Connections and, for an application, Modules. Modules are a list with a `+`
// icon menu (`createComponent`); a module opens its own form, with a way back to the tile. Each
// change is one batch and one undo step. Modules are never drawn on the canvas.
import type { BoardSelection } from "@jeeves/board";
import {
  applyOperations,
  buildStudioCommand,
  createStudioComponentSettings,
  type DesignDocument,
  designOwnership,
  moduleKinds,
  newModuleIdentity,
  type StudioComponent,
  type StudioComponentKind,
  type StudioKind,
  studioComponentDefinitions,
  studioComponentVisuals,
  studioDefinitions,
  studioLinkRole,
  studioStoreAccess,
  studioTileDefinitions,
  studioWarnings,
  tileTypeOf,
} from "@jeeves/spec";
import { Menu } from "@mantine/core";
import { IconArrowLeft, IconPlus } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { commitAction } from "../studio/actions.ts";
import { ComponentForm, type InspectorTab, TargetInspector } from "../studio/InspectorForm.tsx";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import { WarningList } from "./Warnings.tsx";

const kindOf = (design: DesignDocument, id: string): StudioKind | undefined =>
  design.architecture?.studio?.elements.find((item) => item.element === id)?.settings.kind;

/**
 * A store's writer and readers: its owner writes, every other tile linking to it reads (one
 * writer per store, derived from the owner). Changing the Owner field changes who writes.
 */
function StoreAccess({ design, store }: { design: DesignDocument; store: string }) {
  const studio = design.architecture?.studio;
  const owner = studio?.elements.find((item) => item.element === store)?.owner;
  const name = (id: string) => design.elements.find((item) => item.id === id)?.name ?? id;
  const ownerName = !owner
    ? "no owner yet"
    : owner.kind === "element"
      ? name(owner.id)
      : (studio?.packages.find((item) => item.id === owner.id)?.name ?? owner.id);
  const readers = design.connections
    .filter((item) => item.to.element === store && studioStoreAccess(design, item.id) === "read")
    .map((item) => name(item.from.element));
  return (
    <>
      <dl className="lane-store-access" aria-label="Access inferred from ownership">
        <dt>{design.schemaVersion === 3 ? "Legacy inferred writer" : "Owner"}</dt>
        <dd>{ownerName}</dd>
        <dt>{design.schemaVersion === 3 ? "Legacy inferred readers" : "Other readers"}</dt>
        <dd>{readers.length ? [...new Set(readers)].join(", ") : "nobody else"}</dd>
      </dl>
      <p className="studio-field-help">
        {design.schemaVersion === 3 ? "Legacy access inference" : "Access is inferred"}: owner links
        (including owning package members) count as writes; other links count as reads. Owner reads
        are not distinguished.
      </p>
    </>
  );
}

/** Why switching this tile to `kind` is refused (the command's words, or apply's), if it is. */
function changeKindRefusal(
  design: DesignDocument,
  element: string,
  kind: StudioKind,
): string | undefined {
  try {
    const ops = buildStudioCommand(design, { type: "changeKind", element, kind }).ops;
    const result = applyOperations(design, ops, { baseRevision: design.revision });
    return result.ok ? undefined : (result.errors[0]?.message ?? "This change is not allowed.");
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** The Type list: each kind of the tile's type by icon and name. Hidden for a one-kind type. */
function TypeList({
  projectId,
  design,
  element,
}: {
  projectId: string;
  design: DesignDocument;
  element: string;
}) {
  const choices = useMemo(() => {
    const current = kindOf(design, element);
    const type = current && tileTypeOf(current);
    if (!current || !type) return [];
    return studioTileDefinitions[type].kinds.map((kind) => ({
      kind,
      current: kind === current,
      refusal: kind === current ? undefined : changeKindRefusal(design, element, kind),
    }));
  }, [design, element]);
  if (choices.length < 2) return null;
  return (
    <fieldset className="lane-kinds" aria-label="Type">
      <legend>Type</legend>
      {choices.map(({ kind, current, refusal }) => {
        const definition = studioDefinitions[kind];
        return (
          <button
            key={kind}
            type="button"
            className="lane-kind"
            data-family={definition.visual.color}
            aria-pressed={current}
            title={refusal ?? definition.description}
            disabled={!!refusal}
            onClick={() => {
              if (current) return;
              void commitAction(
                projectId,
                (latest) => buildStudioCommand(latest, { type: "changeKind", element, kind }).ops,
              );
            }}
          >
            <span className="lane-kind-icon">
              <StudioIcon name={definition.visual.icon} size={18} />
            </span>
            <span className="lane-kind-name">{definition.name}</span>
          </button>
        );
      })}
    </fieldset>
  );
}

/** The host's modules (icon and name; a click opens one) and the `+` icon menu of kinds. */
function ModuleList({
  projectId,
  design,
  host,
  onOpen,
}: {
  projectId: string;
  design: DesignDocument;
  host: string;
  onOpen: (id: string, created?: boolean) => void;
}) {
  const modules = (design.architecture?.studio?.components ?? []).filter(
    (item) => item.host === host,
  );
  const add = (kind: StudioComponentKind) => {
    const created = newModuleIdentity(design, host, kind);
    void commitAction(
      projectId,
      (latest) =>
        buildStudioCommand(latest, {
          type: "createComponent",
          component: { ...created, host, settings: createStudioComponentSettings(kind) },
        }).ops,
    ).then((ok) => {
      if (ok) onOpen(created.id, true);
    });
  };
  return (
    <div className="lane-modules">
      {modules.length ? (
        <ul className="lane-module-list" aria-label="Modules">
          {modules.map((item) => {
            const visual = studioComponentVisuals[item.settings.kind];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-family={visual.color}
                  title={studioComponentDefinitions[item.settings.kind].name}
                  onClick={() => onOpen(item.id)}
                >
                  <StudioIcon name={visual.icon} size={18} />
                  <span>{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="studio-field-help">No modules yet.</p>
      )}
      <Menu position="bottom-start" shadow="md">
        <Menu.Target>
          <button
            type="button"
            className="lane-module-add"
            aria-label="Add module"
            title="Add module"
          >
            <IconPlus size={18} aria-hidden />
          </button>
        </Menu.Target>
        <Menu.Dropdown className="lane-module-menu">
          {moduleKinds(design, host).map((kind) => {
            const name = studioComponentDefinitions[kind].name;
            const visual = studioComponentVisuals[kind];
            return (
              <Menu.Item
                key={kind}
                className="lane-module-kind"
                aria-label={name}
                title={name}
                onClick={() => add(kind)}
              >
                <span className="lane-module-icon" data-family={visual.color}>
                  <StudioIcon name={visual.icon} size={22} />
                </span>
              </Menu.Item>
            );
          })}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}

/** An open module: back to its tile, its icon, name and kind, then its form. */
function ModuleInspector({
  projectId,
  design,
  module,
  onBack,
  onOpen,
  onSelect,
}: {
  projectId: string;
  design: DesignDocument;
  module: StudioComponent;
  onBack: () => void;
  onOpen: (id: string) => void;
  onSelect: (next: BoardSelection) => void;
}) {
  const host = design.elements.find((item) => item.id === module.host)?.name ?? module.host;
  const visual = studioComponentVisuals[module.settings.kind];
  return (
    <div className="studio-selection-summary">
      <button
        type="button"
        className="lane-inspector-back"
        aria-label={`Back to ${host}`}
        title={`Back to ${host}`}
        onClick={onBack}
      >
        <IconArrowLeft size={16} aria-hidden />
        {host}
      </button>
      <h2 className="lane-inspector-title" data-family={visual.color}>
        <StudioIcon name={visual.icon} size={22} />
        {module.name}
      </h2>
      <p className="lane-inspector-kind">{studioComponentDefinitions[module.settings.kind].name}</p>
      <ComponentForm
        projectId={projectId}
        id={module.id}
        design={design}
        onConnection={(line) => onSelect({ line })}
        onComponent={onOpen}
        onRemoved={onBack}
      />
    </div>
  );
}

export function TileInspector({
  projectId,
  design,
  id,
  name,
  onSelect,
}: {
  projectId: string;
  design: DesignDocument;
  id: string;
  name: string;
  onSelect: (next: BoardSelection) => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("General");
  const [open, setOpen] = useState<string>();
  const [focusName, setFocusName] = useState<string>();
  const module = open
    ? design.architecture?.studio?.components?.find((item) => item.id === open && item.host === id)
    : undefined;
  useEffect(() => {
    // A new module opens with its Name field focused, ready to rename.
    if (!focusName || focusName !== module?.id) return;
    const field = document.querySelector<HTMLInputElement>(
      '.studio-inspector input[id$="-component.name"]',
    );
    if (!field) return;
    field.focus();
    field.select();
    setFocusName(undefined);
  });
  const openModule = (next: string, created?: boolean) => {
    setOpen(next);
    if (created) setFocusName(next);
  };
  if (module)
    return (
      <ModuleInspector
        projectId={projectId}
        design={design}
        module={module}
        onBack={() => setOpen(undefined)}
        onOpen={openModule}
        onSelect={onSelect}
      />
    );
  const kind = kindOf(design, id);
  const definition = kind ? studioDefinitions[kind] : undefined;
  const application = moduleKinds(design, id).length > 0;
  const ownership = designOwnership(design);
  const role = ownership.roles.find((item) => item.element === id);
  const declaredStore =
    ownership.resources.some((item) => item.element === id) ||
    ownership.grants.some((item) => item.resource === id) ||
    design.connections.some(
      (link) =>
        link.to.element === id &&
        ownership.dependencies.some((item) => item.connection === link.id),
    );
  const storeAccess =
    kind && studioLinkRole(kind) === "store" ? (
      <StoreAccess design={design} store={id} />
    ) : undefined;
  return (
    <div className="studio-selection-summary">
      <h2 className="lane-inspector-title" data-family={definition?.visual.color ?? "generic"}>
        <StudioIcon name={definition?.visual.icon} size={22} />
        {name}
      </h2>
      {definition ? (
        <p className="lane-inspector-kind">
          {role ? `${role.kind === "api" ? "API" : "Worker"} role` : definition.name}
        </p>
      ) : null}
      {definition && role ? (
        <p className="studio-field-help">
          Tile kind: {definition.name} · deployable intent: {role.deployable ?? "unspecified"}. A
          role is a responsibility within its logical owner; roles may share a process.
        </p>
      ) : null}
      <WarningList warnings={studioWarnings(design).filter((item) => item.node === id)} />
      <TypeList projectId={projectId} design={design} element={id} />
      {!declaredStore ? storeAccess : null}
      <TargetInspector
        projectId={projectId}
        element={id}
        label={name}
        design={design}
        onConnection={(line) => onSelect({ line })}
        tab={tab}
        onTab={setTab}
        legacyAccess={declaredStore ? storeAccess : undefined}
        modules={
          application ? (
            <ModuleList projectId={projectId} design={design} host={id} onOpen={openModule} />
          ) : undefined
        }
      />
    </div>
  );
}
