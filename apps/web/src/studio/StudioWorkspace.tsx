import {
  buildStudioCommand,
  isLegacyStudioDetailKey,
  type StudioRelationship,
  type StudioScopeProjection,
  type StudioSemanticRef,
  type StudioViewNode,
  studioApplicationKinds,
  studioDefinitions,
  studioScopes,
  studioViewKeys,
  studioViews,
} from "@jeeves/spec";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowUpRight,
  IconBoxMultiple,
  IconHandStop,
  IconLayoutSidebarRight,
  IconLibrary,
  IconMessageCircle,
  IconPointer,
  IconSelectAll,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChatPanel } from "../chat/ChatPanel.tsx";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { formDrafts } from "../draw/form-drafts.ts";
import { canRedo, canUndo, useDraw } from "../draw/store.ts";
import { TemplateIcon } from "../draw/TemplateIcon.tsx";
import { type ConnectionDraft, commitAction, connectionDefaults } from "./actions.ts";
import { ConnectionCreator } from "./ConnectionCreator.tsx";
import { ConnectionForm } from "./ConnectionForm.tsx";
import { connectionSpec, type RelationshipTarget } from "./connection-drafts.ts";
import {
  type BaseCreation,
  baseTools,
  type Creation,
  createAt,
  creationLabel,
} from "./creation.ts";
import { DraftFeedback } from "./DraftFeedback.tsx";
import { InspectorForm } from "./InspectorForm.tsx";
import { useStudioPreferences } from "./preferences.ts";
import { studioPaths } from "./routing.ts";
import { StudioGraph } from "./StudioGraph.tsx";
import { StudioLibrary } from "./StudioLibrary.tsx";
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
  onCreate,
  onMember,
  chosenMember,
}: {
  node?: StudioViewNode;
  edge?: StudioRelationship;
  onElement: (id: string) => void;
  onConnection: (id: string) => void;
  onCreate: (draft: ConnectionDraft) => void;
  onMember: (target: RelationshipTarget) => void;
  chosenMember?: RelationshipTarget;
}) {
  const loaded = useDraw((state) => state.loaded);
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
      : targets.find((item) => item.kind === chosenMember?.kind && item.id === chosenMember.id);
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
            onCreate={onCreate}
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
                  onMember(item);
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
        <>
          <ConnectionForm
            key={`${member.kind}:${member.id}`}
            projectId={loaded.project.id}
            target={member}
            design={loaded.design}
          />
          {member.kind === "context" ||
          loaded.design.architecture?.studio?.connections.some(
            (item) => item.connection === member.id,
          ) ? (
            <button
              type="button"
              className="studio-action"
              onClick={() =>
                void commitAction(loaded.project.id, (current) => {
                  if (member.kind === "connection")
                    return buildStudioCommand(current, { type: "delete", connections: [member.id] })
                      .ops;
                  if (!current.architecture) throw new Error("Connection no longer exists.");
                  const architecture = structuredClone(current.architecture);
                  architecture.relationships = architecture.relationships.filter(
                    (item) => item.id !== member.id,
                  );
                  return [{ op: "setArchitecture", architecture }];
                })
              }
            >
              Disconnect
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const refKey = (ref: StudioSemanticRef) => ("id" in ref ? `${ref.kind}:${ref.id}` : ref.kind);
/**
 * Carry a selection across C1/C2/C3 by identity: the same element, context object, package or
 * connection. A component maps to its host application outside C3. No counterpart, no selection.
 */
function carrySelection(
  from: StudioScopeProjection | undefined,
  id: string,
  to: StudioScopeProjection,
): string | undefined {
  if (!from) return undefined;
  const exists = (scope: StudioScopeProjection, value: string) =>
    scope.nodes.some((node) => node.id === value) ||
    scope.edges.some((edge) => edge.id === value) ||
    studioPaths(scope).some((path) => path.id === value);
  if (from.key === to.key) return exists(to, id) ? id : undefined;
  const node = from.nodes.find((item) => item.id === id);
  if (node) {
    if (to.nodes.some((item) => item.id === node.id)) return node.id;
    const refs = new Set(node.refs.map(refKey));
    const match = to.nodes.find((item) => item.refs.some((ref) => refs.has(refKey(ref))));
    if (match) return match.id;
    const host = node.kind === "component" ? node.parent : undefined;
    return host && to.nodes.some((item) => item.id === host) ? host : undefined;
  }
  const edge =
    studioPaths(from).find((path) => path.id === id)?.item ??
    from.edges.find((item) => item.id === id);
  if (!edge) return undefined;
  const ids = new Set([...edge.connectionIds, ...edge.contextRelationshipIds]);
  return to.edges.find((item) =>
    [...item.connectionIds, ...item.contextRelationshipIds].some((value) => ids.has(value)),
  )?.id;
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
  const scopes = useMemo(() => studioScopes(views), [views]);
  const [scopeKey, setScopeKey] = useState(() => {
    const saved =
      new URLSearchParams(window.location.search).get("studioScope") ??
      preferences.scope ??
      studioViewKeys.containers;
    // Old per-service/package detail scopes (URLs, preferences) open the whole-system C3.
    return isLegacyStudioDetailKey(saved) ? studioViewKeys.components : saved;
  });
  const scope = scopes.find((item) => item.key === scopeKey) ?? views.containers;
  // One selection, by identity, shared by all three tabs.
  const [pick, setPick] = useState<{ scope: string; id: string } | undefined>(() => {
    const target = new URLSearchParams(window.location.search).get("studioTarget");
    return target && carrySelection(scope, target, scope)
      ? { scope: scope.key, id: target }
      : undefined;
  });
  const [memberSelection, setMemberSelection] = useState<RelationshipTarget | undefined>(() => {
    const query = new URLSearchParams(window.location.search);
    const id = query.get("studioMember");
    const kind = query.get("studioMemberKind");
    return id && (kind === "connection" || kind === "context") ? { kind, id } : undefined;
  });
  const [hand, setHand] = useState(false);
  const [tool, setTool] = useState<BaseCreation>();
  const [connector, setConnector] = useState<string>();
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>();
  const [connectorError, setConnectorError] = useState<string>();
  const [library, setLibrary] = useState(false);
  const [creating, setCreating] = useState(false);
  const [multiple, setMultiple] = useState(false);
  const [groupSelection, setGroupSelection] = useState<string[]>([]);
  const [grouping, setGrouping] = useState(false);
  const [groupName, setGroupName] = useState("Service package");
  const [groupError, setGroupError] = useState<string>();
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  const selected = useMemo(
    () =>
      pick
        ? carrySelection(
            scopes.find((item) => item.key === pick.scope),
            pick.id,
            scope,
          )
        : undefined,
    [pick, scopes, scope],
  );
  const selectedNode = scope.nodes.find((node) => node.id === selected);
  const pathRelationships = useMemo(() => studioPaths(scope), [scope]);
  const selectedEdge =
    pathRelationships.find((path) => path.id === selected)?.item ??
    scope.edges.find((edge) => edge.id === selected);
  const selectedMember =
    memberSelection &&
    selectedEdge &&
    (memberSelection.kind === "connection"
      ? selectedEdge.connectionIds
      : selectedEdge.contextRelationshipIds
    ).includes(memberSelection.id)
      ? memberSelection
      : undefined;
  // C3 creation has no per-service scope: the selected application (or a selected component's
  // host) owns new queues and resources and is the source of new integrations.
  const c3Owner =
    scope.level === "components" && selectedNode
      ? (() => {
          const node =
            selectedNode.kind === "component"
              ? scope.nodes.find((item) => item.id === selectedNode.parent)
              : selectedNode;
          const ref = node?.refs.find((item) => item.kind === "element");
          return node &&
            ref &&
            "id" in ref &&
            studioApplicationKinds.some((kind) => kind === node.kind)
            ? { id: ref.id, name: node.name }
            : undefined;
        })()
      : undefined;
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

  useEffect(() => {
    setHeaderHost(document.getElementById("studio-header-controls"));
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("studioScope", scope.key);
    if (selected) url.searchParams.set("studioTarget", selected);
    else url.searchParams.delete("studioTarget");
    if (selectedMember) {
      url.searchParams.set("studioMember", selectedMember.id);
      url.searchParams.set("studioMemberKind", selectedMember.kind);
    } else {
      url.searchParams.delete("studioMember");
      url.searchParams.delete("studioMemberKind");
    }
    window.history.replaceState(null, "", url);
    setPreferences((current) =>
      current.scope === scope.key ? current : { ...current, scope: scope.key },
    );
  }, [scope.key, selected, selectedMember, setPreferences]);
  useEffect(() => {
    // Keep the shared store's canonical selection useful to the existing chat; UX13 owns its tools.
    const ids =
      (selectedMember ? [selectedMember.id] : undefined) ??
      selectedNode?.refs.flatMap((ref) => ("id" in ref ? [ref.id] : [])) ??
      selectedEdge?.connectionIds ??
      [];
    useDraw.setState({ architectureSelection: ids });
    return () => {
      useDraw.setState({ architectureSelection: undefined });
    };
  }, [selectedNode, selectedEdge, selectedMember]);

  const navigate = (key?: string) => {
    if (key && scopes.some((item) => item.key === key)) {
      void formDrafts.flushProject(loaded.project.id, true);
      setScopeKey(key);
      setTool(undefined);
      setConnector(undefined);
      setConnectorError(undefined);
      setConnectionDraft(undefined);
      setMultiple(false);
      setGroupSelection([]);
      setLibrary(false);
    }
  };
  const select = (id?: string) => {
    if (connector !== undefined) {
      const node = scope.nodes.find((item) => item.id === id);
      const ref = node?.refs[0];
      if (!ref) return;
      const endpoint =
        ref.kind === "system"
          ? "system"
          : ref.kind === "context" || ref.kind === "element"
            ? ref.id
            : undefined;
      if (!endpoint) {
        setConnectorError(
          node?.kind === "component"
            ? "Choose the application frame, not one of its components."
            : "Choose an application inside the package.",
        );
        return;
      }
      if (!connector) {
        if (
          scope.level !== "context" &&
          ![...studioApplicationKinds, "queue", "cdn", "external-api"].some(
            (kind) => kind === node?.kind,
          )
        ) {
          setConnectorError("Choose an application, queue or integration as the source.");
          return;
        }
        setConnector(endpoint);
        setConnectorError(undefined);
        return;
      }
      try {
        if (scope.level === "context") {
          if (connector === endpoint) throw new Error("Select two different context objects.");
        } else connectionDefaults(loaded.design, connector, endpoint);
        setConnectionDraft({ from: connector, to: endpoint, context: scope.level === "context" });
        setConnectorError(undefined);
      } catch (e) {
        setConnectorError(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    if (multiple && id) {
      setGroupSelection((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      );
    } else if (!id) setGroupSelection([]);
    if (id !== selected) void formDrafts.flushProject(loaded.project.id, true);
    setPick(id ? { scope: scope.key, id } : undefined);
    const node = scope.nodes.find((item) => item.id === id);
    const edge =
      pathRelationships.find((path) => path.id === id)?.item ??
      scope.edges.find((item) => item.id === id);
    const targets: RelationshipTarget[] = edge
      ? [
          ...edge.connectionIds.map((id) => ({ kind: "connection" as const, id })),
          ...edge.contextRelationshipIds.map((id) => ({ kind: "context" as const, id })),
        ]
      : [];
    setMemberSelection(id && targets.length === 1 ? targets[0] : undefined);
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
  const add = async (creation: Creation) => {
    if (creating) return false;
    if (
      creation.type === "base" &&
      scope.level === "components" &&
      c3Owner &&
      creation.kind !== "person" &&
      creation.kind !== "external-system" &&
      studioDefinitions[creation.kind].role === "integration"
    ) {
      setConnectionDraft({ newKind: creation.kind, from: c3Owner.id });
      return true;
    }
    setCreating(true);
    const key = scope.key;
    try {
      const id = await createAt(loaded.project.id, key, creation, c3Owner?.id);
      if (!id) return false;
      if (useDraw.getState().loaded?.project.id === loaded.project.id) {
        setPick({ scope: key, id });
        setPreferences((current) => ({ ...current, inspectorOpen: true }));
        setTool(undefined);
        setMultiple(false);
        setGroupSelection([]);
      }
      return true;
    } finally {
      setCreating(false);
    }
  };
  const groupMembers = groupSelection.flatMap((id) => {
    const node = scope.nodes.find((node) => node.id === id);
    return node && studioApplicationKinds.some((kind) => kind === node.kind)
      ? node.refs.flatMap((ref) => (ref.kind === "element" ? [ref.id] : []))
      : [];
  });
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTool(undefined);
        setConnector(undefined);
        setConnectorError(undefined);
        return;
      }
      // Optional V/H shortcuts mirror the Select and Hand buttons (mouse remains sufficient).
      const key = event.key.toLowerCase();
      if ((key !== "v" && key !== "h") || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      setHand(key === "h");
      setTool(undefined);
      setConnector(undefined);
      setConnectorError(undefined);
      setMultiple(false);
      setGroupSelection([]);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
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
        <button
          type="button"
          aria-current={scope.level === "components" ? "page" : undefined}
          onClick={() => navigate(views.components.key)}
        >
          C3
        </button>
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
            <ChatPanel profile="studio" />
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
          member={selectedMember}
          selectedIds={groupSelection}
          multiple={multiple}
          placing={!!tool && !creating}
          connecting={
            connector === undefined
              ? undefined
              : (scope.nodes.find((node) =>
                  node.refs.some(
                    (ref) =>
                      (ref.kind === "system" ? "system" : "id" in ref ? ref.id : "") === connector,
                  ),
                )?.id ?? "")
          }
          hand={hand}
          camera={preferences.cameras[scope.key]}
          onCamera={(camera) =>
            setPreferences((current) => ({
              ...current,
              cameras: { ...current.cameras, [scope.key]: camera },
            }))
          }
          onSelect={select}
          onPlace={() => {
            if (tool) void add({ type: "base", kind: tool });
          }}
        />
        <div className="studio-tools" role="toolbar" aria-label="Diagram tools">
          <button
            type="button"
            title="Select"
            aria-label="Select"
            aria-pressed={!hand && !tool && !multiple && connector === undefined}
            onClick={() => {
              setHand(false);
              setTool(undefined);
              setConnector(undefined);
              setConnectorError(undefined);
              setMultiple(false);
              setGroupSelection([]);
            }}
          >
            <IconPointer size={19} />
          </button>
          <button
            type="button"
            title="Hand"
            aria-label="Hand"
            aria-pressed={hand}
            onClick={() => {
              setHand(true);
              setTool(undefined);
              setConnector(undefined);
              setConnectorError(undefined);
              setMultiple(false);
              setGroupSelection([]);
            }}
          >
            <IconHandStop size={19} />
          </button>
          {baseTools(scope).map((kind) => (
            <button
              type="button"
              key={kind}
              title={creationLabel(kind)}
              aria-label={creationLabel(kind)}
              aria-pressed={tool === kind}
              disabled={creating}
              onClick={() => {
                setHand(false);
                setMultiple(false);
                setGroupSelection([]);
                setConnector(undefined);
                setConnectorError(undefined);
                setTool(kind);
              }}
            >
              <TemplateIcon
                name={
                  kind === "person"
                    ? "user"
                    : kind === "external-system"
                      ? "world"
                      : studioDefinitions[kind].visual.icon
                }
                size={19}
              />
            </button>
          ))}
          <button
            type="button"
            title="Connection"
            aria-label="Connection"
            aria-pressed={connector !== undefined}
            onClick={() => {
              void formDrafts.flushProject(loaded.project.id, true);
              setConnector("");
              setConnectorError(undefined);
              setTool(undefined);
              setHand(false);
              setMultiple(false);
              setGroupSelection([]);
            }}
          >
            <IconArrowUpRight size={19} />
          </button>
          {
            <button
              type="button"
              title="Select multiple cards"
              aria-label="Select multiple cards"
              aria-pressed={multiple}
              onClick={() => {
                setMultiple((value) => !value);
                setGroupSelection([]);
                setHand(false);
                setTool(undefined);
                setConnector(undefined);
              }}
            >
              <IconSelectAll size={19} />
            </button>
          }
          {scope.level === "containers" &&
          groupMembers.length >= 2 &&
          groupMembers.length === groupSelection.length ? (
            <button
              type="button"
              title="Group as package"
              aria-label="Group as package"
              disabled={creating}
              onClick={() => {
                setGrouping(true);
                setGroupError(undefined);
                setGroupName("Service package");
              }}
            >
              <IconBoxMultiple size={19} />
            </button>
          ) : null}
          <button
            type="button"
            title="Library"
            aria-label="Library"
            disabled={creating}
            onClick={() => {
              setConnector(undefined);
              setLibrary(true);
              setTool(undefined);
              setHand(false);
            }}
          >
            <IconLibrary size={19} />
          </button>
        </div>
        {connector !== undefined ? (
          <div className="studio-placement-hint" role={connectorError ? "alert" : "status"}>
            {connectorError ??
              (connector
                ? "Click a compatible target. Select cancels."
                : "Click the source. Select cancels.")}
          </div>
        ) : null}
        {connectionDraft ? (
          <ConnectionCreator
            key={JSON.stringify(connectionDraft)}
            draft={connectionDraft}
            projectId={loaded.project.id}
            design={loaded.design}
            scope={scope}
            onClose={() => {
              setConnectionDraft(undefined);
              setConnector(undefined);
              setConnectorError(undefined);
            }}
            onConnected={(id) => {
              setConnectionDraft(undefined);
              setConnector(undefined);
              setConnectorError(undefined);
              const current = useDraw.getState().loaded;
              if (!current || current.project.id !== loaded.project.id) return;
              const next = studioViews(current.design, studioDefinitions, current.project.name);
              const target = studioScopes(next).find(
                (item) =>
                  item.key === scope.key &&
                  item.edges.some(
                    (edge) =>
                      edge.connectionIds.includes(id) || edge.contextRelationshipIds.includes(id),
                  ),
              );
              const edge = target?.edges.find(
                (edge) =>
                  edge.connectionIds.includes(id) || edge.contextRelationshipIds.includes(id),
              );
              if (edge && target) {
                setPick({ scope: target.key, id: edge.id });
                setPreferences((value) => ({ ...value, inspectorOpen: true }));
              }
            }}
          />
        ) : null}
        {tool ? (
          <div className="studio-placement-hint" role="status">
            Click the canvas to place {creationLabel(tool)}. Select cancels.
          </div>
        ) : multiple ? (
          <div className="studio-placement-hint" role="status">
            Click cards to select a group. Drag any selected card to move them.
          </div>
        ) : null}
        {library ? (
          <StudioLibrary
            scope={scope}
            busy={creating}
            onAdd={add}
            onClose={() => setLibrary(false)}
            owner={c3Owner}
            onUseExisting={(id) =>
              setConnectionDraft({ ...(c3Owner ? { from: c3Owner.id } : {}), to: id })
            }
            onExisting={(id) => {
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
                setPick({ scope: target.key, id: node.id });
                setPreferences((current) => ({ ...current, inspectorOpen: true }));
              }
            }}
          />
        ) : null}
        {grouping ? (
          <ConfigurationDialog
            title="Group as package"
            size="lg"
            onClose={() => {
              if (!creating) setGrouping(false);
            }}
            footer={
              <div className="studio-library-footer">
                {groupError ? <p role="alert">{groupError}</p> : null}
                <button type="button" disabled={creating} onClick={() => setGrouping(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={creating || !groupName.trim() || groupName.trim().length > 120}
                  onClick={() =>
                    void add({ type: "group", members: groupMembers, name: groupName }).then(
                      (ok) => {
                        if (ok) setGrouping(false);
                        else
                          setGroupError(
                            useDraw.getState().notice?.message ??
                              "Could not group these applications.",
                          );
                      },
                    )
                  }
                >
                  {creating ? "Grouping…" : "Create package"}
                </button>
              </div>
            }
          >
            <label className="studio-form-field">
              Package name
              <input
                value={groupName}
                maxLength={120}
                onChange={(event) => setGroupName(event.currentTarget.value)}
              />
            </label>
            <ul>
              {groupMembers.map((id) => (
                <li key={id}>{loaded.design.elements.find((item) => item.id === id)?.name}</li>
              ))}
            </ul>
            <p>
              Groups these independent applications. No additional runtime, resource or relationship
              is created.
            </p>
          </ConfigurationDialog>
        ) : null}
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
              chosenMember={selectedMember}
              onMember={(target) => {
                if (selected) setMemberSelection(target);
              }}
              node={inspectNode}
              edge={inspectEdge}
              onCreate={setConnectionDraft}
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
                  setPick({ scope: target.key, id: node.id });
                }
              }}
              onConnection={(id) => {
                const target = [scope, ...scopes].find((item) =>
                  item.edges.some((edge) => edge.connectionIds.includes(id)),
                );
                const edge = target?.edges.find((edge) => edge.connectionIds.includes(id));
                if (target && edge) {
                  navigate(target.key);
                  setPick({ scope: target.key, id: edge.id });
                }
              }}
            />
          </aside>
        </>
      ) : null}
    </div>
  );
}
