// Tile names and installed useful settings; bound modules open their existing inspector.
import type { BoardSelection } from "@jeeves/board";
import {
  type DesignDocument,
  designOwnership,
  moduleKinds,
  type StudioComponent,
  type StudioKind,
  studioComponentDefinitions,
  studioComponentVisuals,
  studioDefinitions,
  studioLinkRole,
  studioStoreAccess,
  studioWarnings,
} from "@jeeves/spec";
import { IconArrowLeft } from "@tabler/icons-react";
import { useEffect, useState } from "react";
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

/** Preserved or preset-bound modules; a click opens one. */
function ModuleList({
  design,
  host,
  onOpen,
}: {
  design: DesignDocument;
  host: string;
  onOpen: (id: string, created?: boolean) => void;
}) {
  const modules = (design.architecture?.studio?.components ?? []).filter(
    (item) => item.host === host,
  );
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
          application ? <ModuleList design={design} host={id} onOpen={openModule} /> : undefined
        }
      />
    </div>
  );
}
