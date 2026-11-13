// A tile's one-page inspector (`TargetInspector`) with its lines as Connections rows, then its
// modules as cards at the bottom. A row selects the tile at the line's other end, with a Back to
// this one (the workspace's trail). A card opens its module's page in place of the tile's
// (`ComponentForm`: what it generates, its settings, Remove module); Back returns to the tile with
// the Modules section in view. A tile that can take modules has the Modules section even with none,
// and a `+` under its cards that opens the same module menu as the board's `+`, out to the left of
// the rail (`ModuleAddButton`, one command). Which module is open is the workspace's selection
// (`selection.ts`), not state of this rail.
import {
  type DesignDocument,
  designBlueprintV3,
  LANE_ACTOR,
  type LaneGraph,
  type StudioComponent,
  type StudioKind,
  studioComponentDefinitions,
  studioComponentVisuals,
  studioDefinitions,
  studioWarnings,
} from "@jeeves/spec";
import { IconArrowLeft } from "@tabler/icons-react";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { ComponentForm, TargetInspector } from "../studio/InspectorForm.tsx";
import { moduleGroupOf } from "../studio/module-groups.ts";
import { generationWords, moduleGeneration } from "../studio/module-status.ts";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import { LaneIcon } from "./LaneIcon.tsx";
import { GenerationDot, ModuleAddButton, type ModuleAdding } from "./ModuleMenu.tsx";
import { HumanFigure } from "./tiles/HumanFigure.tsx";
import { WarningList } from "./Warnings.tsx";

/** A blueprint connection's store access or channel use, as one word on its row. */
const lineWords = {
  write: "writes",
  read: "reads",
  publish: "publishes",
  consume: "consumes",
} as const;
const wordsByDesign = new WeakMap<DesignDocument, ReadonlyMap<string, string>>();

/**
 * Each line's word from the blueprint's connections (`access`, else `channelUse`), by connection
 * ID, worked out once per design. A line it has no word for (a call, an entry, the user's line to
 * an action) reads "calls". Blueprint v3's connections are v2's; v2 refuses a schema-3 design with
 * explicit declarations, so they are read from v3.
 */
export function connectionWords(design: DesignDocument): ReadonlyMap<string, string> {
  let words = wordsByDesign.get(design);
  if (!words) {
    words = new Map(
      designBlueprintV3(design).connections.flatMap((item) => {
        const use = item.access ?? item.channelUse;
        return item.source === "design" && use ? [[item.id, lineWords[use]] as const] : [];
      }),
    );
    wordsByDesign.set(design, words);
  }
  return words;
}

/**
 * The icon of a node on the board, in its family's colours: the user's figure, an action's lane
 * icon or a tile's kind icon (none for a tile with no kind).
 */
export function LaneNodeIcon({
  graph,
  id,
  size,
  className,
}: {
  graph: LaneGraph;
  id: string;
  size: number;
  className: string;
}) {
  const node = graph.nodes.find((item) => item.id === id);
  const visual = node?.kind ? studioDefinitions[node.kind].visual : undefined;
  return (
    <span className={className} data-family={visual?.color ?? "generic"}>
      {id === LANE_ACTOR ? (
        <HumanFigure size={Math.round(size / 1.55)} color="var(--ink)" />
      ) : node?.action ? (
        <LaneIcon lane={node.action} size={size} />
      ) : visual ? (
        <StudioIcon name={visual.icon} size={size} />
      ) : null}
    </span>
  );
}

/** Whether a tile, the user or an action has any line on the board. */
export const hasLines = (graph: LaneGraph, id: string) =>
  graph.edges.some((edge) => edge.source === id || edge.target === id);

/**
 * A tile's or an action's lines as rows, incoming first, each in the board's order: From or To,
 * the other end's icon, its name and kind, and at the right what the line does (`connectionWords`).
 * A row is one button; a click calls `onJump` with the other end's ID.
 */
