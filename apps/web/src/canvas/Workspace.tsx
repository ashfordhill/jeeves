// The Design tab: the chat rail, the lane canvas and the inspector rail, with Undo, Redo and the
// rail toggles in the app header and Select, Hand and Fit on the canvas. The canvas is read-only
// here: tiles and lines are selected and inspected; settings are edited in the inspector.
import type { BoardHandle, BoardMode, BoardSelection } from "@jeeves/board";
import {
  type DesignDocument,
  LANE_ACTOR,
  type LaneEdge,
  type LaneGraph,
  laneGraph,
  type StudioLane,
  studioDefinitions,
} from "@jeeves/spec";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowRight,
  IconFocusCentered,
  IconHandStop,
  IconLayoutSidebarRight,
  IconMessageCircle,
  IconPointer,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChatPanel } from "../chat/ChatPanel.tsx";
import { formDrafts } from "../project/form-drafts.ts";
import { canRedo, canUndo, useDraw } from "../project/store.ts";
import { ConnectionForm } from "../studio/ConnectionForm.tsx";
import { DraftFeedback } from "../studio/DraftFeedback.tsx";
import { TargetInspector } from "../studio/InspectorForm.tsx";
import { useStudioPreferences } from "../studio/preferences.ts";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import "../studio/studio.css";
import { LaneCanvas, LaneIcon, laneNames } from "./LaneCanvas.tsx";
import { RailResize } from "./RailResize.tsx";
import { ACTOR_NAME } from "./tiles/ActorTile.tsx";

type Loaded = NonNullable<ReturnType<typeof useDraw.getState>["loaded"]>;

export function Workspace() {
  const loaded = useDraw((state) => state.loaded);
  if (!loaded) return null;
  return <ProjectWorkspace key={loaded.project.id} loaded={loaded} />;
}

/** A selection whose tile or line no longer exists (undo, chat) falls back to none. */
function liveSelection(graph: LaneGraph, pick: BoardSelection): BoardSelection {
  if (pick.tile && graph.nodes.some((node) => node.id === pick.tile)) return { tile: pick.tile };
  if (pick.line && graph.edges.some((edge) => edge.id === pick.line)) return { line: pick.line };
  return {};
}

