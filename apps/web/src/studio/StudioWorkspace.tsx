import {
  buildStudioCommand,
  type StudioRelationship,
  type StudioScopeProjection,
  type StudioSemanticRef,
  type StudioViewNode,
  studioApplicationKinds,
  studioDefinitions,
  studioNodeKeys,
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
  IconSquarePlus,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { RailResize } from "../canvas/RailResize.tsx";
import { ChatPanel } from "../chat/ChatPanel.tsx";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { formDrafts } from "../project/form-drafts.ts";
import { canRedo, canUndo, useDraw } from "../project/store.ts";
import { type ConnectionDraft, commitAction, connectionDefaults } from "./actions.ts";
import { ConnectionCreator } from "./ConnectionCreator.tsx";
import { ConnectionForm } from "./ConnectionForm.tsx";
import { connectionSpec, type RelationshipTarget } from "./connection-drafts.ts";
import { type BaseCreation, type Creation, createAt, islandKinds } from "./creation.ts";
import { DraftFeedback } from "./DraftFeedback.tsx";
import { InspectorForm } from "./InspectorForm.tsx";
import { useStudioPreferences } from "./preferences.ts";
import { studioPaths } from "./routing.ts";
import { StudioGraph, type StudioHandleRelease } from "./StudioGraph.tsx";
import { StudioIcon } from "./StudioIcon.tsx";
import { StudioLibrary } from "./StudioLibrary.tsx";
import {
  choicesFor,
  dropConnect,
  type SpawnChoice,
  type SpawnSide,
  spawnChoiceIcon,
  spawnChoiceLabel,
  spawnEndpoint,
  spawnOps,
} from "./spawn.ts";
import "./studio.css";

function SelectionSummary({
  node,
  edge,
  onElement,
  onComponent,
  onConnection,
  onCreate,
  onMember,
  chosenMember,
}: {
  node?: StudioViewNode;
  edge?: StudioRelationship;
  onElement: (id: string) => void;
  onComponent: (id: string) => void;
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
            onComponent={onComponent}
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
            const action = connection?.planned.label ?? context?.description ?? "Connection";
            const protocol = connection?.planned.protocol;
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

const islandChoice = (kind: BaseCreation): SpawnChoice =>
  kind === "person" || kind === "external-system"
    ? { type: "context", kind }
    : { type: "element", kind };
function KindButton({
  choice,
  busy,
  onPick,
}: {
  choice: SpawnChoice;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <button type="button" className="studio-kind" disabled={busy} onClick={onPick}>
      <StudioIcon name={spawnChoiceIcon(choice)} size={17} />
      <span>{spawnChoiceLabel(choice)}</span>
    </button>
  );
}
/** Kind picker: opened where a `+` handle was released, or by New island. */
function KindPicker({
  title,
  at,
  busy,
  choices,
  empty,
  onPick,
  onClose,
}: {
  title: string;
  at?: { x: number; y: number };
  busy: boolean;
  choices: SpawnChoice[];
  empty: string;
  onPick: (choice: SpawnChoice) => void;
  onClose: () => void;
}) {
  const components = choices.filter((choice) => choice.type === "component");
  const boxes = choices.filter((choice) => choice.type !== "component");
  const group = (label: string | undefined, list: SpawnChoice[]) =>
    list.length ? (
      <div className="studio-kind-group">
        {label ? <span className="studio-kind-heading">{label}</span> : null}
        <div className="studio-kind-list">
          {list.map((choice) => (
            <KindButton
              key={`${choice.type}:${choice.kind}`}
              choice={choice}
              busy={busy}
              onPick={() => onPick(choice)}
            />
          ))}
        </div>
      </div>
    ) : null;
  return (
    <>
      <div className="studio-picker-backdrop" aria-hidden="true" onPointerDown={onClose} />
      <div
        className="studio-picker"
        role="dialog"
        aria-label={title}
        data-anchored={at ? true : undefined}
        style={
          at
            ? {
                left: `clamp(8px, ${at.x + 12}px, calc(100% - 288px))`,
                top: `clamp(8px, ${at.y - 24}px, calc(100% - 340px))`,
              }
            : undefined
        }
      >
        <div className="studio-picker-header">
          <strong>{title}</strong>
          <button type="button" aria-label="Close picker" onClick={onClose}>
            <IconX size={15} />
          </button>
        </div>
        {choices.length ? (
          <>
            {group(components.length ? "Component in this application" : undefined, components)}
            {group(components.length ? "Resource or integration" : undefined, boxes)}
          </>
        ) : (
          <p>{empty}</p>
        )}
      </div>
    </>
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
  const scopes = useMemo(() => studioScopes(views), [views]);
  const [scopeKey, setScopeKey] = useState(
    () =>
      new URLSearchParams(window.location.search).get("studioScope") ??
      preferences.scope ??
      studioViewKeys.containers,
  );
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
  // The kind picker after a handle pull, or for a New island / first box.
  const [picker, setPicker] = useState<
    | { type: "spawn"; source: string; side: SpawnSide; at: { x: number; y: number } }
    | { type: "island"; at?: { x: number; y: number } }
  >();
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
    // Keep the shared store's canonical selection useful to the existing chat.
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
      setPicker(undefined);
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
        setMultiple(false);
        setGroupSelection([]);
      }
      return true;
    } finally {
      setCreating(false);
    }
  };
  /** Select the line that carries a just-created relationship and open its connection form. */
  const selectCreated = (key: string, relation: string) => {
    const current = useDraw.getState().loaded;
    if (!current || current.project.id !== loaded.project.id) return;
    const next = studioScopes(studioViews(current.design, studioDefinitions, current.project.name));
    const target = next.find((item) => item.key === key);
    const carries = (edge: StudioRelationship) =>
      edge.connectionIds.includes(relation) ||
      edge.contextRelationshipIds.includes(relation) ||
      edge.componentRelationshipIds.includes(relation);
    const edge =
      (target && studioPaths(target).find((path) => carries(path.item))?.item) ??
      target?.edges.find(carries);
    if (!target || !edge) return;
    setPick({ scope: key, id: edge.id });
    const member: RelationshipTarget | undefined = edge.connectionIds.includes(relation)
      ? { kind: "connection", id: relation }
      : edge.contextRelationshipIds.includes(relation)
        ? { kind: "context", id: relation }
        : edge.connectionIds.length === 1 && edge.connectionIds[0]
          ? { kind: "connection", id: edge.connectionIds[0] }
          : undefined;
    setMemberSelection(member);
    setPreferences((value) => ({ ...value, inspectorOpen: true }));
  };
  const spawnable = (id: string) =>
    !!spawnEndpoint(
      loaded.design,
      scope,
      scope.nodes.find((node) => node.id === id),
    );
  const handleRelease = (release: StudioHandleRelease) => {
    const source = spawnEndpoint(
      loaded.design,
      scope,
      scope.nodes.find((node) => node.id === release.source),
    );
    if (!source) return;
    void formDrafts.flushProject(loaded.project.id, true);
    if (!release.target) {
      setPicker({ type: "spawn", source: release.source, side: release.side, at: release.at });
      return;
    }
    const targetNode = scope.nodes.find((node) => node.id === release.target);
    const target = spawnEndpoint(loaded.design, scope, targetNode);
    try {
      if (!target)
        throw new Error(
          targetNode?.kind === "package"
            ? "Drop on an application inside the package."
            : "That box cannot be connected here.",
        );
      const result = dropConnect(scope.level, source, release.side, target);
      if (result.type === "draft") {
        setConnectionDraft(result.draft);
        return;
      }
      const key = scope.key;
      setCreating(true);
      void commitAction(loaded.project.id, result.rebuild)
        .then((ok) => {
          if (ok) selectCreated(key, result.relation);
        })
        .finally(() => setCreating(false));
    } catch (e) {
      useDraw
        .getState()
        .setNotice({ tone: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };
  /** One batch: the new box plus its relationship (one undo step), then its connection form. */
  const spawn = async (sourceId: string, side: SpawnSide, choice: SpawnChoice) => {
    const source = spawnEndpoint(
      loaded.design,
      scope,
      scope.nodes.find((node) => node.id === sourceId),
    );
    if (!source || creating) return;
    setCreating(true);
    const key = scope.key;
    let result: ReturnType<typeof spawnOps> | undefined;
    try {
      const ok = await useDraw.getState().createPlaced(loaded.project.id, (design) => {
        result = spawnOps(design, scope.level, loaded.project.name, source, side, choice);
        return result.ops;
      });
      setPicker(undefined);
      // An in-process component link has no connection form: select the new component instead.
      if (ok && result && choice.type === "component") {
        setPick({ scope: key, id: result.node });
        setPreferences((value) => ({ ...value, inspectorOpen: true }));
      } else if (ok && result) selectCreated(key, result.relation);
    } finally {
      setCreating(false);
    }
  };
  /** New island / first box: one unconnected box; automatic layout packs it as an island. */
  const island = async (kind: BaseCreation) => {
    if (creating) return;
    setCreating(true);
    const key = scope.key;
    try {
      const id = await createAt(
        loaded.project.id,
        key,
        { type: "base", kind },
        kind === "queue" ? c3Owner?.id : undefined,
      );
      setPicker(undefined);
      if (id && useDraw.getState().loaded?.project.id === loaded.project.id) {
        setPick({ scope: key, id });
        setPreferences((current) => ({ ...current, inspectorOpen: true }));
      }
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
        setPicker(undefined);
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
      setPicker(undefined);
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
          member={selectedMember}
          selectedIds={groupSelection}
          multiple={multiple}
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
          spawnable={spawnable}
          onHandle={handleRelease}
        />
        <div className="studio-tools" role="toolbar" aria-label="Diagram tools">
          <button
            type="button"
            title="Select"
            aria-label="Select"
            aria-pressed={!hand && !multiple && connector === undefined}
            onClick={() => {
              setHand(false);
              setPicker(undefined);
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
              setPicker(undefined);
              setConnector(undefined);
              setConnectorError(undefined);
              setMultiple(false);
              setGroupSelection([]);
            }}
          >
            <IconHandStop size={19} />
          </button>
          <button
            type="button"
            title="New island"
            aria-label="New island"
            aria-pressed={picker?.type === "island"}
            disabled={creating}
            onClick={() => {
              setHand(false);
              setMultiple(false);
              setGroupSelection([]);
              setConnector(undefined);
              setConnectorError(undefined);
              setPicker(picker?.type === "island" ? undefined : { type: "island" });
            }}
          >
            <IconSquarePlus size={19} />
          </button>
          <button
            type="button"
            title="Connection"
            aria-label="Connection"
            aria-pressed={connector !== undefined}
            onClick={() => {
              void formDrafts.flushProject(loaded.project.id, true);
              setConnector("");
              setConnectorError(undefined);
              setPicker(undefined);
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
                setPicker(undefined);
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
              setPicker(undefined);
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
        {picker ? (
          <KindPicker
            title={
              picker.type === "island"
                ? "New island"
                : picker.side === "out"
                  ? `After ${scope.nodes.find((node) => node.id === picker.source)?.name ?? "box"}`
                  : `Before ${scope.nodes.find((node) => node.id === picker.source)?.name ?? "box"}`
            }
            at={picker.at}
            busy={creating}
            choices={
              picker.type === "island"
                ? islandKinds(scope, c3Owner?.id).map(islandChoice)
                : (() => {
                    const source = spawnEndpoint(
                      loaded.design,
                      scope,
                      scope.nodes.find((node) => node.id === picker.source),
                    );
                    return source ? choicesFor(scope, source, picker.side) : [];
                  })()
            }
            empty={
              picker.type === "island"
                ? "Nothing can be added here."
                : "No new box fits on this side. Drop the handle on a box to connect them."
            }
            onPick={(choice) => {
              if (picker.type === "island")
                void island(choice.type === "component" ? "service" : choice.kind);
              else void spawn(picker.source, picker.side, choice);
            }}
            onClose={() => setPicker(undefined)}
          />
        ) : !scope.nodes.length ? (
          <section className="studio-empty" aria-label="Add a first box">
            <strong>Start with a first box</strong>
            <span>Then drag its + handles to add connected boxes.</span>
            <div className="studio-kind-list">
              {islandKinds(scope, c3Owner?.id).map((kind) => (
                <KindButton
                  key={kind}
                  choice={islandChoice(kind)}
                  busy={creating}
                  onPick={() => void island(kind)}
                />
              ))}
            </div>
          </section>
        ) : null}
        {multiple ? (
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
              onComponent={(id) => {
                void formDrafts.flushProject(loaded.project.id, true);
                navigate(views.components.key);
                setPick({ scope: views.components.key, id: studioNodeKeys.component(id) });
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