export function ConnectionList({
  design,
  graph,
  id,
  name,
  onJump,
}: {
  design: DesignDocument;
  graph: LaneGraph;
  id: string;
  name: (id: string) => string;
  onJump: (to: string) => void;
}) {
  const words = connectionWords(design);
  const rows = [
    ...graph.edges
      .filter((edge) => edge.target === id)
      .map((edge) => ({ line: edge.id, way: "From", other: edge.source })),
    ...graph.edges
      .filter((edge) => edge.source === id)
      .map((edge) => ({ line: edge.id, way: "To", other: edge.target })),
  ];
  return (
    <ul className="lane-connection-list" aria-label="Connections">
      {rows.map(({ line, way, other }) => {
        const node = graph.nodes.find((item) => item.id === other);
        const kind = node?.action
          ? "Action"
          : node?.kind
            ? studioDefinitions[node.kind].name
            : undefined;
        const word = words.get(line) ?? "calls";
        return (
          <li key={line}>
            <button
              type="button"
              className="lane-connection"
              data-line={line}
              aria-label={`${way} ${name(other)}${kind ? `, ${kind}` : ""}: ${word}`}
              onClick={() => onJump(other)}
            >
              <span className="lane-connection-way">{way}</span>
              <LaneNodeIcon graph={graph} id={other} size={18} className="lane-connection-icon" />
              <span className="lane-connection-name">
                {name(other)}
                {kind ? <small> · {kind}</small> : null}
              </span>
              <small className="lane-connection-word">{word}</small>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A tile's modules as cards, as the module menu draws them (its kind's group's colours): the name,
 * and in a pill the dot and word for what its kind can generate in the tile; then its icon, its
 * kind and its Description on one line. A click opens one.
 */
function ModuleCards({
  modules,
  host,
  list,
  onOpen,
}: {
  modules: readonly StudioComponent[];
  /** The tile's kind. */
  host: StudioKind | undefined;
  list: RefObject<HTMLUListElement | null>;
  onOpen: (id: string) => void;
}) {
  return (
    <ul ref={list} className="lane-module-list" aria-label="Modules">
      {modules.map((item) => {
        const kind = item.settings.kind;
        const generation = host ? moduleGeneration(kind, host) : undefined;
        return (
          <li key={item.id}>
            <button
              type="button"
              className="lane-module-card"
              data-module={item.id}
              data-family={moduleGroupOf(kind).family}
              aria-label={`Open ${item.name}`}
              onClick={() => onOpen(item.id)}
            >
              <span className="lane-module-top">
                <strong>{item.name}</strong>
                {generation ? (
                  <span className="lane-generation-pill" data-generation={generation}>
                    <GenerationDot generation={generation} />
                    {generationWords[generation].word}
                  </span>
                ) : null}
              </span>
              <span className="lane-module-line">
                <span className="lane-module-icon">
                  <StudioIcon name={studioComponentVisuals[kind].icon} size={15} />
                </span>
                <span className="lane-module-text">
                  <span className="lane-module-kind">{studioComponentDefinitions[kind].name}</span>
                  {item.description ? (
                    <>
                      {" · "}
                      <span className="lane-module-description">{item.description}</span>
                    </>
                  ) : null}
                </span>
              </span>
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
  graph,
  id,
  name,
  nameOf,
  module: open,
  moduleKey,
  onModule,
  onJump,
  adding,
}: {
  projectId: string;
  design: DesignDocument;
  graph: LaneGraph;
  id: string;
  name: string;
  /** Any node's name, for the Connections rows. */
  nameOf: (id: string) => string;
  /** The open module (the workspace's `selection.module`), always one of this tile's. */
  module?: string;
  /** Its page's key, kept when a rename re-keys the module (default: its ID). */
  moduleKey?: string;
  /** Opens one of this tile's modules, or (undefined) returns to the tile. */
  onModule: (module?: string) => void;
  /** Selects the tile at a Connections row's other end, with a Back to this one. */
  onJump: (to: string) => void;
  /** The module menu and the pick for the Modules section's `+`. */
  adding?: ModuleAdding;
}) {
  const modules = (design.architecture?.studio?.components ?? []).filter(
    (item) => item.host === id,
  );
  const module = open ? modules.find((item) => item.id === open) : undefined;
  const kind = design.architecture?.studio?.elements.find((item) => item.element === id)?.settings
    .kind;
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
        connections={
          hasLines(graph, id) ? (
            <ConnectionList design={design} graph={graph} id={id} name={nameOf} onJump={onJump} />
          ) : undefined
        }
        modules={
          modules.length || groups?.length ? (
            <>
              {modules.length ? (
                <ModuleCards modules={modules} host={kind} list={list} onOpen={onModule} />
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
