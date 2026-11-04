import {
  type StudioRelationship,
  type StudioViewNode,
  studioDefinitions,
  studioViewKeys,
  studioViews,
} from "@jeeves/spec";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconChevronLeft,
  IconHandStop,
  IconLayoutSidebarRight,
  IconMessageCircle,
  IconPointer,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChatPanel } from "../chat/ChatPanel.tsx";
import { formDrafts } from "../draw/form-drafts.ts";
import { canRedo, canUndo, useDraw } from "../draw/store.ts";
import { ConnectionForm } from "./ConnectionForm.tsx";
import { connectionSpec, type RelationshipTarget } from "./connection-drafts.ts";
import { DraftFeedback } from "./DraftFeedback.tsx";
import { InspectorForm } from "./InspectorForm.tsx";
import { useStudioPreferences } from "./preferences.ts";
import { StudioGraph } from "./StudioGraph.tsx";
import "./studio.css";

function RailResize({
  side,
  value,
  onChange,
}: {
  side: "chat" | "inspector";
  value: number;
  onChange: (width: number) => void;
}) {
  return (
    <hr
      className="studio-rail-resize"
      tabIndex={0}
      aria-label={`${side === "chat" ? "Chat" : "Inspector"} width`}
      aria-orientation="vertical"
      aria-valuenow={value}
      aria-valuemin={240}
      aria-valuemax={400}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onChange(
          Math.max(
            240,
            Math.min(
              400,
              value + (event.key === "ArrowRight" ? 16 : -16) * (side === "chat" ? 1 : -1),
            ),
          ),
        );
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.dataset.start = `${event.clientX}:${value}`;
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const [start = 0, initial = value] = (event.currentTarget.dataset.start ?? "")
          .split(":")
          .map(Number);
        onChange(
          Math.max(
            240,
            Math.min(400, initial + (event.clientX - start) * (side === "chat" ? 1 : -1)),
          ),
        );
      }}
      onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
    />
  );
}

function SelectionSummary({
  node,
  edge,
  onElement,
  onConnection,
}: {
  node?: StudioViewNode;
  edge?: StudioRelationship;
  onElement: (id: string) => void;
  onConnection: (id: string) => void;
}) {
  const loaded = useDraw((state) => state.loaded);
  const [memberId, setMemberId] = useState<string>();
  const targets: RelationshipTarget[] = edge
    ? [
        ...[...new Set(edge.connectionIds)].map((id) => ({ kind: "connection" as const, id })),
        ...[...new Set(edge.contextRelationshipIds)].map((id) => ({
          kind: "context" as const,
          id,
        })),
      ]
    : [];
  const member =
    targets.length === 1
      ? targets[0]
      : targets.find((item) => `${item.kind}:${item.id}` === memberId);
  const single = targets.length === 1 ? targets[0] : undefined;
  const relation =
    single &&
    (single.kind === "connection"
      ? loaded?.design.connections.find((item) => item.id === single.id)
      : loaded?.design.architecture?.relationships.find((item) => item.id === single.id));
  const endpointName = (id: string) =>
    loaded?.design.elements.find((item) => item.id === id)?.name ??
    loaded?.design.architecture?.nodes.find((item) => item.id === id)?.name ??
    (id === "system" ? loaded?.design.architecture?.system.name : undefined);
  if (node)
    return (
      <div className="studio-selection-summary">
        <h2>{node.name}</h2>
        {loaded ? (
          <InspectorForm
            projectId={loaded.project.id}
            node={node}
            design={loaded.design}
            onElement={onElement}
            onConnection={onConnection}
          />
        ) : null}
      </div>
    );
  if (!edge) return null;
  return (
    <div className="studio-selection-summary">
      <h2>Connection</h2>
      {relation ? (
        <p>
          {endpointName(typeof relation.from === "string" ? relation.from : relation.from.element)}{" "}
          → {endpointName(typeof relation.to === "string" ? relation.to : relation.to.element)}
        </p>
      ) : null}
      {targets.length > 1 ? (
        <fieldset className="studio-members" aria-label="Connection members">
          <legend>Select a connection</legend>
          {targets.map((item) => {
            const connection = loaded?.design.connections.find(
              (connection) => connection.id === item.id,
            );
            const context = loaded?.design.architecture?.relationships.find(
              (relation) => relation.id === item.id,
            );
            const name = (id?: string) =>
              loaded?.design.elements.find((element) => element.id === id)?.name ?? id;
            const action =
              connection?.planned?.label ??
              connection?.label ??
              context?.description ??
              "Connection";
            const protocol = connection?.planned?.protocol ?? connection?.protocol;
            return (
              <button
                type="button"
                key={`${item.kind}:${item.id}`}
                aria-pressed={member?.id === item.id && member.kind === item.kind}
                onClick={() => {
                  if (loaded) void formDrafts.flushProject(loaded.project.id, true);
                  setMemberId(`${item.kind}:${item.id}`);
                }}
              >
                {connection
                  ? `${name(connection.from.element)} → ${name(connection.to.element)}`
                  : action}
                <span>
                  {action}
                  {protocol ? ` · ${protocol}` : ""}
                </span>
              </button>
            );
          })}
        </fieldset>
      ) : null}
      {member && loaded ? (
        <ConnectionForm
          key={`${member.kind}:${member.id}`}
          projectId={loaded.project.id}
          target={member}
          design={loaded.design}
        />
      ) : null}
    </div>
  );
}

