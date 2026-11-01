import {
  type ArchitectureComponent,
  type ArchitectureEvidence,
  type ArchitectureMember,
  type ArchitectureViews,
  componentPresentation,
  contractKey,
  focusedArchitectureView,
  hasLocalDeploymentView,
  type ReviewFinding,
  reviewArchitecture,
} from "@jeeves/spec";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  NativeSelect,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBook,
  IconDots,
  IconLayoutSidebarLeftCollapse,
  IconMessageCircle,
  IconX,
} from "@tabler/icons-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ApiSelection, ApiWorkspace } from "../api-reference/ApiWorkspace.tsx";
import { ApiPreviewProvider } from "../api-reference/preview.tsx";
import { ChatPanel } from "../chat/ChatPanel.tsx";
import { api } from "../draw/api.ts";
import { FindingsPanel } from "../draw/inspector/FindingsPanel.tsx";
import { ConnectionInspector, ElementInspector, Inspector } from "../draw/inspector/Inspector.tsx";
import { ExecutionPolicySummary } from "../draw/inspector/LocalExecutionEditor.tsx";
import { LocalHttpPoolSummary } from "../draw/inspector/LocalHttpPoolEditor.tsx";
import { ProjectChooser } from "../draw/ProjectChooser.tsx";
import { canRedo, canUndo, useDraw } from "../draw/store.ts";
import { GenerateDrawer } from "../generate/GenerateDrawer.tsx";
import { useGenerate } from "../generate/store.ts";
import { ArchitectureData } from "./ArchitectureData.tsx";
import { ArchitectureDeployments } from "./ArchitectureDeployments.tsx";
import { ContextEditor, ProductConfiguration } from "./ArchitectureEditors.tsx";
import { ArchitectureEvidenceDialog } from "./ArchitectureEvidence.tsx";
import { ArchitectureGraph } from "./ArchitectureGraph.tsx";
import { ArchitectureHandoff } from "./ArchitectureHandoff.tsx";
import { ArchitectureOutline } from "./ArchitectureOutline.tsx";
import { ArchitectureReview } from "./ArchitectureReview.tsx";
import { AnnotationDraft, TargetComparison } from "./ArchitectureTargets.tsx";
import { CapabilityCatalog } from "./CapabilityCatalog.tsx";
import { ComponentDetails } from "./ComponentDetails.tsx";
import { ContainerEditor, ContainerRelationshipEditor } from "./ContainerEditor.tsx";
import { FocusedViews } from "./FocusedViews.tsx";
import { InterfaceEditor, InterfaceSummary } from "./InterfaceEditor.tsx";
import { PatternComposer } from "./PatternComposer.tsx";
import { BindingSummary, RelationshipBindings } from "./RelationshipBindings.tsx";
import "./contracts.css";
import { ComponentEditor } from "./ComponentEditor.tsx";
import { ComponentRelationshipEditor } from "./ComponentRelationshipEditor.tsx";
import { ContextInspector } from "./ContextInspector.tsx";
import { EditorDraftProvider } from "./editor-drafts.tsx";
import { LocalDeploymentDialog } from "./LocalDeployment.tsx";
import { PlannedConnectionInspector, PlannedElementInspector } from "./PlannedInspector.tsx";
import "./architecture.css";
import "./editor.css";
import { RelationshipLegend } from "./RelationshipLabel.tsx";
import { ScenarioMenuItems, ScenarioPanel, ScenarioProvider } from "./Scenarios.tsx";
import { TypeLegend } from "./type-style.tsx";