function ProjectWorkspace({ loaded }: { loaded: Loaded }) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const projectId = loaded.project.id;
  const hasDraft = formDrafts
    .forProject(projectId)
    .some(
      (entry) =>
        entry.flight || (entry.paths.size && !entry.problem && !Object.keys(entry.errors).length),
    );
  const historyBusy = useDraw((state) => state.historyBusy);
  const failed = formDrafts.hasProblems(projectId);
  const undoable = useDraw(canUndo);
  const redoable = useDraw(canRedo);
  const notice = useDraw((state) => state.notice);
  const [preferences, setPreferences] = useStudioPreferences(projectId);
  const [mode, setMode] = useState<BoardMode>("select");
  const [pick, setPick] = useState<BoardSelection>({});
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  const board = useRef<BoardHandle>(null);
  const graph = useMemo(() => laneGraph(loaded.design), [loaded.design]);
  const selection = liveSelection(graph, pick);

  useEffect(() => {
    setHeaderHost(document.getElementById("studio-header-controls"));
  }, []);
  useEffect(() => {
    // Chat messages carry the selected element, connection or entry.
    const ids = selection.line
      ? [selection.line]
      : selection.tile && selection.tile !== LANE_ACTOR
        ? [selection.tile]
        : [];
    useDraw.setState({ architectureSelection: ids });
  }, [selection.tile, selection.line]);
  useEffect(() => () => useDraw.setState({ architectureSelection: undefined }), []);
  useEffect(() => {
    // Optional V/H shortcuts mirror the Select and Hand buttons (mouse remains sufficient).
    const shortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((key !== "v" && key !== "h") || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      setMode(key === "h" ? "hand" : "select");
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const select = (next: BoardSelection) => {
    if (next.tile !== selection.tile || next.line !== selection.line)
      void formDrafts.flushProject(projectId, true);
    setPick(next);
    if (next.tile || next.line)
      setPreferences((current) =>
        current.inspectorOpen ? current : { ...current, inspectorOpen: true },
      );
  };
  const toggle = (rail: "chatOpen" | "inspectorOpen") => {
    if (rail === "inspectorOpen") void formDrafts.flushProject(projectId, true);
    setPreferences((current) => ({ ...current, [rail]: !current[rail] }));
  };

  const header = (
    <div className="studio-header-actions lane-header-actions">
      <button
        type="button"
        title="Undo"
        aria-label="Undo"
        disabled={historyBusy || failed || (!undoable && !hasDraft)}
        onClick={() => void useDraw.getState().undo()}
      >
        <IconArrowBackUp size={18} />
      </button>
      <button
        type="button"
        title="Redo"
        aria-label="Redo"
        disabled={historyBusy || failed || !redoable || hasDraft}
        onClick={() => void useDraw.getState().redo()}
      >
        <IconArrowForwardUp size={18} />
      </button>
      <button
        type="button"
        title={preferences.chatOpen ? "Collapse chat" : "Open chat"}
        aria-label={preferences.chatOpen ? "Collapse chat" : "Open chat"}
        aria-pressed={preferences.chatOpen}
        onClick={() => toggle("chatOpen")}
      >
        <IconMessageCircle size={18} />
      </button>
      <button
        type="button"
        title={preferences.inspectorOpen ? "Collapse inspector" : "Open inspector"}
        aria-label={preferences.inspectorOpen ? "Collapse inspector" : "Open inspector"}
        aria-pressed={preferences.inspectorOpen}
        onClick={() => toggle("inspectorOpen")}
      >
        <IconLayoutSidebarRight size={18} />
      </button>
    </div>
  );

  return (
    <div className="studio-workspace">
      {headerHost ? createPortal(header, headerHost) : null}
      {preferences.chatOpen ? (
        <>
          <aside
            className="studio-chat studio-rail"
            style={{ width: preferences.chatWidth }}
            aria-label="Chat rail"
          >
            <div className="studio-rail-header">
              <strong>Chat</strong>
              <button type="button" aria-label="Close chat" onClick={() => toggle("chatOpen")}>
                <IconX size={17} />
              </button>
            </div>
            <ChatPanel />
          </aside>
          <RailResize
            side="chat"
            value={preferences.chatWidth}
            onChange={(chatWidth) => setPreferences((current) => ({ ...current, chatWidth }))}
          />
        </>
      ) : null}
      <div className="studio-center">
        <LaneCanvas
          ref={board}
          design={loaded.design}
          graph={graph}
          selected={selection}
          mode={mode}
          onSelectTile={(tile) => select({ tile })}
          onSelectLine={(line) => select({ line })}
          onClear={() => select({})}
        />
        <div className="studio-tools" role="toolbar" aria-label="Canvas tools">
          <button
            type="button"
            title="Select (V)"
            aria-label="Select"
            aria-pressed={mode === "select"}
            onClick={() => setMode("select")}
          >
            <IconPointer size={19} />
          </button>
          <button
            type="button"
            title="Hand (H)"
            aria-label="Hand"
            aria-pressed={mode === "hand"}
            onClick={() => setMode("hand")}
          >
            <IconHandStop size={19} />
          </button>
          <button type="button" title="Fit" aria-label="Fit" onClick={() => board.current?.fit()}>
            <IconFocusCentered size={19} />
          </button>
        </div>
        {notice ? (
          <div className="studio-notice" role={notice.tone === "error" ? "alert" : "status"}>
            <span>{notice.message}</span>
            <button
              type="button"
              aria-label="Dismiss notice"
              onClick={() => useDraw.getState().setNotice(undefined)}
            >
              <IconX size={16} />
            </button>
          </div>
        ) : null}
        <DraftFeedback projectId={projectId} />
      </div>
      {preferences.inspectorOpen ? (
        <>
          <RailResize
            side="inspector"
            value={preferences.inspectorWidth}
            onChange={(inspectorWidth) =>
              setPreferences((current) => ({ ...current, inspectorWidth }))
            }
          />
          <aside
            className="studio-inspector studio-rail"
            style={{ width: preferences.inspectorWidth }}
            aria-label="Inspector rail"
          >
            <div className="studio-rail-header">
              <strong>Inspector</strong>
              <button
                type="button"
                aria-label="Close inspector"
                onClick={() => toggle("inspectorOpen")}
              >
                <IconX size={17} />
              </button>
            </div>
            <Inspector
              key={selection.tile ?? selection.line ?? LANE_ACTOR}
              loaded={loaded}
              graph={graph}
              selection={selection}
              onSelect={select}
            />
          </aside>
        </>
      ) : null}
    </div>
  );
}

const elementName = (design: DesignDocument, id: string) =>
  id === LANE_ACTOR ? ACTOR_NAME : (design.elements.find((item) => item.id === id)?.name ?? id);

/** A tile, a connection, an entry, or (for the actor and no selection) the system. */
function Inspector({
  loaded,
  graph,
  selection,
  onSelect,
}: {
  loaded: Loaded;
  graph: LaneGraph;
  selection: BoardSelection;
  onSelect: (next: BoardSelection) => void;
}) {
  const { design, project } = loaded;
  const name = (id: string) => elementName(design, id);
  const edge = selection.line ? graph.edges.find((item) => item.id === selection.line) : undefined;
  if (selection.tile && selection.tile !== LANE_ACTOR) {
    const id = selection.tile;
    const kind = graph.nodes.find((node) => node.id === id)?.kind;
    const definition = kind ? studioDefinitions[kind] : undefined;
    return (
      <div className="studio-selection-summary">
        <h2 className="lane-inspector-title" data-family={definition?.visual.color ?? "generic"}>
          <StudioIcon name={definition?.visual.icon} size={22} />
          {name(id)}
        </h2>
        {definition ? <p className="lane-inspector-kind">{definition.name}</p> : null}
        <TargetInspector
          projectId={project.id}
          element={id}
          label={name(id)}
          design={design}
          onConnection={(line) => onSelect({ line })}
        />
      </div>
    );
  }
  if (edge?.lane)
    return (
      <EntrySummary edge={edge} lane={edge.lane} name={name} graph={graph} onSelect={onSelect} />
    );
  if (edge)
    return (
      <div className="studio-selection-summary">
        <h2>Connection</h2>
        <p>
          {name(edge.source)} → {name(edge.target)}
        </p>
        <ConnectionForm
          projectId={project.id}
          target={{ kind: "connection", id: edge.id }}
          design={design}
        />
      </div>
    );
  return (
    <div className="studio-selection-summary">
      <h2>{design.architecture?.system.name ?? project.name}</h2>
      <p className="lane-inspector-kind">System</p>
      <TargetInspector
        projectId={project.id}
        label={project.name}
        design={design}
        onConnection={(line) => onSelect({ line })}
      />
    </div>
  );
}

/** An entry line: its lane and the tile the user reaches directly. */
function EntrySummary({
  edge,
  lane,
  name,
  graph,
  onSelect,
}: {
  edge: LaneEdge;
  lane: StudioLane;
  name: (id: string) => string;
  graph: LaneGraph;
  onSelect: (next: BoardSelection) => void;
}) {
  const kind = graph.nodes.find((node) => node.id === edge.target)?.kind;
  const visual = kind ? studioDefinitions[kind].visual : undefined;
  return (
    <div className="studio-selection-summary">
      <h2 className="lane-inspector-title">
        <LaneIcon lane={lane} size={22} />
        {laneNames[lane]} lane
      </h2>
      <p className="lane-inspector-kind">Lane entry</p>
      <div className="lane-entry">
        <button type="button" onClick={() => onSelect({ tile: LANE_ACTOR })}>
          {ACTOR_NAME}
        </button>
        <IconArrowRight size={18} aria-hidden />
        <button
          type="button"
          data-family={visual?.color ?? "generic"}
          onClick={() => onSelect({ tile: edge.target })}
        >
          <StudioIcon name={visual?.icon} size={18} />
          {name(edge.target)}
        </button>
      </div>
    </div>
  );
}
