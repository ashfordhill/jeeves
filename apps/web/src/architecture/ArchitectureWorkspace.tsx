import type { ArchitectureViewNode, ArchitectureViews } from "@jeeves/spec";
import { Alert, Button, Loader, NativeSelect } from "@mantine/core";
import {
  IconArrowLeft,
  IconChevronRight,
  IconEdit,
  IconSettings,
  IconSitemap,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";
import { ContextEditor, ProductConfiguration } from "./ArchitectureEditors.tsx";
import { ArchitectureGraph, supportLabel } from "./ArchitectureGraph.tsx";
import "./architecture.css";

export function ArchitectureWorkspace({ onClose }: { onClose: () => void }) {
  const loaded = useDraw((state) => state.loaded);
  const notice = useDraw((state) => state.notice);
  const localUndo = useDraw((state) => state.undoSteps.length);
  const [views, setViews] = useState<ArchitectureViews>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [level, setLevel] = useState<"context" | "containers" | "components">("context");
  const [container, setContainer] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [editor, setEditor] = useState<"context" | "product">();
  const projectId = loaded?.project.id,
    revision = loaded?.design.revision;
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is an explicit user retry trigger.
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setViews(undefined);
    setError(undefined);
    api.architecture(projectId).then(
      (result) => {
        if (active && result.revision === revision) setViews(result.views);
        else if (active) setError("The architecture changed while loading. Refresh this view.");
      },
      (error) => {
        if (active) setError(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      active = false;
    };
    // attempt explicitly retries a failed request without changing the semantic document.
  }, [projectId, revision, attempt]);
  const choose = useCallback((id: string) => setSelected(id), []);
  if (!loaded) return null;
  const projection =
    level === "context"
      ? views?.context
      : level === "containers"
        ? views?.containers
        : (views?.components.find((view) => view.container === container) ?? views?.components[0]);
  const node = projection?.nodes.find((item) => item.id === selected) ?? projection?.nodes[0];
  const changeLevel = (next: typeof level) => {
    setLevel(next);
    setSelected(undefined);
  };
  const openComponents = (id: string) => {
    setContainer(id);
    changeLevel("components");
  };
  const editOnBoard = (item: ArchitectureViewNode) => {
    if (!item.binding) return;
    useDraw.getState().focus({ nodes: [item.binding.element], edges: [] });
    useDraw.getState().setRailTab("inspector");
    onClose();
  };
  const unbound = loaded.findings.filter((finding) => finding.code === "ARCHITECTURE_UNBOUND");
  return (
    <section className="architecture-workspace" aria-label="Architecture workspace">
      <header className="architecture-header">
        <div className="architecture-header-title">
          <Button
            variant="default"
            size="xs"
            leftSection={<IconArrowLeft size={15} />}
            onClick={onClose}
          >
            Back to board
          </Button>
          <h1>
            <IconSitemap size={20} aria-hidden />
            Architecture
          </h1>
        </div>
        <div className="architecture-header-actions">
          <Button
            variant="default"
            size="xs"
            leftSection={<IconEdit size={15} />}
            onClick={() => setEditor("context")}
          >
            Edit context
          </Button>
          {loaded.design.recipe?.id === "qr-studio" ? (
            <Button
              color="cyan.9"
              size="xs"
              leftSection={<IconSettings size={15} />}
              onClick={() => setEditor("product")}
            >
              Product configuration
            </Button>
          ) : null}
          <Button
            variant="default"
            size="xs"
            disabled={!loaded.history.canUndo && localUndo === 0}
            onClick={() => void useDraw.getState().undo()}
          >
            Undo latest change
          </Button>
        </div>
      </header>
      <nav className="architecture-levels" aria-label="Architecture levels">
        {(["context", "containers", "components"] as const).map((item, index) => (
          <button
            key={item}
            type="button"
            aria-pressed={level === item}
            disabled={item === "components" && !views?.components.length}
            onClick={() => changeLevel(item)}
          >
            <span>C{index + 1}</span>
            {item[0]?.toUpperCase()}
            {item.slice(1)}
            {index < 2 ? <IconChevronRight size={14} aria-hidden /> : null}
          </button>
        ))}
        {level === "components" && views?.components.length ? (
          <NativeSelect
            aria-label="Component container"
            value={projection?.container}
            data={views.components.map((view) => ({
              value: view.container ?? "",
              label: view.name,
            }))}
            onChange={(event) => {
              setContainer(event.currentTarget.value);
              setSelected(undefined);
            }}
          />
        ) : null}
        <p>One design. Different scopes.</p>
      </nav>
      {notice ? (
        <Alert
          color={notice.tone === "error" ? "red" : "blue"}
          role="alert"
          withCloseButton
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
      {!views && !error ? (
        <div className="architecture-loading">
          <Loader size="sm" /> Loading architecture…
        </div>
      ) : projection ? (
        <div className="architecture-content">
          <div className="architecture-stage">
            <div className="architecture-scope-caption">
              <strong>{projection.name}</strong>
              <span>
                {projection.level === "components"
                  ? "Component scope · one application"
                  : "Software system boundary"}
              </span>
            </div>
            <ArchitectureGraph projection={projection} selected={node?.id} onSelect={choose} />
          </div>
          <aside className="architecture-inspector" aria-label="Architecture details">
            <p className="architecture-intro">{projection.description}</p>
            <NativeSelect
              label="Inspect an object"
              value={node?.id ?? ""}
              data={projection.nodes.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(event) => choose(event.currentTarget.value)}
            />
            {node ? (
              <section className="architecture-object-details">
                <span className="architecture-support" data-support={node.support}>
                  {supportLabel[node.support]}
                </span>
                <h2>{node.name}</h2>
                <p>{node.description}</p>
                <p className="architecture-detail-technology">{node.technology}</p>
                {node.provenance ? (
                  <p>
                    Source: <strong>{node.provenance}</strong>
                  </p>
                ) : null}
                {node.kind === "system" ? (
                  <Button fullWidth color="cyan.9" onClick={() => changeLevel("containers")}>
                    Open containers
                  </Button>
                ) : node.binding &&
                  views?.components.some((view) => view.container === node.binding?.element) &&
                  level !== "components" ? (
                  <Button
                    fullWidth
                    color="cyan.9"
                    onClick={() => {
                      if (node.binding) openComponents(node.binding.element);
                    }}
                  >
                    Open components
                  </Button>
                ) : null}
                {node.binding ? (
                  <Button fullWidth variant="default" onClick={() => editOnBoard(node)}>
                    Edit on board
                  </Button>
                ) : null}
                {node.acceptance.length ? (
                  <p>
                    Acceptance references: <strong>{node.acceptance.join(", ")}</strong>
                  </p>
                ) : null}
                {node.support === "recipe" || node.support === "template" ? (
                  <p className="architecture-evidence-note">
                    Supplied by generation. Run Generate with verification for evidence on this
                    design revision.
                  </p>
                ) : node.support === "extension" ? (
                  <p className="architecture-evidence-note">
                    The design alone does not prove this project-owned implementation. Review Runs
                    and application acceptance.
                  </p>
                ) : null}
              </section>
            ) : (
              <p>
                No objects in this scope. Add an executable element on the board or describe the
                context.
              </p>
            )}
            <section className="architecture-relationships" aria-label="Scope relationships">
              <h3>Relationships</h3>
              {projection.edges.length ? (
                <ul>
                  {projection.edges.map((edge) => (
                    <li key={edge.id}>
                      <strong>
                        {projection.nodes.find((item) => item.id === edge.from)?.name} →{" "}
                        {projection.nodes.find((item) => item.id === edge.to)?.name}
                      </strong>
                      <span>{edge.description}</span>
                      <small>
                        {edge.connection ? `Connection ${edge.connection}` : "Context intent"}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No declared relationships in this scope.</p>
              )}
            </section>
            {projection.resources.length ? (
              <details className="architecture-resources">
                <summary>Data contracts ({projection.resources.length})</summary>
                {projection.resources.map((resource) => (
                  <p key={`${resource.attachment}:${resource.id}`}>
                    <strong>{resource.name}</strong> · {resource.fields} fields
                    <br />
                    {resource.operations.length
                      ? resource.operations.join(", ")
                      : "Internal storage; no standard CRUD routes"}
                  </p>
                ))}
              </details>
            ) : null}
            {unbound.length ? (
              <p className="architecture-unbound">
                {unbound.length} context interaction{unbound.length === 1 ? " has" : "s have"} no
                container binding. Use Edit context to bind it or keep it as visible intent.
              </p>
            ) : null}
            <details className="architecture-key" open>
              <summary>Diagram key</summary>
              <p>
                Boxes show architectural roles. Solid arrows reference executable connections;
                dashed arrows show context intent. Template/recipe labels describe supplied
                behavior, not passed production certification. People and external systems are
                outside the generated application.
              </p>
              <p>View navigation and zoom do not change the design or the board layout.</p>
            </details>
          </aside>
        </div>
      ) : null}
      {editor === "context" ? (
        <ContextEditor
          design={loaded.design}
          projectName={loaded.project.name}
          onClose={() => setEditor(undefined)}
        />
      ) : null}
      {editor === "product" ? (
        <ProductConfiguration design={loaded.design} onClose={() => setEditor(undefined)} />
      ) : null}
    </section>
  );
}
