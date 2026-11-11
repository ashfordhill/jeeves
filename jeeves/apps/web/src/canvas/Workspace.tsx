// The Design tab: the chat rail, the lane canvas and the inspector rail, with Undo, Redo and the
// rail toggles in the app header and Pointer, Connect, Fit and Detailed | Simple on the canvas
// (the mode is view state; the view is a per-project browser preference, Detailed by default;
// the selection carries across both). The selected tile's pull tabs add tiles and modules
// (`creation.tsx`; a new one opens with its name focused), connect mode links tiles, and in the
// Detailed view modules, by dragging (`connect.ts`), the red X on a tile or line removes it
// (`removal.tsx`; in connect mode a module line's X disconnects that module); settings and
// modules are edited in the inspector (`TileInspector.tsx`), an action's name in its own
// (`ActionInspector`), and an entry's lane in its own (`EntrySummary`).
// The selection (`selection.ts`) is a tile or a line, and with a tile, its open module.
import type { BoardHandle, BoardMode } from "@jeeves/board";
import {
  applyOperations,
  buildStudioCommand,
  type DesignDocument,
  designOperations,
  designOwnership,
  LANE_ACTOR,
  type LaneEdge,
  type LaneGraph,
  laneActionNode,
  laneActionOf,
  laneEntryRefusal,
  laneGraph,
  operationChanges,
  operationSelectionReference,
  ownerSelectionReference,
  type StudioLane,
  studioActionDefaults,
  studioDefinitions,
  studioLanes,
  studioWarnings,
} from "@jeeves/spec";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowRight,
  IconDownload,
  IconFocusCentered,
  IconLayoutSidebarRight,
  IconLink,
  IconMessageCircle,
  IconPointer,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChatPanel } from "../chat/ChatPanel.tsx";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { formDrafts } from "../project/form-drafts.ts";
import { canRedo, canUndo, useProject } from "../project/store.ts";
import { ActionForm } from "../studio/ActionForm.tsx";
import { commitAction } from "../studio/actions.ts";
import { ConnectionForm } from "../studio/ConnectionForm.tsx";
import { DraftFeedback } from "../studio/DraftFeedback.tsx";
import { TargetInspector } from "../studio/InspectorForm.tsx";
import { OperationChanges } from "../studio/OperationChanges.tsx";
import { type CanvasView, useStudioPreferences } from "../studio/preferences.ts";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import "../studio/studio.css";
import { useLaneConnect } from "./connect.ts";
import { startsSelected, useLaneCreation } from "./creation.tsx";
import { ExportDiagram } from "./ExportDiagram.tsx";
import { GenerateProject } from "./GenerateProject.tsx";
import { LaneCanvas, laneNodeName } from "./LaneCanvas.tsx";
import { LaneIcon, laneNames } from "./LaneIcon.tsx";
import { RailResize } from "./RailResize.tsx";
import { useLaneRemoval } from "./removal.tsx";
import { SourceDiagnostics } from "./SourceDiagnostics.tsx";
import {
  followKeys,
  followSelection,
  liveSelection,
  type WorkspaceSelection,
} from "./selection.ts";
import { dialogOpen, historyKey, inField } from "./shortcuts.ts";
import { TileInspector } from "./TileInspector.tsx";
import { WarningList } from "./Warnings.tsx";

type Loaded = NonNullable<ReturnType<typeof useProject.getState>["loaded"]>;

