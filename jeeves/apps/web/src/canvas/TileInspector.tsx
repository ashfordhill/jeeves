// A tile's one-page inspector (`TargetInspector`) with its modules as cards at the bottom. A card
// opens its module's page in place of the tile's (`ComponentForm`: what it generates, its
// settings, Remove module); Back returns to the tile with the Modules section in view. A tile that
// can take modules has the Modules section even with none, and a `+` under its cards that opens
// the same module menu as the board's `+`, out to the left of the rail (`ModuleAddButton`, one
// command). Which module is open is the workspace's selection (`selection.ts`), not state of this
// rail.
import {
  type DesignDocument,
  type StudioComponent,
  studioComponentDefinitions,
  studioComponentVisuals,
  studioDefinitions,
  studioWarnings,
} from "@jeeves/spec";
import { IconArrowLeft } from "@tabler/icons-react";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { ComponentForm, TargetInspector } from "../studio/InspectorForm.tsx";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import { ModuleAddButton, type ModuleAdding } from "./ModuleMenu.tsx";
import { WarningList } from "./Warnings.tsx";

/** A tile's modules as cards: icon, name, kind and a two-line description. A click opens one. */
function ModuleCards({
  modules,
  list,
  onOpen,
}: {
  modules: readonly StudioComponent[];
  list: RefObject<HTMLUListElement | null>;
  onOpen: (id: string) => void;
}) {
  return (
    <ul ref={list} className="lane-module-list" aria-label="Modules">
      {modules.map((item) => {
        const visual = studioComponentVisuals[item.settings.kind];
        return (
          <li key={item.id}>
            <button
              type="button"
              className="lane-module-card"
              data-module={item.id}
              data-family={visual.color}
              aria-label={`Open ${item.name}`}
              onClick={() => onOpen(item.id)}
            >
              <span className="lane-module-icon">
                <StudioIcon name={visual.icon} size={20} />
              </span>
              <strong>{item.name}</strong>
              <small className="lane-module-kind">
                {studioComponentDefinitions[item.settings.kind].name}
              </small>
              {item.description ? (
                <span className="lane-module-description">{item.description}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function TileInspector({
  projectId,
  design,
  id,
  name,
  module: open,
  moduleKey,
  onModule,
  adding,
}: {
  projectId: string;
  design: DesignDocument;
  id: string;
  name: string;
  /** The open module (the workspace's `selection.module`), always one of this tile's. */
  module?: string;
  /** Its page's key, kept when a rename re-keys the module (default: its ID). */
  moduleKey?: string;
  /** Opens one of this tile's modules, or (undefined) returns to the tile. */
  onModule: (module?: string) => void;
  /** The module menu and the pick for the Modules section's `+`. */
  adding?: ModuleAdding;
}) {
  const modules = (design.architecture?.studio?.components ?? []).filter(
    (item) => item.host === id,
  );
  const module = open ? modules.find((item) => item.id === open) : undefined;
  const groups = adding?.groups(id);
  const shown = module?.id;
  const list = useRef<HTMLUListElement>(null);
  const left = useRef<string>(undefined);
  useLayoutEffect(() => {
    // Back to the tile (by Back, Remove module, an Undo or a click on the tile): its Modules
    // section comes into view. When focus went with the module page, it moves to the card just
    // left, if that module is still there.
    if (shown) {
      left.current = shown;
      return;
    }
    if (!left.current) return;
    const card = list.current?.querySelector<HTMLButtonElement>(`[data-module="${left.current}"]`);
    left.current = undefined;
    list.current?.closest("section")?.scrollIntoView({ block: "nearest" });
    if (document.activeElement === document.body) card?.focus({ preventScroll: true });
  }, [shown]);
  if (module) {
    const kind = design.architecture?.studio?.elements.find((item) => item.element === id)?.settings
      .kind;
    const visual = kind ? studioDefinitions[kind].visual : undefined;
    // Each page is its own scroller, so a module opens at its top.
    return (
      <div key={moduleKey ?? module.id} className="studio-selection-summary">
        <button
          type="button"
          className="lane-inspector-back"
          aria-label={`Back to ${name}`}
          title={`Back to ${name}`}
          onClick={() => onModule(undefined)}
        >
          <IconArrowLeft size={16} aria-hidden />
          {visual ? (
            <span className="lane-inspector-back-icon" data-family={visual.color}>
              <StudioIcon name={visual.icon} size={16} />
            </span>
          ) : null}
          <span>{name}</span>
        </button>
        <ComponentForm
          projectId={projectId}
          id={module.id}
          design={design}
          onRemoved={() => onModule(undefined)}
        />
      </div>
    );
  }
  return (
    <div key="tile" className="studio-selection-summary">
      <TargetInspector
        projectId={projectId}
        element={id}
        label={name}
        design={design}
        warnings={
          <WarningList warnings={studioWarnings(design).filter((item) => item.node === id)} />
        }
        modules={
          modules.length || groups?.length ? (
            <>
              {modules.length ? (
                <ModuleCards modules={modules} list={list} onOpen={onModule} />
              ) : null}
              {adding && groups?.length ? (
                <div className="lane-module-list-add">
                  <ModuleAddButton
                    tile={id}
                    name={name}
                    groups={groups}
                    onAdd={adding.add}
                    placement="rail"
                  />
                </div>
              ) : null}
            </>
          ) : undefined
        }
      />
    </div>
  );
}
