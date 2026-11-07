// The Design tab: the chat rail, the lane canvas and the inspector rail, with Undo, Redo and the
// rail toggles in the app header and Select, Hand and Fit on the canvas. The selected tile's pull
// tabs add tiles and attach them (`creation.tsx`), the red X on a tile or line removes it
// (`removal.tsx`); settings, kinds and modules are edited in the inspector (`TileInspector.tsx`),
// an action's name in its own (`ActionInspector`), and an entry's lane in its own
// (`EntrySummary`).
import type { BoardHandle, BoardMode, BoardSelection } from "@jeeves/board";
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
  studioStoreAccess,
  studioStoreAccessLabels,
  studioWarnings,
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
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { formDrafts } from "../project/form-drafts.ts";
import { canRedo, canUndo, useProject } from "../project/store.ts";
import { ActionForm } from "../studio/ActionForm.tsx";
import { commitAction } from "../studio/actions.ts";
import { ConnectionForm } from "../studio/ConnectionForm.tsx";
import { DesignScopeForm } from "../studio/DesignScopeForm.tsx";
import { DraftFeedback } from "../studio/DraftFeedback.tsx";
import { TargetInspector } from "../studio/InspectorForm.tsx";
import { OperationChanges } from "../studio/OperationChanges.tsx";
import { OperationsForm } from "../studio/OperationsForm.tsx";
import { OperationsSummary } from "../studio/OperationsSummary.tsx";
import { OwnershipForm } from "../studio/OwnershipForm.tsx";
import { OwnershipSummary } from "../studio/OwnershipSummary.tsx";
import { useStudioPreferences } from "../studio/preferences.ts";
import { ReadinessReport } from "../studio/ReadinessReport.tsx";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import "../studio/studio.css";
import { startsSelected, useLaneCreation } from "./creation.tsx";
import { LaneCanvas, laneNodeName } from "./LaneCanvas.tsx";
import { LaneIcon, laneNames } from "./LaneIcon.tsx";
import { ownerNodeId, projectOwnerGraph } from "./ownerProjection.ts";
import { RailResize } from "./RailResize.tsx";
import { RelationshipFocus } from "./RelationshipFocus.tsx";
import { useLaneRemoval } from "./removal.tsx";
import { TileInspector } from "./TileInspector.tsx";
import { WarningList } from "./Warnings.tsx";

type Loaded = NonNullable<ReturnType<typeof useProject.getState>["loaded"]>;