export function Workspace() {
  const loaded = useProject((state) => state.loaded);
  if (!loaded) return null;
  return <ProjectWorkspace key={loaded.project.id} loaded={loaded} />;
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
  const historyBusy = useProject((state) => state.historyBusy);
  const failed = formDrafts.hasProblems(projectId);
  const generationBlocked =
    historyBusy ||
    failed ||
    formDrafts.forProject(projectId).some((draft) => draft.flight || draft.paths.size);
  const undoable = useProject(canUndo);
  const redoable = useProject(canRedo);
  const notice = useProject((state) => state.notice);
  const [preferences, setPreferences] = useStudioPreferences(projectId);
  const [mode, setMode] = useState<BoardMode>("select");
  const graph = useMemo(() => laneGraph(loaded.design), [loaded.design]);
  const [pick, setPick] = useState<WorkspaceSelection>(() => startsSelected(graph));
  // A rename that re-keyed IDs (IDs follow names) moves the selection to the new IDs at once,
  // before anything renders the old ones. The inspector's pages keep their React keys (`keyOf`),
  // so a field being typed in keeps its focus and draft.
  const [followed, setFollowed] = useState(() => ({
    renamed: loaded.renamed,
    keys: {} as Readonly<Record<string, string>>,
  }));
  if (loaded.renamed !== followed.renamed) {
    const renamed = loaded.renamed;
    setFollowed({
      renamed,
      keys: renamed?.length
        ? followKeys(followed.keys, renamed, loaded.design.revision)
        : followed.keys,
    });
    if (renamed?.length) setPick((current) => followSelection(current, renamed));
  }
  const keyOf = (id: string) => followed.keys[id] ?? id;
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  const [focusName, setFocusName] = useState<string>();
  const [exportOpen, setExportOpen] = useState(false);
  const [generationOpen, setGenerationOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [operationPick, setOperationPick] = useState<string>();
  const [ownerPick, setOwnerPick] = useState<string>();
  const ownership = designOwnership(loaded.design);
  const selectedOperation = designOperations(loaded.design).receivers.find(
    (x) => x.id === operationPick,
  );
  const selectedOwner = ownership.owners.find((x) => x.id === ownerPick);
  const board = useRef<BoardHandle>(null);
  const selection = liveSelection(loaded.design, graph, pick);

  useEffect(() => {
    setHeaderHost(document.getElementById("studio-header-controls"));
  }, []);
  useEffect(() => {
    // Chat messages carry the open module, or the selected element, connection or entry; the
    // user, its actions and its lines to them have no design ID.
    const id = selection.module ?? selection.line ?? selection.tile;
    const ids = selectedOperation
      ? [operationSelectionReference(selectedOperation.id)]
      : selectedOwner
        ? [ownerSelectionReference(selectedOwner.id)]
        : id && !id.startsWith("@")
          ? [id]
          : [];
    useProject.setState({ architectureSelection: ids });
  }, [selection.tile, selection.line, selection.module, selectedOwner, selectedOperation]);
  useEffect(() => () => useProject.setState({ architectureSelection: undefined }), []);
  useEffect(() => {
    // A new tile or module opens with its Name field focused, ready to rename.
    if (!focusName || focusName !== (selection.module ?? selection.tile)) return;
    const field = document.querySelector<HTMLInputElement>(
      '.studio-inspector :is(input[id$="-element.name"], input[id$="-action.name"], input[id$="-component.name"])',
    );
    if (!field) return;
    field.focus();
    field.select();
    setFocusName(undefined);
  });
  // Optional shortcuts (`shortcuts.ts`; mouse remains sufficient): Ctrl/Cmd+Z and
  // Ctrl/Cmd+Shift+Z or Ctrl+Y press the header's Undo and Redo while they are enabled and no
  // dialog is open, V and C the Pointer and Connect buttons, Escape returns to Pointer (once
  // nothing else, such as a dialog or a drag, took it), and Delete/Backspace the selected tile's
  // or line's X. None acts while focus is in a field.
  const removeSelected = useRef(() => {});
  const historyEnabled = useRef({ undo: false, redo: false });
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (inField(target)) return;
      const step = historyKey(event);
      if (step) {
        if (!historyEnabled.current[step] || dialogOpen()) return;
        event.preventDefault();
        void useProject.getState()[step]();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      const modes: Record<string, BoardMode> = { v: "select", c: "connect" };
      const next = modes[key];
      if (next) setMode(next);
      if (key === "escape" && !event.defaultPrevented && !target?.closest('[role="dialog"]'))
        setMode("select");
      if (key !== "delete" && key !== "backspace") return;
      event.preventDefault();
      removeSelected.current();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  /** Selects a tile (with one of its modules open, or none) or a line, or clears. */
  const select = (next: WorkspaceSelection) => {
    if (
      next.tile !== selection.tile ||
      next.line !== selection.line ||
      next.module !== selection.module
    )
      void formDrafts.flushProject(projectId, true);
    setOperationPick(undefined);
    setOwnerPick(undefined);
    setPick(next);
    if (next.tile || next.line)
      setPreferences((current) =>
        current.inspectorOpen ? current : { ...current, inspectorOpen: true },
      );
  };
  const creation = useLaneCreation({
    projectId,
    projectName: loaded.project.name,
    design: loaded.design,
    graph,
    tile: mode === "select" ? selection.tile : undefined,
    onCreated: (tile) => {
      select({ tile });
      setFocusName(tile);
    },
    onModuleCreated: (tile, module) => {
      select({ tile, module });
      setFocusName(module);
    },
  });
  const { disconnectModule, ...connect } = useLaneConnect({ projectId, design: loaded.design });
  const { remove, ...removal } = useLaneRemoval({
    projectId,
    design: loaded.design,
    graph,
    tile: mode === "select" ? selection.tile : undefined,
    onRemoved: (tile) => select(tile ? { tile } : {}),
  });
  removeSelected.current = () => {
    if (mode !== "select") return;
    if (selection.tile) remove(selection.tile);
    else if (selection.line) removal.onRemoveLine?.(selection.line);
  };
  const view = preferences.view;
  const showView = (next: CanvasView) =>
    setPreferences((current) => (current.view === next ? current : { ...current, view: next }));
  const toggle = (rail: "chatOpen" | "inspectorOpen") => {
    if (rail === "inspectorOpen") void formDrafts.flushProject(projectId, true);
    setPreferences((current) => ({ ...current, [rail]: !current[rail] }));
  };

  // The header's buttons and their keys: Undo also runs while an edit is pending (it saves the
  // edit first); Redo doesn't.
  const history = {
    undo: !historyBusy && !failed && (undoable || hasDraft),
    redo: !historyBusy && !failed && redoable && !hasDraft,
  };
  historyEnabled.current = history;
  const header = (
    <div className="studio-header-actions lane-header-actions">
      <button
        type="button"
        title="Undo"
        aria-label="Undo"
        disabled={!history.undo}
        onClick={() => void useProject.getState().undo()}
      >
        <IconArrowBackUp size={18} />
      </button>
      <button
        type="button"
        title="Redo"
        aria-label="Redo"
        disabled={!history.redo}
        onClick={() => void useProject.getState().redo()}
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
      {generationOpen ? <GenerateProject onClose={() => setGenerationOpen(false)} /> : null}
      {exportOpen ? (
        <ExportDiagram
          board={board}
          view={view}
          onDiagnostics={() => {
            setExportOpen(false);
            setDiagnosticsOpen(true);
          }}
          onClose={() => setExportOpen(false)}
        />
      ) : null}
      {diagnosticsOpen ? (
        <SourceDiagnostics
          design={loaded.design}
          projectName={loaded.project.name}
          selectedOperation={selectedOperation?.id}
          onClose={() => setDiagnosticsOpen(false)}
          onTarget={(target) => {
            setDiagnosticsOpen(false);
            if (target.operation) {
              const receiver = designOperations(loaded.design).receivers.find(
                (item) => item.id === target.operation,
              );
              if (receiver) {
                select({ tile: receiver.role });
                setOperationPick(receiver.id);
              }
            } else if (target.owner) {
              select({});
              setOwnerPick(target.owner);
            } else if (target.connection) select({ line: target.connection });
            else if (target.element) select({ tile: target.element });
          }}
        />
      ) : null}
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
          view={view}
          selected={selection}
          mode={mode}
          onSelectTile={(tile) => select({ tile })}
          onSelectLine={(line) => select({ line })}
          onOpenModule={(tile, module) => select({ tile, module })}
          onClear={() => select({})}
          creation={creation}
          removal={removal}
          connect={connect}
          onDisconnectModule={disconnectModule}
        />
        <div className="studio-tools" role="toolbar" aria-label="Canvas tools">
          <button
            type="button"
            title="Pointer (V)"
            aria-label="Pointer"
            aria-pressed={mode === "select"}
            onClick={() => setMode("select")}
          >
            <IconPointer size={19} />
          </button>
          <button
            type="button"
            title="Connect (C)"
            aria-label="Connect"
            aria-pressed={mode === "connect"}
            onClick={() => setMode((current) => (current === "connect" ? "select" : "connect"))}
          >
            <IconLink size={19} />
          </button>
          <button type="button" title="Fit" aria-label="Fit" onClick={() => board.current?.fit()}>
            <IconFocusCentered size={19} />
          </button>
          <fieldset className="studio-view-toggle" aria-label="View">
            {(
              [
                ["detailed", "Detailed"],
                ["simple", "Simple"],
              ] as const
            ).map(([choice, label]) => (
              <button
                key={choice}
                type="button"
                aria-pressed={view === choice}
                onClick={() => showView(choice)}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            className="diagram-export-trigger"
            title={
              hasDraft || failed || historyBusy
                ? "Finish saving edits before exporting"
                : "Export diagram"
            }
            disabled={hasDraft || failed || historyBusy}
            onClick={() => setExportOpen(true)}
          >
            <IconDownload size={18} /> Export diagram
          </button>
          <button
            type="button"
            title={
              generationBlocked
                ? "Finish saving edits before generating"
                : "Generate experimental project"
            }
            disabled={generationBlocked}
            onClick={() => setGenerationOpen(true)}
          >
            Generate project
          </button>
        </div>
        {notice ? (
          <div className="studio-notice" role={notice.tone === "error" ? "alert" : "status"}>
            <span>{notice.message}</span>
            <button
              type="button"
              aria-label="Dismiss notice"
              onClick={() => useProject.getState().setNotice(undefined)}
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
              key={selection.tile ? keyOf(selection.tile) : (selection.line ?? LANE_ACTOR)}
              loaded={loaded}
              graph={graph}
              selection={selection}
              moduleKey={selection.module && keyOf(selection.module)}
              onSelect={select}
            />
            {selectedOperation || selectedOwner ? (
              <p className="studio-field-help" role="status">
                Selected {selectedOperation ? "operation" : "logical owner"} for chat ·{" "}
                {selectedOperation?.id ?? selectedOwner?.id}
              </p>
            ) : null}
          </aside>
        </>
      ) : null}
    </div>
  );
}

/**
 * A tile, an action, a connection, an entry, the user's line to an action, or (for the actor and
 * no selection) the system.
 */
function Inspector({
  loaded,
  graph,
  selection,
  moduleKey,
  onSelect,
}: {
  loaded: Loaded;
  graph: LaneGraph;
  selection: WorkspaceSelection;
  /** The open module's page key, which stays when a rename re-keys the module. */
  moduleKey?: string;
  onSelect: (next: WorkspaceSelection) => void;
}) {
  const { design, project } = loaded;
  const name = (id: string) => laneNodeName(design, graph, id);
  const edge = selection.line ? graph.edges.find((item) => item.id === selection.line) : undefined;
  const action = selection.tile ? laneActionOf(selection.tile) : undefined;
  if (action)
    return <ActionInspector projectId={project.id} design={design} lane={action} name={name} />;
  if (selection.tile && selection.tile !== LANE_ACTOR)
    return (
      <TileInspector
        projectId={project.id}
        design={design}
        id={selection.tile}
        name={name(selection.tile)}
        module={selection.module}
        moduleKey={moduleKey}
        onModule={(module) => onSelect({ tile: selection.tile, module })}
      />
    );
  const started = edge && edge.source === LANE_ACTOR ? laneActionOf(edge.target) : undefined;
  if (edge && started)
    return (
      <div className="studio-selection-summary">
        <h2 className="lane-inspector-title">
          <LaneIcon lane={started} size={22} />
          {name(edge.target)}
        </h2>
        <p className="lane-inspector-kind">
          The user's {studioActionDefaults[started]} action, which starts the{" "}
          {laneNames[started].toLowerCase()} lane. The line goes with the action.
        </p>
        <EntryPath
          name={name}
          graph={graph}
          from={LANE_ACTOR}
          to={edge.target}
          onSelect={onSelect}
        />
      </div>
    );
  if (edge?.lane)
    return (
      <EntrySummary
        projectId={project.id}
        design={design}
        edge={edge}
        lane={edge.lane}
        name={name}
        graph={graph}
        onSelect={onSelect}
      />
    );
  if (edge) {
    const connection = design.connections.find((item) => item.id === edge.id);
    const channelUse = design.architecture?.studio?.connections.find(
      (item) => item.connection === edge.id,
    )?.settings.channelUse;
    return (
      <div className="studio-selection-summary">
        <h2>Connection</h2>
        <p>
          {name(edge.source)} → {name(edge.target)}
        </p>
        <p className="lane-connection-label">{connection?.planned.label}</p>
        <dl className="lane-facts" aria-label="Relationship">
          <dt>Interaction</dt>
          <dd>{edge.async ? "Asynchronous (dashed)" : "Request / response (solid)"}</dd>
          <dt>Arrow</dt>
          <dd>
            {channelUse === "publish"
              ? "Publisher → channel"
              : channelUse === "consume"
                ? "Channel → consumer"
                : edge.async
                  ? "Sender → receiver"
                  : "Caller → target"}
          </dd>
        </dl>
        <ConnectionForm projectId={project.id} connection={edge.id} design={design} />
      </div>
    );
  }
  return (
    <div className="studio-selection-summary">
      <TargetInspector
        projectId={project.id}
        label={project.name}
        design={design}
        warnings={<WarningList warnings={studioWarnings(design)} name={name} onSelect={onSelect} />}
      />
    </div>
  );
}

/** Two buttons joined by an arrow, each selecting its tile: the user or an action, and a tile. */
function EntryPath({
  name,
  graph,
  from,
  to,
  onSelect,
}: {
  name: (id: string) => string;
  graph: LaneGraph;
  from: string;
  to: string;
  onSelect: (next: WorkspaceSelection) => void;
}) {
  const end = (id: string) => {
    const node = graph.nodes.find((item) => item.id === id);
    const visual = node?.kind ? studioDefinitions[node.kind].visual : undefined;
    return (
      <button
        type="button"
        data-family={visual?.color ?? "generic"}
        onClick={() => onSelect({ tile: id })}
      >
        {node?.action ? (
          <LaneIcon lane={node.action} size={18} />
        ) : visual ? (
          <StudioIcon name={visual.icon} size={18} />
        ) : null}
        {name(id)}
      </button>
    );
  };
  return (
    <div className="lane-entry">
      {end(from)}
      <IconArrowRight size={18} aria-hidden />
      {end(to)}
    </div>
  );
}

/**
 * A lane action: its name (the word on its tile), its lane (fixed) and its warnings. Its entries
 * are the lines drawn from it; an action with none is flagged by a warning.
 */
function ActionInspector({
  projectId,
  design,
  lane,
  name,
}: {
  projectId: string;
  design: DesignDocument;
  lane: StudioLane;
  name: (id: string) => string;
}) {
  const node = laneActionNode(lane);
  return (
    <div className="studio-selection-summary">
      <h2 className="lane-inspector-title">
        <LaneIcon lane={lane} size={22} />
        {name(node)}
      </h2>
      <p className="lane-inspector-kind">
        {studioActionDefaults[lane]} action: what the user does in the{" "}
        {laneNames[lane].toLowerCase()} lane
      </p>
      <WarningList warnings={studioWarnings(design).filter((item) => item.node === node)} />
      <ActionForm projectId={projectId} lane={lane} design={design} />
      <dl className="lane-facts">
        <dt>Lane</dt>
        <dd>
          <LaneIcon lane={lane} size={14} />
          {laneNames[lane]}
        </dd>
      </dl>
    </div>
  );
}

/**
 * An entry line: its action, the lane row (download or upload; a click is `setEntryLane`, which
 * moves it to that lane's action; a lane with no action or a full one is disabled with the
 * reason as its tooltip) and the tile the action reaches.
 */
function EntrySummary({
  projectId,
  design,
  edge,
  lane,
  name,
  graph,
  onSelect,
}: {
  projectId: string;
  design: DesignDocument;
  edge: LaneEdge;
  lane: StudioLane;
  name: (id: string) => string;
  graph: LaneGraph;
  onSelect: (next: WorkspaceSelection) => void;
}) {
  const [pending, setPending] = useState<{
    lane: StudioLane;
    revision: number;
    changes: ReturnType<typeof operationChanges>;
  }>();
  const commitMove = (next: StudioLane, revision?: number) => {
    setPending(undefined);
    void commitAction(projectId, (latest) => {
      if (revision !== undefined && latest.revision !== revision)
        throw new Error(
          "The design changed after this entry move preview. Preview its operation bindings again.",
        );
      return buildStudioCommand(latest, { type: "setEntryLane", entry: edge.id, lane: next }).ops;
    });
  };
  const move = (next: StudioLane) => {
    try {
      const candidate = applyOperations(
        design,
        buildStudioCommand(design, { type: "setEntryLane", entry: edge.id, lane: next }).ops,
      );
      if (!candidate.ok) throw new Error(candidate.errors.map((x) => x.message).join(" "));
      const changes = operationChanges(
        designOperations(design),
        designOperations(candidate.design),
      );
      if (changes.length) setPending({ lane: next, revision: design.revision, changes });
      else commitMove(next);
    } catch (error) {
      useProject.getState().setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const choices = useMemo(
    () =>
      studioLanes.map((choice) => ({
        lane: choice,
        refusal: choice === lane ? undefined : laneEntryRefusal(design, edge.id, choice),
      })),
    [design, edge.id, lane],
  );
  return (
    <div className="studio-selection-summary">
      {pending ? (
        <ConfigurationDialog
          title="Move entry operation bindings"
          size="lg"
          onClose={() => setPending(undefined)}
          footer={
            <div className="lane-remove-actions">
              <button type="button" onClick={() => setPending(undefined)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={pending.revision !== design.revision}
                onClick={() => commitMove(pending.lane, pending.revision)}
              >
                Move entry & clear bindings
              </button>
            </div>
          }
        >
          <p>
            Moving this canonical entry to {laneNames[pending.lane]} clears {pending.changes.length}{" "}
            operation bindings. It never retargets them. One Undo restores the whole move; unrelated
            requirements remain.
          </p>
          <OperationChanges design={design} changes={pending.changes} />
        </ConfigurationDialog>
      ) : null}
      <h2 className="lane-inspector-title">
        <LaneIcon lane={lane} size={22} />
        {name(edge.source)}
      </h2>
      <p className="lane-inspector-kind">Lane entry, {laneNames[lane].toLowerCase()} lane</p>
      <fieldset className="lane-kinds" aria-label="Lanes">
        {choices.map((choice) => {
          const current = choice.lane === lane;
          return (
            <button
              key={choice.lane}
              type="button"
              className="lane-kind"
              aria-label={`${laneNames[choice.lane]} lane`}
              aria-pressed={current}
              title={choice.refusal ?? `${laneNames[choice.lane]} lane`}
              disabled={!!choice.refusal}
              onClick={() => {
                if (current) return;
                move(choice.lane);
              }}
            >
              <LaneIcon lane={choice.lane} size={22} />
            </button>
          );
        })}
      </fieldset>
      <EntryPath
        name={name}
        graph={graph}
        from={edge.source}
        to={edge.target}
        onSelect={onSelect}
      />
    </div>
  );
}
