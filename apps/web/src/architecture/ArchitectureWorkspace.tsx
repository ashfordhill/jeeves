import {
  type ArchitectureComponent,
  type ArchitectureEvidence,
  type ArchitectureViews,
  hasLocalDeploymentView,
} from "@jeeves/spec";
import { Alert, Button, Group, Loader, NativeSelect, Tabs } from "@mantine/core";
import {
  IconBook,
  IconLayoutSidebarLeftCollapse,
  IconMessageCircle,
  IconSitemap,
} from "@tabler/icons-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "../chat/ChatPanel.tsx";
import { api } from "../draw/api.ts";
import { FindingsPanel } from "../draw/inspector/FindingsPanel.tsx";
import { ConnectionInspector, ElementInspector, Inspector } from "../draw/inspector/Inspector.tsx";
import { ExecutionPolicySummary } from "../draw/inspector/LocalExecutionEditor.tsx";
import { LocalHttpPoolSummary } from "../draw/inspector/LocalHttpPoolEditor.tsx";
import { ProjectChooser } from "../draw/ProjectChooser.tsx";
import { canRedo, canUndo, useDraw } from "../draw/store.ts";
import { GenerateButton, GenerateDrawer } from "../generate/GenerateDrawer.tsx";
import { useGenerate } from "../generate/store.ts";
import { ContextEditor, ProductConfiguration } from "./ArchitectureEditors.tsx";
import { ArchitectureEvidenceDialog, evidenceLabel } from "./ArchitectureEvidence.tsx";
import { type ArchitectureCameraCache, ArchitectureGraph } from "./ArchitectureGraph.tsx";
import { CapabilityCatalog } from "./CapabilityCatalog.tsx";
import { ComponentDetails } from "./ComponentDetails.tsx";
import { ComponentEditor } from "./ComponentEditor.tsx";
import { ComponentRelationshipEditor } from "./ComponentRelationshipEditor.tsx";
import { ContextInspector } from "./ContextInspector.tsx";
import { EditorDraftProvider } from "./editor-drafts.tsx";
import { LocalDeploymentDialog } from "./LocalDeployment.tsx";
import { PlannedConnectionInspector, PlannedElementInspector } from "./PlannedInspector.tsx";
import "./architecture.css";
import "./editor.css";