type Level = "context" | "containers" | "components";
export function ArchitectureWorkspace({ board }: { board: ReactNode }) {
  return (
    <EditorDraftProvider>
      <ApiPreviewProvider>
        <EditorWorkspace board={board} />
      </ApiPreviewProvider>
    </EditorDraftProvider>
  );
}
function EditorWorkspace({ board }: { board: ReactNode }) {
  const loaded = useDraw((state) => state.loaded)!;
  const notice = useDraw((state) => state.notice);
  const boardSelection = useDraw((state) => state.selection);
  const layoutUndoable = useDraw((state) => state.architectureUndo.length > 0);
  const layoutRedoable = useDraw((state) => state.architectureRedo.length > 0);
  const tool = useDraw((state) => state.tool.kind);
  const undoable = useDraw(canUndo),
    redoable = useDraw(canRedo);
  const [views, setViews] = useState<ArchitectureViews>();
  const [evidence, setEvidence] = useState<ArchitectureEvidence>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const generationState = useGenerate((state) =>
    state.projectId === loaded.project.id
      ? `${state.generation?.id}:${state.generation?.status}`
      : "",
  );
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [targetTab, setTargetTab] = useState<"baseline" | "changes">();
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [reviewEditor, setReviewEditor] = useState<Pick<ReviewFinding, "editor" | "inputs">>();
  const [reviewPattern, setReviewPattern] = useState<string>();
  const [apiSelection, setApiSelection] = useState<ApiSelection>({});
  const openApi = (selection: ApiSelection) => {
    setApiSelection(selection);
    setApiOpen(true);
  };
  const [deployment, setDeployment] = useState<{ element?: string }>();
  const [deploymentPlans, setDeploymentPlans] = useState(false);
  const [focusedView, setFocusedView] = useState(
    () => new URLSearchParams(window.location.search).get("view") ?? "",
  );
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const layoutViews = loaded.layout.architecture;
  const focused = focusedView ? layoutViews?.[focusedView] : undefined;
  const [level, setLevel] = useState<Level>(() => {
    const value = new URLSearchParams(window.location.search).get("level");
    return value === "context" || value === "components" ? value : "containers";
  });
  const [focusRequest, setFocusRequest] = useState(0);
  const [boardMode, setBoardMode] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(() => window.innerWidth >= 1100);
  const [containerEditor, setContainerEditor] = useState<string>();
  const [containerRelationship, setContainerRelationship] = useState(false);
  const overview = level === "containers" && !focused && boardMode;
  const navigationRequest = useRef(0);
  const [container, setContainer] = useState<string | undefined>(
    () => new URLSearchParams(window.location.search).get("container") ?? undefined,
  );
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<"context" | "product">();
  const [catalog, setCatalog] = useState<"containers" | "components" | "examples" | "patterns">();
  const [starterOpen, setStarterOpen] = useState(false);
  const [componentEditor, setComponentEditor] = useState<{
    initial?: ArchitectureComponent;
    capability?: string;
    members?: ArchitectureMember[];
  }>();
  const [relationshipEditor, setRelationshipEditor] = useState<{ id?: string }>();
  const [chatOpen, setChatOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [findingsOpen, setFindingsOpen] = useState(false);
  const [inspectorViews, setInspectorViews] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (boardSelection.nodes.length || boardSelection.edges.length)
      setInspectorViews((current) => ({ ...current, containers: true }));
  }, [boardSelection]);
  const railTab = useDraw((state) => state.railTab);
  const setRailTab = useDraw((state) => state.setRailTab);
  useEffect(() => {
    if (railTab === "chat") {
      setChatOpen(true);
      setRailTab("inspector");
    } else if (railTab === "findings") {
      setFindingsOpen(true);
      setRailTab("inspector");
    }
  }, [railTab, setRailTab]);
  const request = useRef<{ key: string; pending: ReturnType<typeof api.architecture> } | undefined>(
    undefined,
  );
  const { project, design } = loaded;
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("level", level);
    if (container && level === "components") url.searchParams.set("container", container);
    else url.searchParams.delete("container");
    if (focusedView && level === "containers") url.searchParams.set("view", focusedView);
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  }, [level, container, focusedView]);
  const reviewReport = useMemo(() => reviewArchitecture(design), [design]);
  const reviewBinding = design.architecture?.bindings?.find(
    (b) => b.id === reviewEditor?.inputs.find((r) => r.kind === "binding")?.id,
  );
  const reviewContract = reviewEditor?.inputs.find((r) => r.kind === "contract")?.id;
  const reviewInterface = design.architecture?.interfaces?.find(
    (i) =>
      i.id === reviewEditor?.inputs.find((r) => r.kind === "interface")?.id ||
      (!!reviewContract && contractKey(i.contract) === reviewContract),
  );
  useEffect(() => {
    let active = true;
    const key = `${project.id}:${design.revision}:${attempt}:${generationState}`;
    setLoading(true);
    setError(undefined);
    if (request.current?.key !== key)
      request.current = { key, pending: api.architecture(project.id) };
    request.current.pending.then(
      (result) => {
        if (!active) return;
        if (result.revision === design.revision) {
          setViews(result.views);
          setEvidence(result.evidence);
        } else
          setError(
            "The design changed elsewhere. Reload this project to review the current version.",
          );
        setLoading(false);
      },
      (error) => {
        if (active) {
          setError(error instanceof Error ? error.message : String(error));
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [project.id, design.revision, attempt, generationState]);
  const sourceProjection =
    level === "context"
      ? views?.context
      : level === "containers"
        ? views?.containers
        : (views?.components.find((view) => view.container === container) ?? views?.components[0]);
  const focusedProjection = useMemo(
    () =>
      sourceProjection && focused && level === "containers"
        ? focusedArchitectureView(sourceProjection, focused)
        : undefined,
    [sourceProjection, focused, level],
  );
  const projection = useMemo(
    () =>
      focusedProjection?.projection ??
      (sourceProjection ? componentPresentation(sourceProjection, showTechnical) : undefined),
    [sourceProjection, focusedProjection, showTechnical],
  );
  const scope =
    level === "components"
      ? `components:${projection?.container}`
      : level === "containers" && focused
        ? focusedView
        : level;
  const selected =
    level === "containers"
      ? boardSelection.edges[0]
        ? boardSelection.edges[0].startsWith("context:")
          ? boardSelection.edges[0]
          : `connection:${boardSelection.edges[0]}`
        : boardSelection.nodes[0]
          ? boardSelection.nodes[0].startsWith("context:")
            ? boardSelection.nodes[0]
            : `container:${boardSelection.nodes[0]}`
          : undefined
      : selections[scope];
  const inspectorOpen = inspectorViews[scope] ?? Boolean(selected);
  const setInspectorOpen = useCallback(
    (open: boolean) => setInspectorViews((current) => ({ ...current, [scope]: open })),
    [scope],
  );
  const edge = projection?.edges.find((item) => item.id === selected);
  const node = edge ? undefined : projection?.nodes.find((item) => item.id === selected);
  const choose = useCallback(
    (id: string) => {
      setSelections((current) => ({ ...current, [scope]: id }));
      setInspectorOpen(Boolean(id));
      setRailTab("inspector");
      if (level === "containers")
        useDraw
          .getState()
          .setSelection(
            id.startsWith("container:")
              ? { nodes: [id.slice(10)], edges: [] }
              : id.startsWith("connection:")
                ? { nodes: [], edges: [id.slice(11)] }
                : projection?.edges.some((edge) => edge.id === id)
                  ? { nodes: [], edges: [id] }
                  : { nodes: id ? [id] : [], edges: [] },
          );
    },
    [scope, level, projection, setRailTab, setInspectorOpen],
  );
  const currentEvidence = evidence?.revision === design.revision ? evidence : undefined;
  const changeLevel = async (next: Level) => {
    const navigation = ++navigationRequest.current;
    if (next === level) return;
    if (level === "containers") await useDraw.getState().flushLayout();
    // A newer tab click wins even while an earlier one is saving the board camera.
    if (navigation !== navigationRequest.current) return;
    useDraw.getState().setTool({ kind: "select" });
    setLevel(next);
  };
  const openComponents = (id: string, component?: string) => {
    if (window.innerWidth < 1100) setExplorerOpen(false);
    setContainer(id);
    if (component) {
      setFocusRequest((value) => value + 1);
      setSelections((current) => ({ ...current, [`components:${id}`]: component }));
      setInspectorViews((current) => ({ ...current, [`components:${id}`]: true }));
    }
    void changeLevel("components");
  };
  const openContainer = (id?: string) => {
    if (window.innerWidth < 1100) setExplorerOpen(false);
    setFocusedView("");
    setBoardMode(false);
    if (id) setFocusRequest((value) => value + 1);
    if (id) useDraw.getState().focus({ nodes: [id], edges: [] });
    setInspectorViews((current) => ({ ...current, containers: true }));
    setRailTab("inspector");
    void changeLevel("containers");
  };
  useEffect(() => {
    useDraw.setState({
      architectureSelection:
        level === "containers"
          ? undefined
          : node?.binding
            ? [
                node.binding.extension ??
                  node.binding.resource ??
                  node.binding.attachment ??
                  node.binding.element,
              ]
            : edge?.connection
              ? [edge.connection]
              : [],
    });
    return () => {
      useDraw.setState({ architectureSelection: undefined });
    };
  }, [level, node?.binding, edge?.connection]);
  const selectedConnection = design.connections.find((item) => item.id === edge?.connection);
  const selectedElement = design.elements.find((item) => item.id === node?.binding?.element);
  const definition = design.architecture?.components?.find(
    (item) => item.id === node?.binding?.component,
  );
  const actualContainer = projection?.container;
  const declaredComponents =
    design.architecture?.components?.filter((item) => item.element === actualContainer) ?? [];
  const boardElement = design.elements.find((element) => element.id === boardSelection.nodes[0]);
  const place = (id: string) => {
    setCatalog(undefined);
    setContainerEditor(id);
  };
  const workspace = (
    <section
      className="architecture-workspace integrated-editor"
      aria-label="Architecture workspace"
      data-chat-open={chatOpen}
      data-selection={selected ?? ""}
      data-inspector-open={inspectorOpen}
    >
      {handoffOpen ? (
        <ArchitectureHandoff
          projection={projection}
          view={scope}
          onClose={() => setHandoffOpen(false)}
        />
      ) : null}
      <header className="editor-header">
        <ApiWorkspace
          opened={apiOpen}
          selection={apiSelection}
          onSelect={setApiSelection}
          onClose={() => setApiOpen(false)}
        />
        <Group gap={4} className="editor-menu-actions">
          <Menu position="bottom-start" shadow="md">
            <Menu.Target>
              <ActionIcon variant="default" aria-label="Editor actions" size="lg">
                <IconDots size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Workspace</Menu.Label>
              <Menu.Item
                onClick={() => {
                  setBoardMode(!boardMode);
                  setFocusedView("");
                  void changeLevel("containers");
                }}
              >
                {boardMode ? "Architecture diagram" : "Freeform board & annotations"}
              </Menu.Item>
              <Menu.Item onClick={() => setFindOpen(true)}>Find object</Menu.Item>
              <Menu.Item
                disabled={!layoutUndoable}
                onClick={() => useDraw.getState().undoArchitectureLayout()}
              >
                Undo layout
              </Menu.Item>
              <Menu.Item
                disabled={!layoutRedoable}
                onClick={() => useDraw.getState().redoArchitectureLayout()}
              >
                Redo layout
              </Menu.Item>
              <Menu.Item onClick={() => setInspectorOpen(!inspectorOpen)}>
                {inspectorOpen ? "Hide inspector" : "Show inspector"}
              </Menu.Item>
              {level === "context" ? (
                <Menu.Item onClick={() => setEditor("context")}>Edit context</Menu.Item>
              ) : null}
              {level === "components" ? (
                <>
                  <Menu.Item disabled={!actualContainer} onClick={() => setComponentEditor({})}>
                    Add component
                  </Menu.Item>
                  <Menu.CheckboxItem
                    checked={showTechnical}
                    onChange={setShowTechnical}
                    closeMenuOnClick
                  >
                    Show implementation adapters
                  </Menu.CheckboxItem>
                  <Menu.Item
                    disabled={declaredComponents.length < 2}
                    onClick={() => setRelationshipEditor({})}
                  >
                    Connect components
                  </Menu.Item>
                  <Menu.Item
                    disabled={!definition || design.elements.length < 2}
                    onClick={() => setContainerRelationship(true)}
                  >
                    Connect dependency
                  </Menu.Item>
                </>
              ) : null}
              {design.recipe?.id === "qr-studio" ? (
                <Menu.Item onClick={() => setEditor("product")}>Product configuration</Menu.Item>
              ) : null}
              <Menu.Divider />
              <Menu.Label>Contracts and data</Menu.Label>
              <Menu.Item onClick={() => setApiOpen(true)}>API contracts</Menu.Item>
              <Menu.Item onClick={() => setDataOpen(true)}>
                Data responsibilities and objectives
              </Menu.Item>
              <Menu.Item onClick={() => setAnnotationOpen(true)}>
                Suggest responsibility annotations
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Review and handoff</Menu.Label>
              <Menu.Item onClick={() => setReviewOpen(true)}>
                Architecture review ({reviewReport.findings.filter((f) => !f.acceptedBy).length})
              </Menu.Item>
              <Menu.Item onClick={() => setFindingsOpen(true)}>
                Findings ({loaded.findings.length})
              </Menu.Item>
              <Menu.Item disabled={!currentEvidence} onClick={() => setEvidenceOpen(true)}>
                Inspect evidence
              </Menu.Item>
              <Menu.Item disabled={loading || !projection} onClick={() => setHandoffOpen(true)}>
                Implementation handoff
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Deployment</Menu.Label>
              <Menu.Item
                disabled={!design.elements.some(hasLocalDeploymentView)}
                onClick={() =>
                  setDeployment({ element: node?.binding?.element ?? actualContainer })
                }
              >
                Local deployment
              </Menu.Item>
              <Menu.Item onClick={() => setDeploymentPlans(true)}>Deployment plans</Menu.Item>
              <ScenarioMenuItems />
              <Menu.Divider />
              <Menu.Item onClick={() => setLegendOpen(true)}>Type colors</Menu.Item>
              <Menu.Label>Implementation · later</Menu.Label>
              <Menu.Item
                disabled={!!project.target}
                onClick={() => useGenerate.getState().setOpen(true)}
              >
                Generate code
              </Menu.Item>
              <Menu.Label>Saved revision {design.revision}</Menu.Label>
            </Menu.Dropdown>
          </Menu>
          <Tooltip label="Undo latest change">
            <ActionIcon
              variant="subtle"
              color="var(--ink)"
              aria-label="Undo"
              disabled={!undoable}
              onClick={() => void useDraw.getState().undo()}
            >
              <IconArrowBackUp size={19} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Redo latest change">
            <ActionIcon
              variant="subtle"
              color="var(--ink)"
              aria-label="Redo"
              disabled={!redoable}
              onClick={() => void useDraw.getState().redo()}
            >
              <IconArrowForwardUp size={19} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <nav className="architecture-levels" aria-label="Architecture levels">
          {(["context", "containers", "components"] as const).map((item, index) => (
            <button
              type="button"
              key={item}
              aria-pressed={level === item}
              onClick={() => void changeLevel(item)}
            >
              <span>C{index + 1}</span>
              {item[0]?.toUpperCase()}
              {item.slice(1)}
            </button>
          ))}
        </nav>
        <Group gap="xs" className="editor-primary-actions">
          {level === "components" ? (
            <NativeSelect
              aria-label="Component container"
              size="xs"
              value={actualContainer ?? ""}
              data={
                views?.components.map((view) => ({
                  value: view.container ?? "",
                  label: view.name,
                })) ?? []
              }
              onChange={(event) => setContainer(event.currentTarget.value)}
            />
          ) : null}
          <Button
            variant="default"
            size="sm"
            leftSection={<IconBook size={16} />}
            onClick={() => setCatalog(level === "components" ? "components" : "containers")}
          >
            Library
          </Button>
          <Button variant="default" size="sm" onClick={() => setReviewOpen(true)}>
            Review
          </Button>
        </Group>
      </header>
      {project.target ? (
        <nav className="target-navigation" aria-label="Target workspace navigation">
          <strong>Planning target</strong>
          <Button variant="default" size="xs" onClick={() => setTargetTab("baseline")}>
            Current baseline
          </Button>
          <Button
            variant="default"
            size="xs"
            aria-pressed={!targetTab}
            onClick={() => setTargetTab(undefined)}
          >
            Proposed target
          </Button>
          <Button variant="default" size="xs" onClick={() => setTargetTab("changes")}>
            Changes
          </Button>
          <span>Saved design · deployment unverified</span>
        </nav>
      ) : null}
      {!overview && notice ? (
        <Alert
          color={notice.tone === "error" ? "red" : "blue"}
          role="alert"
          withCloseButton
          closeButtonLabel="Dismiss architecture message"
          onClose={() => useDraw.getState().setNotice(undefined)}
        >
          {notice.message}
        </Alert>
      ) : null}
      {error ? (
        <Alert color="red" role="alert">
          {error}{" "}
          <Button
            size="compact-xs"
            variant="default"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Refresh architecture
          </Button>
        </Alert>
      ) : null}
      <section className="studio-toolbar" aria-label="Design tools">
        <Button
          size="xs"
          variant="default"
          aria-pressed={explorerOpen}
          onClick={() => setExplorerOpen(!explorerOpen)}
        >
          Explorer
        </Button>
        {level === "context" ? (
          <Button size="xs" color="cyan.9" onClick={() => setEditor("context")}>
            Edit people & systems
          </Button>
        ) : level === "containers" ? (
          <>
            <Button size="xs" color="cyan.9" onClick={() => setCatalog("containers")}>
              + Add container
            </Button>
            <Button
              size="xs"
              variant="default"
              disabled={design.elements.length < 2}
              onClick={() => setContainerRelationship(true)}
            >
              Connect containers
            </Button>
          </>
        ) : (
          <>
            <Button
              size="xs"
              variant="subtle"
              color="var(--ink)"
              onClick={() => openContainer(actualContainer)}
            >
              ← C2
            </Button>
            <Button
              size="xs"
              color="cyan.9"
              disabled={!actualContainer}
              onClick={() => setCatalog("components")}
            >
              + Add component
            </Button>
            <Button
              size="xs"
              variant="default"
              disabled={declaredComponents.length < 2}
              onClick={() => setRelationshipEditor({})}
            >
              Connect components
            </Button>
            <Button
              size="xs"
              variant="default"
              className="studio-secondary-action"
              disabled={!definition || design.elements.length < 2}
              onClick={() => setContainerRelationship(true)}
            >
              Connect dependency
            </Button>
          </>
        )}
        {level === "containers" ? (
          <FocusedViews
            source={views?.containers}
            active={focused ? focusedView : ""}
            onChange={(key) => {
              void useDraw.getState().flushLayout();
              setFocusedView(key);
            }}
          />
        ) : null}
        <div className="studio-toolbar-secondary">
          <Button
            size="xs"
            variant="subtle"
            color="var(--ink)"
            onClick={() => setCatalog("patterns")}
          >
            Patterns
          </Button>
          <Button size="xs" variant="subtle" color="var(--ink)" onClick={() => setDataOpen(true)}>
            Data & objectives
          </Button>
          <span className="studio-save-state">Saved · r{design.revision}</span>
        </div>
      </section>
      <div className="editor-body">
        {explorerOpen ? (
          <ArchitectureOutline
            views={views}
            projection={projection}
            selected={selected}
            onSelect={(id) => {
              choose(id);
              setFocusRequest((value) => value + 1);
            }}
            onContainer={openContainer}
            onComponent={openComponents}
            onClose={() => setExplorerOpen(false)}
          />
        ) : null}
        {!chatOpen ? (
          <button
            className="editor-chat-handle"
            type="button"
            aria-label="Open chat"
            aria-expanded={false}
            aria-controls="editor-chat"
            onClick={() => setChatOpen(true)}
          >
            <IconMessageCircle size={19} />
            <span>Chat</span>
          </button>
        ) : null}
        <aside id="editor-chat" className="editor-chat" aria-label="Chat panel" hidden={!chatOpen}>
          <header>
            <span>
              <IconMessageCircle size={17} aria-hidden /> Design assistant
            </span>
            <button type="button" aria-label="Collapse chat" onClick={() => setChatOpen(false)}>
              <IconLayoutSidebarLeftCollapse size={17} />
            </button>
          </header>
          <ChatPanel />
        </aside>
        <div
          className="editor-canvas-area"
          onClickCapture={(event) => {
            if (
              level === "containers" &&
              tool === "select" &&
              event.target instanceof Element &&
              event.target.closest(".react-flow__node, .react-flow__edge, .edge-chip")
            )
              setInspectorOpen(true);
          }}
        >
          <div className="scenario-diagram">
            {overview ? (
              board
            ) : !views ? (
              <div className="architecture-loading">
                <Loader size="sm" /> Loading architecture…
              </div>
            ) : projection ? (
              <div className="architecture-stage">
                <div className="architecture-scope-caption">
                  <strong>{projection.name}</strong>
                  <span>
                    {level === "context"
                      ? "People, purpose & external systems"
                      : level === "containers"
                        ? focused
                          ? `${views?.containers.name} · focused C2`
                          : "Applications, data stores & external systems"
                        : "Responsibilities within one application"}
                  </span>
                </div>
                {focusedProjection ? (
                  <button
                    type="button"
                    className="focused-hidden-link"
                    onClick={() => setHiddenOpen(true)}
                  >
                    {focusedProjection.hidden.length} hidden relationships · Whole system
                  </button>
                ) : null}
                {level === "context" && !design.architecture ? (
                  <div className="editor-empty context-empty">
                    <span className="editor-empty-eyebrow">System context</span>
                    <h2>Who uses {project.name}?</h2>
                    <p>
                      Describe its purpose, the people who use it, and the systems it interacts
                      with.
                    </p>
                    <Button color="cyan.9" onClick={() => setEditor("context")}>
                      Describe this system
                    </Button>
                  </div>
                ) : projection.nodes.length ? (
                  <ArchitectureGraph
                    projection={projection}
                    selected={selected}
                    onSelect={choose}
                    viewKey={scope}
                    onOpen={openComponents}
                    focusRequest={focusRequest}
                  />
                ) : (
                  <div className="editor-empty">
                    <h2>Give this application its responsibilities</h2>
                    <p>Add a component for each cohesive part of its behavior.</p>
                    <Button color="cyan.9" onClick={() => setComponentEditor({})}>
                      Add component
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="editor-empty">
                <h2>Start with an application</h2>
                <p>Add a web app, API or worker in C2, then design its components here.</p>
                <Button
                  color="cyan.9"
                  onClick={() => setCatalog(level === "components" ? "components" : "containers")}
                >
                  Browse building blocks
                </Button>
              </div>
            )}
            {overview &&
            design.elements.length === 0 &&
            design.annotations.length === 0 &&
            (tool === "select" || tool === "hand") ? (
              <div className="editor-empty">
                <span className="editor-empty-eyebrow">From idea to architecture</span>
                <h2>What are you building?</h2>
                <p>
                  Start with an example, or choose the applications and data stores your system
                  needs.
                </p>
                <Group justify="center">
                  <Button color="cyan.9" onClick={() => setCatalog("examples")}>
                    Explore SaaS examples
                  </Button>
                  <Button variant="default" onClick={() => setCatalog("containers")}>
                    Browse building blocks
                  </Button>
                </Group>
              </div>
            ) : null}
          </div>
          <ScenarioPanel />
        </div>
        <aside
          className="editor-inspector"
          aria-label="Architecture details"
          hidden={!inspectorOpen}
        >
          <div className="inspector-toolbar">
            <span>Selection</span>
            <ActionIcon
              variant="subtle"
              color="var(--ink)"
              aria-label="Hide inspector"
              onClick={() => setInspectorOpen(false)}
            >
              <IconX size={17} />
            </ActionIcon>
          </div>
          {!selected ? (
            <p className="inspector-empty">Select a box or arrow to edit its details.</p>
          ) : null}
          {notice?.actions?.length ? (
            <section className="inspector-section" aria-label="Connection choices">
              <h3>Connection choices</h3>
              {notice.actions.map((action) => (
                <Button
                  key={action.label}
                  variant="default"
                  size="xs"
                  onClick={() => {
                    useDraw.getState().setNotice(undefined);
                    void useDraw.getState().edit(action.ops);
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </section>
          ) : null}
          {level === "containers" ? (
            <>
              {selected?.startsWith("context:") ? (
                <ContextInspector
                  key={selected}
                  selected={node?.id ?? ""}
                  relationship={edge?.context}
                  onContainers={() => void changeLevel("containers")}
                />
              ) : selected ? (
                <Inspector onComponents={openComponents} />
              ) : null}
              {boardElement &&
              !boardElement.planned &&
              views?.components.some((view) => view.container === boardElement.id) ? (
                <Button m="md" variant="default" onClick={() => openComponents(boardElement.id)}>
                  Open components
                </Button>
              ) : null}
            </>
          ) : projection ? (
            <>
              {level === "context" && selected ? (
                <ContextInspector
                  key={node?.id ?? edge?.id}
                  selected={node?.id ?? ""}
                  relationship={edge?.context}
                  onContainers={() => void changeLevel("containers")}
                />
              ) : edge ? (
                <>
                  {selectedConnection?.planned ? (
                    <PlannedConnectionInspector
                      key={selectedConnection.id}
                      connection={selectedConnection}
                    />
                  ) : selectedConnection ? (
                    <ConnectionInspector connection={selectedConnection} />
                  ) : (
                    <section className="planned-inspector">
                      <span className="capability-status">Declared relationship</span>
                      <h2>{edge.description}</h2>
                      <p>Describes intended collaboration within this application.</p>
                      {edge.componentRelationship ? (
                        <>
                          <Button
                            variant="default"
                            onClick={() =>
                              setRelationshipEditor({ id: edge.componentRelationship })
                            }
                          >
                            Edit relationship
                          </Button>
                          <BindingSummary
                            relationship={{
                              kind: "component-relationship",
                              id: edge.componentRelationship,
                            }}
                          />
                        </>
                      ) : null}
                    </section>
                  )}
                </>
              ) : node?.binding?.element !== actualContainer && selectedElement ? (
                selectedElement.planned ? (
                  <PlannedElementInspector
                    key={selectedElement.id}
                    element={selectedElement}
                    onComponents={() => openComponents(selectedElement.id)}
                  />
                ) : (
                  <ElementInspector element={selectedElement} />
                )
              ) : node ? (
                <ComponentDetails
                  node={node}
                  onOperation={(attachment, operation) => openApi({ attachment, operation })}
                  onConfigure={() =>
                    setComponentEditor({
                      initial: definition,
                      members: !definition
                        ? node.members?.flatMap((member): ArchitectureMember[] => {
                            const binding = member.binding;
                            if (!binding?.attachment) return [];
                            if (binding.resource)
                              return [
                                {
                                  attachment: binding.attachment,
                                  kind: "resource",
                                  ref: binding.resource,
                                },
                              ];
                            if (binding.extension)
                              return [
                                {
                                  attachment: binding.attachment,
                                  kind: "extension",
                                  ref: binding.extension,
                                },
                              ];
                            return [];
                          })
                        : undefined,
                    })
                  }
                  onContainer={() => openContainer(node.binding?.element)}
                />
              ) : null}
              {selected ? (
                <details className="scope-relationships">
                  <summary>Relationships in this scope ({projection.edges.length})</summary>
                  {projection.edges.map((relation) => (
                    <button type="button" key={relation.id} onClick={() => choose(relation.id)}>
                      <strong>
                        {projection.nodes.find((item) => item.id === relation.from)?.name} →{" "}
                        {projection.nodes.find((item) => item.id === relation.to)?.name}
                      </strong>
                      <span>{relation.description}</span>
                    </button>
                  ))}
                </details>
              ) : null}
            </>
          ) : null}
          {selected && (node?.pool || (level === "components" && projection?.pool)) ? (
            <section className="inspector-section" aria-label="Local HTTP pool">
              <h3>Local HTTP pool</h3>
              <LocalHttpPoolSummary binding={(node?.pool ?? projection?.pool)!} />
            </section>
          ) : null}
          {selected && (node?.execution || (level === "components" && projection?.execution)) ? (
            <section className="inspector-section" aria-label="Local execution policy">
              <h3>Local execution · {(node?.execution ?? projection?.execution)!.preset}</h3>
              <ExecutionPolicySummary policy={(node?.execution ?? projection?.execution)!} />
            </section>
          ) : null}
          {level === "containers" && boardElement ? (
            <InterfaceSummary
              key={`element:${boardElement.id}`}
              owner={{ kind: "element", id: boardElement.id }}
            />
          ) : level === "components" && node?.binding?.component ? (
            <InterfaceSummary
              key={`component:${node.binding.component}`}
              owner={{ kind: "component", id: node.binding.component }}
            />
          ) : level === "components" && selectedElement ? (
            <InterfaceSummary
              key={`element:${selectedElement.id}`}
              owner={{ kind: "element", id: selectedElement.id }}
            />
          ) : node?.id.startsWith("context:") &&
            design.architecture?.nodes.some(
              (item) => `context:${item.id}` === node.id && item.kind === "external-system",
            ) ? (
            <InterfaceSummary
              key={node.id}
              owner={{ kind: "external-system", id: node.id.slice(8) }}
            />
          ) : null}
        </aside>
      </div>
      {hiddenOpen && focusedProjection ? (
        <Modal opened onClose={() => setHiddenOpen(false)} title="Hidden relationships">
          <p>
            {focusedProjection.hidden.length} relationships are outside {focused?.name}. They remain
            part of {views?.containers.name}.
          </p>
          <Button
            variant="default"
            onClick={() => {
              setFocusedView("");
              setHiddenOpen(false);
            }}
          >
            Open whole system
          </Button>
          <div className="scope-relationships">
            {focusedProjection.hidden.map((relation) => (
              <button
                type="button"
                key={relation.id}
                onClick={() => {
                  setFocusedView("");
                  setHiddenOpen(false);
                  useDraw
                    .getState()
                    .focus({ nodes: [], edges: [relation.connection ?? relation.id] });
                  setInspectorViews((current) => ({ ...current, containers: true }));
                }}
              >
                <strong>
                  {views?.containers.nodes.find((node) => node.id === relation.from)?.name} →{" "}
                  {views?.containers.nodes.find((node) => node.id === relation.to)?.name}
                </strong>
                <span>
                  {relation.description} · {relation.protocol}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
      {findOpen ? (
        <Modal
          opened
          onClose={() => setFindOpen(false)}
          title="Find object"
          closeButtonProps={{ "aria-label": "Close find object" }}
        >
          <NativeSelect
            label="Inspect an object"
            value={selected ?? ""}
            data={[
              { value: "", label: "Select a box or arrow" },
              ...(projection?.nodes.map((item) => ({ value: item.id, label: item.name })) ?? []),
              ...(projection?.edges.map((item) => ({
                value: item.id,
                label: `↗ ${item.description}`,
              })) ?? []),
            ]}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (!value) return;
              if (overview)
                useDraw
                  .getState()
                  .focus(
                    value.startsWith("container:")
                      ? { nodes: [value.slice(10)], edges: [] }
                      : value.startsWith("context:")
                        ? projection?.edges.some((edge) => edge.id === value)
                          ? { nodes: [], edges: [value] }
                          : { nodes: [value], edges: [] }
                        : { nodes: [], edges: [value.slice(11)] },
                  );
              else choose(value);
              setInspectorOpen(true);
              setFindOpen(false);
            }}
          />
        </Modal>
      ) : null}
      {findingsOpen ? (
        <Modal
          opened
          onClose={() => setFindingsOpen(false)}
          title="Findings"
          closeButtonProps={{ "aria-label": "Close findings" }}
        >
          <FindingsPanel
            onReview={() => {
              setFindingsOpen(false);
              setReviewOpen(true);
            }}
            onNavigate={() => {
              setFindingsOpen(false);
              setInspectorOpen(true);
              void changeLevel("containers");
            }}
          />
        </Modal>
      ) : null}
      {dataOpen ? (
        <ArchitectureData
          design={design}
          initialDataset={reviewEditor?.inputs.find((r) => r.kind === "dataset")?.id}
          initialObjective={reviewEditor?.inputs.find((r) => r.kind === "objective")?.id}
          onClose={() => {
            setDataOpen(false);
            setReviewEditor(undefined);
          }}
        />
      ) : null}
      {legendOpen ? (
        <Modal
          opened
          onClose={() => setLegendOpen(false)}
          title="Type colors"
          closeButtonProps={{ "aria-label": "Close type colors" }}
        >
          <TypeLegend />
          <RelationshipLegend />
        </Modal>
      ) : null}
      {!project.target ? <GenerateDrawer /> : null}
      {targetTab ? (
        <TargetComparison initialTab={targetTab} onClose={() => setTargetTab(undefined)} />
      ) : null}
      {annotationOpen ? <AnnotationDraft onClose={() => setAnnotationOpen(false)} /> : null}
      {catalog ? (
        <CapabilityCatalog
          initialTab={catalog}
          componentContainer={level === "components" ? actualContainer : boardElement?.id}
          onClose={() => setCatalog(undefined)}
          onStarter={() => {
            setCatalog(undefined);
            setStarterOpen(true);
          }}
          onPlace={place}
          onTemplate={(tool) => {
            setCatalog(undefined);
            setBoardMode(true);
            setFocusedView("");
            void changeLevel("containers").then(() => useDraw.getState().setTool(tool));
          }}
          onComponent={(capability, host) => {
            setCatalog(undefined);
            openComponents(host);
            setComponentEditor({ capability });
          }}
        />
      ) : null}
      {reviewOpen ? (
        <ArchitectureReview
          design={design}
          onClose={() => setReviewOpen(false)}
          onEdit={(f) => {
            setReviewOpen(false);
            setReviewEditor(f);
            if (f.editor === "data") setDataOpen(true);
          }}
          onPattern={(pattern) => {
            setReviewOpen(false);
            setReviewPattern(pattern);
          }}
        />
      ) : null}
      {reviewEditor?.editor === "binding" && reviewBinding ? (
        <RelationshipBindings
          design={design}
          relationship={reviewBinding.relationship}
          initialBinding={reviewBinding.id}
          onClose={() => setReviewEditor(undefined)}
        />
      ) : null}
      {reviewEditor?.editor === "contracts" ? (
        <InterfaceEditor
          design={design}
          owner={
            reviewInterface?.owner ?? { kind: "element", id: design.elements[0]?.id ?? "system" }
          }
          initialContract={
            reviewContract ?? (reviewInterface && contractKey(reviewInterface.contract))
          }
          onClose={() => setReviewEditor(undefined)}
        />
      ) : null}
      {reviewPattern ? (
        <PatternComposer
          pattern={reviewPattern}
          onClose={() => setReviewPattern(undefined)}
          onApplied={() => setReviewPattern(undefined)}
        />
      ) : null}
      {containerEditor ? (
        <ContainerEditor
          capability={containerEditor}
          onClose={() => setContainerEditor(undefined)}
          onSaved={(id) => {
            openContainer(id);
            if (focused) setFocusedView("");
          }}
        />
      ) : null}
      {containerRelationship ? (
        <ContainerRelationshipEditor
          from={level === "components" ? actualContainer : boardElement?.id}
          component={level === "components" ? definition?.id : undefined}
          onClose={() => setContainerRelationship(false)}
          onSaved={(id) => {
            if (level === "components" && definition) choose(`use:${definition.id}:${id}`);
            else {
              setBoardMode(false);
              setFocusedView("");
              void changeLevel("containers");
              useDraw.getState().setSelection({ nodes: [], edges: [id] });
            }
            setFocusRequest((value) => value + 1);
          }}
        />
      ) : null}
      {componentEditor && actualContainer ? (
        <ComponentEditor
          design={design}
          element={actualContainer}
          {...componentEditor}
          onClose={() => setComponentEditor(undefined)}
          onSaved={(id) => choose(`responsibility:${id}`)}
        />
      ) : null}
      {relationshipEditor && actualContainer ? (
        <ComponentRelationshipEditor
          design={design}
          element={actualContainer}
          id={relationshipEditor.id}
          onClose={() => setRelationshipEditor(undefined)}
          onSaved={(id) => choose(`declared:${id}`)}
        />
      ) : null}
      {starterOpen ? <ProjectChooser onClose={() => setStarterOpen(false)} /> : null}
      {editor === "context" ? (
        <ContextEditor
          design={design}
          projectName={project.name}
          onClose={() => setEditor(undefined)}
        />
      ) : null}
      {editor === "product" ? (
        <ProductConfiguration design={design} onClose={() => setEditor(undefined)} />
      ) : null}
      {currentEvidence && views && evidenceOpen ? (
        <ArchitectureEvidenceDialog
          evidence={currentEvidence}
          views={views}
          selected={node}
          loading={loading}
          error={error}
          onRefresh={() => setAttempt((value) => value + 1)}
          onClose={() => setEvidenceOpen(false)}
          onBoard={() => openContainer(node?.binding?.element)}
        />
      ) : null}
      {deploymentPlans ? (
        <ArchitectureDeployments
          design={design}
          projectName={project.name}
          onClose={() => setDeploymentPlans(false)}
        />
      ) : null}
      {deployment ? (
        <LocalDeploymentDialog
          design={design}
          findings={loaded.findings}
          initialElement={deployment.element}
          evidenceAvailable={Boolean(currentEvidence)}
          onClose={() => setDeployment(undefined)}
          onConfigure={(id) => {
            setDeployment(undefined);
            openContainer(id);
          }}
          onEvidence={() => {
            setDeployment(undefined);
            setEvidenceOpen(true);
          }}
        />
      ) : null}
    </section>
  );
  return (
    <ScenarioProvider
      scope={
        level === "context"
          ? undefined
          : level === "containers"
            ? { level: "containers" }
            : actualContainer
              ? { level: "components", container: actualContainer }
              : undefined
      }
    >
      {workspace}
    </ScenarioProvider>
  );
}