export function StudioWorkspace() {
  const loaded = useDraw((state) => state.loaded);
  if (!loaded) return null;
  return <ProjectStudio key={loaded.project.id} loaded={loaded} />;
}

function ProjectStudio({
  loaded,
}: {
  loaded: NonNullable<ReturnType<typeof useDraw.getState>["loaded"]>;
}) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const hasDraft = formDrafts
    .forProject(loaded.project.id)
    .some(
      (entry) =>
        entry.flight || (entry.paths.size && !entry.problem && !Object.keys(entry.errors).length),
    );
  const historyBusy = useDraw((state) => state.historyBusy);
  const failed = formDrafts.hasProblems(loaded.project.id);
  const undoable = useDraw(canUndo);
  const redoable = useDraw(canRedo);
  const notice = useDraw((state) => state.notice);
  const [preferences, setPreferences] = useStudioPreferences(loaded.project.id);
  const views = useMemo(
    () => studioViews(loaded.design, studioDefinitions, loaded.project.name),
    [loaded.design, loaded.project.name],
  );
  const scopes = useMemo(() => [views.context, views.containers, ...views.details], [views]);
  const [scopeKey, setScopeKey] = useState(
    () =>
      new URLSearchParams(window.location.search).get("studioScope") ??
      preferences.scope ??
      studioViewKeys.containers,
  );
  const scope = scopes.find((item) => item.key === scopeKey) ?? views.containers;
  const [selections, setSelections] = useState<Record<string, string | undefined>>({});
  const [hand, setHand] = useState(false);
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  const selected = selections[scope.key];
  const selectedNode = scope.nodes.find((node) => node.id === selected);
  const selectedEdge = scope.edges.find((edge) => edge.id === selected);
  // Unknown and purely source-only legacy relationships select without opening an empty inspector.
  const inspectNode = selectedNode;
  const inspectEdge =
    selectedEdge &&
    (selectedEdge.contextRelationshipIds.some((id) =>
      connectionSpec(loaded.project.id, { kind: "context", id }, loaded.design),
    ) ||
      selectedEdge.connectionIds.some((id) =>
        connectionSpec(loaded.project.id, { kind: "connection", id }, loaded.design),
      ))
      ? selectedEdge
      : undefined;
  const inspectable = !!(inspectNode || inspectEdge);
  const inspectorOpen = preferences.inspectorOpen && inspectable;
  const expandable =
    selectedNode?.drillKey && scopes.find((item) => item.key === selectedNode.drillKey);

  useEffect(() => {
    setHeaderHost(document.getElementById("studio-header-controls"));
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("studioScope", scope.key);
    window.history.replaceState(null, "", url);
    setPreferences((current) =>
      current.scope === scope.key ? current : { ...current, scope: scope.key },
    );
  }, [scope.key, setPreferences]);
  useEffect(() => {
    // Keep the shared store's canonical selection useful to the existing chat; UX13 owns its tools.
    const ids =
      selectedNode?.refs.flatMap((ref) => ("id" in ref ? [ref.id] : [])) ??
      selectedEdge?.connectionIds ??
      [];
    useDraw.setState({ architectureSelection: ids });
    return () => {
      useDraw.setState({ architectureSelection: undefined });
    };
  }, [selectedNode, selectedEdge]);

  const navigate = (key?: string) => {
    if (key && scopes.some((item) => item.key === key)) {
      void formDrafts.flushProject(loaded.project.id, true);
      setScopeKey(key);
    }
  };
  const select = (id?: string) => {
    if (id !== selected) void formDrafts.flushProject(loaded.project.id, true);
    setSelections((current) => ({ ...current, [scope.key]: id }));
    const node = scope.nodes.find((item) => item.id === id);
    const edge = scope.edges.find((item) => item.id === id);
    if (
      (node && node.kind !== "generic") ||
      edge?.contextRelationshipIds.some((id) =>
        connectionSpec(loaded.project.id, { kind: "context", id }, loaded.design),
      ) ||
      edge?.connectionIds.some((id) =>
        connectionSpec(loaded.project.id, { kind: "connection", id }, loaded.design),
      )
    ) {
      setPreferences((current) => ({ ...current, inspectorOpen: true }));
    }
  };
  const toggle = (rail: "chatOpen" | "inspectorOpen") => {
    if (rail === "inspectorOpen") void formDrafts.flushProject(loaded.project.id, true);
    setPreferences((current) => ({ ...current, [rail]: !current[rail] }));
  };
  const goBack = () => navigate(scope.parentKey);
  const header = (
    <>
      <nav className="studio-depth" aria-label="Architecture depth">
        <button
          type="button"
          aria-current={scope.level === "context" ? "page" : undefined}
          onClick={() => navigate(views.context.key)}
        >
          C1
        </button>
        <button
          type="button"
          aria-current={scope.level === "containers" ? "page" : undefined}
          onClick={() => navigate(views.containers.key)}
        >
          C2
        </button>
        {scope.level === "detail" ? (
          <nav className="studio-breadcrumb" aria-label="Detail breadcrumb">
            <button
              type="button"
              title="Back to parent scope"
              aria-label="Back to parent scope"
              onClick={goBack}
            >
              <IconChevronLeft size={16} />
            </button>
            {scope.breadcrumb
              .filter((item) => item.key !== views.containers.key)
              .map((item) =>
                item.key === scope.key ? (
                  <span key={item.key} aria-current="page" title={item.name}>
                    C3 · {item.name}
                  </span>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    title={item.name}
                    onClick={() => navigate(item.key)}
                  >
                    {item.name}
                  </button>
                ),
              )}
          </nav>
        ) : expandable ? (
          <button
            type="button"
            title={`Open ${expandable.name}`}
            onClick={() => navigate(expandable.key)}
          >
            C3
          </button>
        ) : null}
      </nav>
      <div className="studio-header-actions">
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
          title={inspectorOpen ? "Collapse inspector" : "Open inspector"}
          aria-label={inspectorOpen ? "Collapse inspector" : "Open inspector"}
          aria-pressed={inspectorOpen}
          disabled={!inspectable}
          onClick={() => toggle("inspectorOpen")}
        >
          <IconLayoutSidebarRight size={18} />
        </button>
      </div>
    </>
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
        <StudioGraph
          key={scope.key}
          scope={scope}
          selection={selected}
          hand={hand}
          camera={preferences.cameras[scope.key]}
          onCamera={(camera) =>
            setPreferences((current) => ({
              ...current,
              cameras: { ...current.cameras, [scope.key]: camera },
            }))
          }
          onSelect={select}
          onOpen={navigate}
        />
        <div className="studio-tools" role="toolbar" aria-label="Diagram tools">
          <button
            type="button"
            title="Select"
            aria-label="Select"
            aria-pressed={!hand}
            onClick={() => setHand(false)}
          >
            <IconPointer size={19} />
          </button>
          <button
            type="button"
            title="Hand"
            aria-label="Hand"
            aria-pressed={hand}
            onClick={() => setHand(true)}
          >
            <IconHandStop size={19} />
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
        <DraftFeedback projectId={loaded.project.id} />
      </div>
      {inspectorOpen ? (
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
            <SelectionSummary
              key={selected}
              node={inspectNode}
              edge={inspectEdge}
              onElement={(id) => {
                const target = [scope, ...scopes].find((item) =>
                  item.nodes.some((node) =>
                    node.refs.some((ref) => ref.kind === "element" && ref.id === id),
                  ),
                );
                const node = target?.nodes.find((node) =>
                  node.refs.some((ref) => ref.kind === "element" && ref.id === id),
                );
                if (target && node) {
                  navigate(target.key);
                  setSelections((current) => ({ ...current, [target.key]: node.id }));
                }
              }}
              onConnection={(id) => {
                const target = [scope, ...scopes].find((item) =>
                  item.edges.some((edge) => edge.connectionIds.includes(id)),
                );
                const edge = target?.edges.find((edge) => edge.connectionIds.includes(id));
                if (target && edge) {
                  navigate(target.key);
                  setSelections((current) => ({ ...current, [target.key]: edge.id }));
                }
              }}
            />
          </aside>
        </>
      ) : null}
    </div>
  );
}
