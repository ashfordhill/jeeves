// Tile names and installed useful settings; bound modules open their existing inspector.
import type { BoardSelection } from "@jeeves/board";
import {
  type DesignDocument,
  moduleKinds,
  type StudioComponent,
  type StudioKind,
  studioComponentDefinitions,
  studioComponentVisuals,
  studioDefinitions,
  studioWarnings,
} from "@jeeves/spec";
import { IconArrowLeft } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { ComponentForm, type InspectorTab, TargetInspector } from "../studio/InspectorForm.tsx";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import { WarningList } from "./Warnings.tsx";

const kindOf = (design: DesignDocument, id: string): StudioKind | undefined =>
  design.architecture?.studio?.elements.find((item) => item.element === id)?.settings.kind;

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
  return (
    <div className="studio-selection-summary">
      <h2 className="lane-inspector-title" data-family={definition?.visual.color ?? "generic"}>
        <StudioIcon name={definition?.visual.icon} size={22} />
        {name}
      </h2>
      {definition ? <p className="lane-inspector-kind">{definition.name}</p> : null}
      <WarningList warnings={studioWarnings(design).filter((item) => item.node === id)} />
      <TargetInspector
        projectId={projectId}
        element={id}
        label={name}
        design={design}
        onConnection={(line) => onSelect({ line })}
        tab={tab}
        onTab={setTab}
        modules={
          application ? <ModuleList design={design} host={id} onOpen={openModule} /> : undefined
        }
      />
    </div>
  );
}