type Level = "context" | "containers" | "components";
export function ArchitectureWorkspace({ board }: { board: ReactNode }) {
  return (
    <EditorDraftProvider>
      <EditorWorkspace board={board} />
    </EditorDraftProvider>
  );
}
function EditorWorkspace({ board }: { board: ReactNode }) {
  const loaded = useDraw((state) => state.loaded)!;
  const notice = useDraw((state) => state.notice);
  const boardSelection = useDraw((state) => state.selection);
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
  const [deployment, setDeployment] = useState<{ element?: string }>();
  const [level, setLevel] = useState<Level>("containers");
  const navigationRequest = useRef(0);
  const [container, setContainer] = useState<string>();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<"context" | "product">();
  const [catalog, setCatalog] = useState<"blocks" | "examples">();
  const [starterOpen, setStarterOpen] = useState(false);
  const [componentEditor, setComponentEditor] = useState<{
    initial?: ArchitectureComponent;
    capability?: string;
  }>();
  const [relationshipEditor, setRelationshipEditor] = useState<{ id?: string }>();
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth >= 1200);
  const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth >= 760);
  const railTab = useDraw((state) => state.railTab);
  const setRailTab = useDraw((state) => state.setRailTab);
  useEffect(() => {
    if (railTab === "chat") {
      setChatOpen(true);
      setRailTab("inspector");
    }
  }, [railTab, setRailTab]);
  const cameraCache = useRef<ArchitectureCameraCache>({
    directions: new Map(),
    viewports: new Map(),
  });
  const request = useRef<{ key: string; pending: ReturnType<typeof api.architecture> } | undefined>(
    undefined,
  );
  const { project, design } = loaded;
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
  const projection =
    level === "context"
      ? views?.context
      : level === "containers"
        ? views?.containers
        : (views?.components.find((view) => view.container === container) ?? views?.components[0]);
  const scope = level === "components" ? `components:${projection?.container}` : level;
  const selected =
    level === "containers"
      ? boardSelection.edges[0]
        ? `connection:${boardSelection.edges[0]}`
        : boardSelection.nodes[0]
          ? `container:${boardSelection.nodes[0]}`
          : undefined
      : selections[scope];
  const edge = projection?.edges.find((item) => item.id === selected);
  const node = edge
    ? undefined
    : (projection?.nodes.find((item) => item.id === selected) ??
      (level === "containers" ? undefined : projection?.nodes[0]));
  const choose = useCallback(
    (id: string) => {
      setSelections((current) => ({ ...current, [scope]: id }));
      setInspectorOpen(true);
      setRailTab("inspector");
    },
    [scope, setRailTab],
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
  const openComponents = (id: string) => {
    setContainer(id);
    void changeLevel("components");
  };
  const openContainer = (id?: string) => {
    if (id) useDraw.getState().focus({ nodes: [id], edges: [] });
    setInspectorOpen(true);
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
    void changeLevel("containers").then(() =>
      useDraw.getState().setTool({ kind: "planned", capability: id }),
    );
  };
  return (
    <section
      className="architecture-workspace integrated-editor"
      aria-label="Architecture workspace"
      data-chat-open={chatOpen}
      data-inspector-open={inspectorOpen}
    >
      <header className="editor-header">
        <div className="editor-identity">
          <IconSitemap size={20} aria-hidden />
          <strong>Architecture</strong>
          <span>C4 editor</span>
        </div>
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
        <Button
          variant="default"
          size="sm"
          leftSection={<IconBook size={16} />}
          onClick={() => setCatalog("blocks")}
        >
          Library
        </Button>
      </header>
      <div className="editor-actions">
        <Group gap="xs">
          <Button
            size="compact-xs"
            variant="subtle"
            aria-pressed={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
          >
            Chat
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            aria-pressed={inspectorOpen}
            aria-label={inspectorOpen ? "Hide inspector" : "Show inspector"}
            onClick={() => setInspectorOpen(!inspectorOpen)}
          >
            Inspector
          </Button>
          <Button
            size="compact-xs"
            variant="default"
            disabled={!undoable}
            onClick={() => void useDraw.getState().undo()}
          >
            Undo latest change
          </Button>
          <Button
            size="compact-xs"
            variant="default"
            disabled={!redoable}
            onClick={() => void useDraw.getState().redo()}
          >
            Redo latest change
          </Button>
        </Group>
        <Group gap="xs">
          {level === "context" ? (
            <Button size="compact-xs" variant="default" onClick={() => setEditor("context")}>
              Edit context
            </Button>
          ) : null}
          {level === "components" ? (
            <>
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
              <Button
                size="compact-xs"
                variant="default"
                disabled={!actualContainer}
                onClick={() => setComponentEditor({})}
              >
                Add component
              </Button>
              <Button
                size="compact-xs"
                variant="default"
                disabled={declaredComponents.length < 2}
                onClick={() => setRelationshipEditor({})}
              >
                Connect components
              </Button>
            </>
          ) : null}
          {design.recipe?.id === "qr-studio" ? (
            <Button size="compact-xs" variant="default" onClick={() => setEditor("product")}>
              Product configuration
            </Button>
          ) : null}
          <Button
            size="compact-xs"
            variant="subtle"
            disabled={!design.elements.some(hasLocalDeploymentView)}
            onClick={() => setDeployment({ element: node?.binding?.element ?? actualContainer })}
          >
            Local deployment
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            disabled={!currentEvidence}
            onClick={() => setEvidenceOpen(true)}
          >
            Inspect evidence
          </Button>
          <span className="editor-revision">Revision {design.revision}</span>
        </Group>
      </div>
      {level !== "containers" && notice ? (
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
      <div className="editor-body">
        <aside className="editor-chat" aria-label="Chat panel" hidden={!chatOpen}>
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
        <div className="editor-canvas-area">
          {level === "containers" ? (
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
                    : "Responsibilities within one application"}
                </span>
              </div>
              {projection.nodes.length ? (
                <ArchitectureGraph
                  projection={projection}
                  selected={node?.id}
                  onSelect={choose}
                  cameraCache={cameraCache.current}
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
              <Button color="cyan.9" onClick={() => setCatalog("blocks")}>
                Browse building blocks
              </Button>
            </div>
          )}
          {level === "containers" &&
          design.elements.length === 0 &&
          design.annotations.length === 0 &&
          (tool === "select" || tool === "hand") ? (
            <div className="editor-empty">
              <span className="editor-empty-eyebrow">From idea to architecture</span>
              <h2>What are you building?</h2>
              <p>
                Start with an example, or choose the applications and data stores your system needs.
              </p>
              <Group justify="center">
                <Button color="cyan.9" onClick={() => setCatalog("examples")}>
                  Explore SaaS examples
                </Button>
                <Button variant="default" onClick={() => setCatalog("blocks")}>
                  Browse building blocks
                </Button>
              </Group>
            </div>
          ) : null}
        </div>
        <aside
          className="editor-inspector"
          aria-label="Architecture details"
          hidden={!inspectorOpen}
        >
          <Tabs
            value={railTab}
            onChange={(value) => {
              if (value === "inspector" || value === "findings") setRailTab(value);
            }}
            keepMounted={false}
          >
            <Tabs.List>
              <Tabs.Tab value="inspector">Inspector</Tabs.Tab>
              <Tabs.Tab value="findings">
                Findings <small>{loaded.findings.length}</small>
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="findings">
              <FindingsPanel
                onNavigate={() => {
                  setInspectorOpen(true);
                  void changeLevel("containers");
                }}
              />
            </Tabs.Panel>
            <Tabs.Panel value="inspector">
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
                  <div className="scope-object-picker">
                    <NativeSelect
                      label="Inspect an object"
                      value={selected ?? ""}
                      data={[
                        { value: "", label: "Select a box or arrow" },
                        ...design.elements.map((item) => ({
                          value: `container:${item.id}`,
                          label: item.name,
                        })),
                        ...design.connections.map((item) => ({
                          value: `connection:${item.id}`,
                          label: `↗ ${item.planned?.label ?? item.kind}`,
                        })),
                      ]}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        useDraw
                          .getState()
                          .focus(
                            value.startsWith("container:")
                              ? { nodes: [value.slice(10)], edges: [] }
                              : { nodes: [], edges: value ? [value.slice(11)] : [] },
                          );
                      }}
                    />
                  </div>
                  <Inspector onComponents={openComponents} />
                  {boardElement &&
                  !boardElement.planned &&
                  views?.components.some((view) => view.container === boardElement.id) ? (
                    <Button
                      m="md"
                      variant="default"
                      onClick={() => openComponents(boardElement.id)}
                    >
                      Open components
                    </Button>
                  ) : null}
                </>
              ) : projection ? (
                <>
                  <div className="scope-object-picker">
                    <NativeSelect
                      label="Inspect an object"
                      value={edge?.id ?? node?.id ?? ""}
                      data={[
                        ...projection.nodes.map((item) => ({ value: item.id, label: item.name })),
                        ...projection.edges.map((item) => ({
                          value: item.id,
                          label: `↗ ${item.description}`,
                        })),
                      ]}
                      onChange={(event) => choose(event.currentTarget.value)}
                    />
                  </div>
                  {level === "context" ? (
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
                            <Button
                              variant="default"
                              onClick={() =>
                                setRelationshipEditor({ id: edge.componentRelationship })
                              }
                            >
                              Edit relationship
                            </Button>
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
                      onConfigure={() => setComponentEditor({ initial: definition })}
                      onContainer={() => openContainer(node.binding?.element)}
                    />
                  ) : null}
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
                </>
              ) : null}
              {node?.pool || (level === "components" && projection?.pool) ? (
                <section className="inspector-section" aria-label="Local HTTP pool">
                  <h3>Local HTTP pool</h3>
                  <LocalHttpPoolSummary binding={(node?.pool ?? projection?.pool)!} />
                </section>
              ) : null}
              {node?.execution || (level === "components" && projection?.execution) ? (
                <section className="inspector-section" aria-label="Local execution policy">
                  <h3>Local execution · {(node?.execution ?? projection?.execution)!.preset}</h3>
                  <ExecutionPolicySummary policy={(node?.execution ?? projection?.execution)!} />
                </section>
              ) : null}
            </Tabs.Panel>
          </Tabs>
        </aside>
      </div>
      <footer className="editor-footer">
        <span>
          {level === "containers"
            ? "Applications & data stores"
            : level === "context"
              ? "System context"
              : "Application components"}{" "}
          · {design.elements.filter((element) => element.planned).length} planned blocks
        </span>
        <span>{currentEvidence ? evidenceLabel(currentEvidence) : "Refreshing evidence…"}</span>
        <GenerateButton />
      </footer>
      <GenerateDrawer />
      {catalog ? (
        <CapabilityCatalog
          initialTab={catalog}
          onClose={() => setCatalog(undefined)}
          onStarter={() => {
            setCatalog(undefined);
            setStarterOpen(true);
          }}
          onPlace={place}
          onTemplate={(tool) => {
            setCatalog(undefined);
            void changeLevel("containers").then(() => useDraw.getState().setTool(tool));
          }}
          onComponent={
            level === "components" && actualContainer
              ? (capability) => {
                  setCatalog(undefined);
                  setComponentEditor({ capability });
                }
              : undefined
          }
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
}
