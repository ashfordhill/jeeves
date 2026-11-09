// A tile's one-page inspector (`TargetInspector`) with its preserved or preset-bound modules at
// the bottom; a module opens its existing inspector, and Back returns to the tile.
import type { BoardSelection } from "@jeeves/board";
import {
  type DesignDocument,
  type StudioComponent,
  studioComponentDefinitions,
  studioComponentVisuals,
  studioWarnings,
} from "@jeeves/spec";
import { IconArrowLeft } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { ComponentForm, TargetInspector } from "../studio/InspectorForm.tsx";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import { WarningList } from "./Warnings.tsx";

/** A tile's modules; a click opens one. */
function ModuleList({
  modules,
  onOpen,
}: {
  modules: readonly StudioComponent[];
  onOpen: (id: string) => void;
}) {
  return (
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
  const modules = (design.architecture?.studio?.components ?? []).filter(
    (item) => item.host === id,
  );
  return (
    <div className="studio-selection-summary">
      <TargetInspector
        projectId={projectId}
        element={id}
        label={name}
        design={design}
        warnings={
          <WarningList warnings={studioWarnings(design).filter((item) => item.node === id)} />
        }
        modules={modules.length ? <ModuleList modules={modules} onOpen={openModule} /> : undefined}
      />
    </div>
  );
}