export function Workspace() {
  const loaded = useProject((state) => state.loaded);
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
  const historyBusy = useProject((state) => state.historyBusy);
  const failed = formDrafts.hasProblems(projectId);
  const undoable = useProject(canUndo);
  const redoable = useProject(canRedo);
  const notice = useProject((state) => state.notice);
  const [preferences, setPreferences] = useStudioPreferences(projectId);
  const [mode, setMode] = useState<BoardMode>("select");
  const graph = useMemo(() => laneGraph(loaded.design), [loaded.design]);
  const [pick, setPick] = useState<BoardSelection>(() => startsSelected(graph));
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  const [focusName, setFocusName] = useState<string>();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [ownershipOpen, setOwnershipOpen] = useState(false);
  const [expandedOwners, setExpandedOwners] = useState<string[]>([]);
  const [operationPick, setOperationPick] = useState<string>();
  const [ownerPick, setOwnerPick] = useState<string>();
  const ownership = designOwnership(loaded.design);
  const projection = useMemo(
    () => projectOwnerGraph(loaded.design, graph, expandedOwners),
    [loaded.design, graph, expandedOwners],
  );
  const selectedOperation = designOperations(loaded.design).receivers.find(
    (x) => x.id === operationPick,
  );
  const selectedOwner = ownership.owners.find((x) => x.id === ownerPick);
  const [focusTile, setFocusTile] = useState<string>();
  const board = useRef<BoardHandle>(null);
  const selection = liveSelection(graph, pick);
  const anchor = graph.nodes.some((node) => node.id === focusTile) ? focusTile : undefined;
  const focusedEdges = anchor
    ? graph.edges.filter((edge) => edge.source === anchor || edge.target === anchor)
    : undefined;
  const visibleLines = focusedEdges
    ?.filter((edge) => !selection.line || edge.id === selection.line)
    .map((edge) => edge.id);
  const emphasizedTiles = focusedEdges
    ? [
        ...new Set([
          anchor as string,
          ...focusedEdges
            .filter((edge) => !selection.line || edge.id === selection.line)
            .flatMap((edge) => [edge.source, edge.target]),
        ]),
      ]
    : undefined;

  useEffect(() => {
    setHeaderHost(document.getElementById("studio-header-controls"));
  }, []);
  useEffect(() => {
    // Chat messages carry the selected element, connection or entry; the user, its actions and
    // its lines to them have no design ID.
    const id = selection.line ?? selection.tile;
    const ids = selectedOperation
      ? [operationSelectionReference(selectedOperation.id)]
      : selectedOwner
        ? [ownerSelectionReference(selectedOwner.id)]
        : id && !id.startsWith("@")
          ? [id]
          : [];
    useProject.setState({ architectureSelection: ids });
  }, [selection.tile, selection.line, selectedOwner, selectedOperation]);
  useEffect(() => () => useProject.setState({ architectureSelection: undefined }), []);
  useEffect(() => {
    // A new tile opens with its Name field focused, ready to rename.
    if (!focusName || focusName !== selection.tile) return;
    const field = document.querySelector<HTMLInputElement>(
      '.studio-inspector :is(input[id$="-element.name"], input[id$="-action.name"])',
    );
    if (!field) return;
    field.focus();
    field.select();
    setFocusName(undefined);
  });
  // Optional shortcuts (mouse remains sufficient): V/H mirror the Select and Hand buttons, and
  // Delete/Backspace the selected tile's or line's X.
  const removeSelected = useRef(() => {});
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "v" || key === "h") setMode(key === "h" ? "hand" : "select");
      if (key !== "delete" && key !== "backspace") return;
      event.preventDefault();
      removeSelected.current();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const select = (next: BoardSelection) => {
    if (next.tile !== selection.tile || next.line !== selection.line)
      void formDrafts.flushProject(projectId, true);
    setOperationPick(undefined);
    setOwnerPick(undefined);
    const roles = ownership.roles.filter(
      (role) =>
        role.element === next.tile ||
        (next.line &&
          graph.edges.some(
            (edge) =>
              edge.id === next.line &&
              (edge.source === role.element || edge.target === role.element),
          )),
    );
    setExpandedOwners((current) => [...new Set([...current, ...roles.map((role) => role.owner)])]);
    setPick(next);
    if (anchor && next.tile) setFocusTile(next.tile);
    if (anchor && next.line) {
      const edge = graph.edges.find((item) => item.id === next.line);
      if (edge && edge.source !== anchor && edge.target !== anchor) setFocusTile(edge.source);
    }
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
  });
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
  const toggle = (rail: "chatOpen" | "inspectorOpen") => {
    if (rail === "inspectorOpen") void formDrafts.flushProject(projectId, true);
    setPreferences((current) => ({ ...current, [rail]: !current[rail] }));
  };

  const header = (
    <div className="studio-header-actions lane-header-actions">
      <button type="button" title="Profile & requirements" onClick={() => setScopeOpen(true)}>
        Profile & requirements
      </button>
      <button
        type="button"
        title="Undo"
        aria-label="Undo"
        disabled={historyBusy || failed || (!undoable && !hasDraft)}
        onClick={() => void useProject.getState().undo()}
      >
        <IconArrowBackUp size={18} />
      </button>
      <button
        type="button"
        title="Redo"
        aria-label="Redo"
        disabled={historyBusy || failed || !redoable || hasDraft}
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
      {operationsOpen ? (
        <OperationsForm
          projectId={projectId}
          design={loaded.design}
          onClose={() => setOperationsOpen(false)}
        />
      ) : null}
      {ownershipOpen ? (
        <OwnershipForm
          projectId={projectId}
          design={loaded.design}
          onClose={() => setOwnershipOpen(false)}
        />
      ) : null}
      {scopeOpen ? (
        <DesignScopeForm
          projectId={projectId}
          design={loaded.design}
          onClose={() => setScopeOpen(false)}
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
          graph={projection.graph}
          canonicalGraph={graph}
          onExpandOwner={(id) => {
            setExpandedOwners((current) => [...new Set([...current, id])]);
            setOwnerPick(id);
          }}
          selected={selectedOwner ? { tile: ownerNodeId(selectedOwner.id) } : selection}
          mode={mode}
          onSelectTile={(tile) => {
            const owner = ownership.owners.find((x) => ownerNodeId(x.id) === tile);
            if (owner) {
              void formDrafts.flushProject(projectId, true);
              setOperationPick(undefined);
              setOwnerPick(owner.id);
              setPick({});
              setFocusTile(undefined);
              setPreferences((current) => ({ ...current, inspectorOpen: true }));
            } else select({ tile });
          }}
          onSelectLine={(line) => select({ line })}
          onClear={() => select({})}
          creation={{
            ...creation,
            onDropRefused: (tile, tab, target) => {
              const owner = ownership.owners.find((x) => ownerNodeId(x.id) === target);
              if (owner) {
                setExpandedOwners((current) => [...new Set([...current, owner.id])]);
                useProject.getState().setNotice({
                  tone: "error",
                  message: `${owner.name} contains canonical roles. Its roles are now expanded; attach to the intended role.`,
                });
              } else creation.onDropRefused?.(tile, tab, target);
            },
          }}
          removal={{
            ...removal,
            removable: (id) => !id.startsWith("@owner:") && (removal.removable?.(id) ?? true),
          }}
          visibleLines={visibleLines}
          emphasizedTiles={emphasizedTiles?.map((id) => projection.roleToView.get(id) ?? id)}
        />
        {projection.fallbackOwners.length ? (
          <p className="lane-owner-fallback" role="status">
            {projection.fallbackOwners
              .map((id) => ownership.owners.find((x) => x.id === id)?.name ?? id)
              .join(", ")}
            : roles expanded to preserve relationship direction. One logical owner is retained.
          </p>
        ) : null}
        {anchor ? (
          <section className="lane-focus-status" aria-label="Relationship focus">
            <span>
              <strong>{laneNodeName(loaded.design, graph, anchor)}</strong> ·{" "}
              {visibleLines?.length ?? 0} shown · {graph.edges.length - (visibleLines?.length ?? 0)}{" "}
              relationships hidden
            </span>
            <button type="button" onClick={() => board.current?.fit(visibleLines)}>
              Fit focus
            </button>
            <button type="button" onClick={() => setFocusTile(undefined)}>
              Show all
            </button>
          </section>
        ) : null}
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
            <ReadinessReport
              design={loaded.design}
              onTarget={(target) => {
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
                  setFocusTile(undefined);
                } else if (target.connection) select({ line: target.connection });
                else if (target.element) select({ tile: target.element });
              }}
            />
            <OwnershipSummary
              design={loaded.design}
              element={selection.tile}
              connection={selection.line}
              ownerId={selectedOwner?.id}
              expanded={[...expandedOwners, ...projection.fallbackOwners]}
              onConfigure={() => setOwnershipOpen(true)}
              onExpand={(id) => setExpandedOwners((current) => [...new Set([...current, id])])}
              onCollapse={(id) => {
                setExpandedOwners((current) => current.filter((x) => x !== id));
                setPick({});
                setOwnerPick(id);
                setFocusTile(undefined);
              }}
              onRole={(id) => select({ tile: id })}
            />
            <OperationsSummary
              design={loaded.design}
              element={selection.tile}
              connection={selection.line}
              ownerId={selectedOwner?.id}
              selectedBinding={selectedOperation?.id}
              onConfigure={(id) => {
                if (id) setOperationPick(id);
                setOperationsOpen(true);
              }}
            />
            {!selectedOwner && (anchor || selection.tile) ? (
              <RelationshipFocus
                design={loaded.design}
                graph={graph}
                anchor={anchor ?? (selection.tile as string)}
                active={!!anchor}
                selection={selection}
                onFocus={() => setFocusTile(selection.tile)}
                onSelect={select}
                onRemove={(id) => removal.onRemoveLine?.(id)}
              />
            ) : null}
            {!selectedOwner ? (
              <Inspector
                key={selection.tile ?? selection.line ?? LANE_ACTOR}
                loaded={loaded}
                graph={graph}
                selection={selection}
                onSelect={select}
              />
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
  onSelect,
}: {
  loaded: Loaded;
  graph: LaneGraph;
  selection: BoardSelection;
  onSelect: (next: BoardSelection) => void;
}) {
  const { design, project } = loaded;
  const name = (id: string) => laneNodeName(design, graph, id);
  const edge = selection.line ? graph.edges.find((item) => item.id === selection.line) : undefined;
  const action = selection.tile ? laneActionOf(selection.tile) : undefined;
  if (action)
    return (
      <ActionInspector
        projectId={project.id}
        design={design}
        graph={graph}
        lane={action}
        name={name}
        onSelect={onSelect}
      />
    );
  if (selection.tile && selection.tile !== LANE_ACTOR)
    return (
      <TileInspector
        projectId={project.id}
        design={design}
        id={selection.tile}
        name={name(selection.tile)}
        onSelect={onSelect}
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
    const access = studioStoreAccess(design, edge.id);
    const declared = designOwnership(design).dependencies.some(
      (item) => item.connection === edge.id,
    );
    const legacyAccess = access ? (
      <>
        <dl className="lane-facts" aria-label="Inferred relationship access">
          <dt>{design.schemaVersion === 3 ? "Legacy inferred access" : "Access (inferred)"}</dt>
          <dd data-access={access}>{studioStoreAccessLabels[access]}</dd>
        </dl>
        <p className="studio-field-help">
          {design.schemaVersion === 3
            ? "Preserved legacy inference follows the studio writer setting; it declares no grant or dependency request."
            : "Access follows ownership. Owner reads are not distinguished from writes."}
        </p>
      </>
    ) : null;
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
        {legacyAccess && declared ? (
          <details className="studio-legacy-access">
            <summary>Legacy inferred relationship access</summary>
            {legacyAccess}
          </details>
        ) : (
          legacyAccess
        )}
        <ConnectionForm projectId={project.id} connection={edge.id} design={design} />
      </div>
    );
  }
  return (
    <div className="studio-selection-summary">
      <h2>{design.architecture?.system.name ?? project.name}</h2>
      <p className="lane-inspector-kind">System</p>
      <WarningList warnings={studioWarnings(design)} name={name} onSelect={onSelect} />
      <TargetInspector
        projectId={project.id}
        label={project.name}
        design={design}
        onConnection={(line) => onSelect({ line })}
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
  onSelect: (next: BoardSelection) => void;
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
 * A lane action: its name (the word on its tile), its lane (fixed) and its entries, each a
 * button that selects the tile.
 */
function ActionInspector({
  projectId,
  design,
  graph,
  lane,
  name,
  onSelect,
}: {
  projectId: string;
  design: DesignDocument;
  graph: LaneGraph;
  lane: StudioLane;
  name: (id: string) => string;
  onSelect: (next: BoardSelection) => void;
}) {
  const node = laneActionNode(lane);
  const entries = graph.edges.filter((edge) => edge.source === node);
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
      <h3 className="lane-inspector-section">Entries</h3>
      {entries.length ? (
        <ul className="lane-action-entries">
          {entries.map((edge) => {
            const kind = graph.nodes.find((item) => item.id === edge.target)?.kind;
            const visual = kind ? studioDefinitions[kind].visual : undefined;
            return (
              <li key={edge.id}>
                <button
                  type="button"
                  data-family={visual?.color ?? "generic"}
                  onClick={() => onSelect({ tile: edge.target })}
                >
                  <StudioIcon name={visual?.icon} size={18} />
                  {name(edge.target)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="lane-inspector-kind">None yet. Pull its + onto a Service or an API.</p>
      )}
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
  onSelect: (next: BoardSelection) => void;
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
