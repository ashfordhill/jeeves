/** The opt-in studio's single project-scoped review, execution and output destination. */
import {
  type ArchitectureHandoff,
  exportStudioProject,
  handoffFingerprint,
  handoffJson,
  handoffMarkdown,
  isStructural,
  resolveStudioDefinition,
  studioGenerationSupport,
} from "@jeeves/spec";
import { Button, Checkbox, Loader, NativeSelect, TextInput } from "@mantine/core";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArchitectureHandoff as ScopeDialog } from "../architecture/ArchitectureHandoff.tsx";
import { TargetComparison } from "../architecture/ArchitectureTargets.tsx";
import { handoffSvg } from "../architecture/handoff-diagram.ts";
import { api } from "../draw/api.ts";
import { formDrafts } from "../draw/form-drafts.ts";
import { projectFromUrl, useDraw } from "../draw/store.ts";
import { RunsView } from "../runs/RunsView.tsx";
import { useRuns } from "../runs/store.ts";
import { DraftFeedback } from "../studio/DraftFeedback.tsx";
import { useStudioDiagram } from "../studio/diagram-export.ts";
import { AppLinks, Checks, Log, Report, Steps, statusText } from "./GenerateDrawer.tsx";
import { type ReviewCapture, reviewLink, useReview } from "./review.ts";
import { useGenerate } from "./store.ts";
import "./workspace.css";

type Loaded = NonNullable<ReturnType<typeof useDraw.getState>["loaded"]>;

function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportHandoff(snapshot: ArchitectureHandoff, format: "json" | "markdown") {
  if (!(await useDraw.getState().flushEdits()))
    throw new Error("Resolve the unsaved change before exporting.");
  await useDraw.getState().flushLayout();
  if (useDraw.getState().loaded?.project.id !== snapshot.project.id) return;
  if (format === "json") download("architecture-handoff.json", handoffJson(snapshot));
  else download("architecture-handoff.md", handoffMarkdown(snapshot), "text/markdown");
}

export function GenerateView() {
  const loaded = useDraw((s) => s.loaded);
  const status = useDraw((s) => s.status);
  const error = useDraw((s) => s.error);
  useEffect(() => {
    if (useDraw.getState().status === "idle") void useDraw.getState().open(projectFromUrl());
  }, []);
  if (status === "error")
    return (
      <div className="empty-view" role="alert">
        {error}
        <Button onClick={() => void useDraw.getState().open(projectFromUrl())}>Retry</Button>
      </div>
    );
  if (!loaded || status === "loading")
    return (
      <div className="draw-loading" role="status">
        <Loader size="sm" /> Loading project…
      </div>
    );
  return <ProjectGenerate key={loaded.project.id} loaded={loaded} />;
}

function ProjectGenerate({ loaded }: { loaded: Loaded }) {
  const projectId = loaded.project.id;
  const generationState = useGenerate();
  const generation = generationState.projectId === projectId ? generationState.generation : null;
  const capture = useReview((s) => s.captures[projectId]);
  const busy = useReview((s) => s.busy === projectId);
  const error = useReview((s) => s.errors[projectId]);
  const [fingerprint, setFingerprint] = useState<string>();
  const [tab, setTab] = useState("review");
  const [exportError, setExportError] = useState<string>();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const capturedDiagram = useStudioDiagram((s) => s.projects[projectId]);
  const diagramError = useStudioDiagram((s) => s.errors[projectId]);
  useEffect(() => {
    void useGenerate.getState().load(projectId);
    if (!useReview.getState().captures[projectId]) void useReview.getState().capture(projectId);
  }, [projectId]);
  useEffect(() => {
    let active = true;
    setFingerprint(undefined);
    handoffFingerprint(loaded.design, loaded.project).then((value) => {
      if (active) setFingerprint(value);
    });
    return () => {
      active = false;
    };
  }, [loaded.design, loaded.project]);
  const stale =
    !!capture &&
    (capture.snapshot.project.revision !== loaded.design.revision ||
      capture.snapshot.designFingerprint !== fingerprint);
  const diagram =
    capturedDiagram?.revision === loaded.design.revision &&
    capturedDiagram.fingerprint === fingerprint
      ? capturedDiagram.diagram
      : undefined;
  const openScope = async () => {
    setExportError(undefined);
    if (!(await useDraw.getState().flushEdits())) {
      setExportError("Resolve the unsaved change before reviewing scope.");
      return;
    }
    const current = useDraw.getState().loaded;
    if (
      !capture ||
      !current ||
      current.project.id !== projectId ||
      current.design.revision !== capture.snapshot.project.revision ||
      (await handoffFingerprint(current.design, current.project)) !==
        capture.snapshot.designFingerprint
    ) {
      setExportError("The design changed. Refresh Review before reviewing scope.");
      return;
    }
    setScopeOpen(true);
  };
  const exportDiagram = async () => {
    setExportError(undefined);
    try {
      if (!(await useDraw.getState().flushEdits()))
        throw new Error("Resolve the unsaved change before exporting.");
      const current = useDraw.getState().loaded;
      if (
        !diagram ||
        !current ||
        current.project.id !== projectId ||
        current.design.revision !== capturedDiagram?.revision ||
        (await handoffFingerprint(current.design, current.project)) !== capturedDiagram.fingerprint
      )
        throw new Error("The diagram capture is stale. Open Design, then return to Generate.");
      download(
        "architecture-diagram.svg",
        handoffSvg(diagram, capturedDiagram.fingerprint),
        "image/svg+xml",
      );
    } catch (e) {
      setExportError((e as Error).message);
    }
  };
  const applicationOutputs =
    !!generation?.report &&
    !!(
      generation.report.written.length ||
      generation.report.scaffolded.length ||
      generation.report.kept.length ||
      generation.report.orphaned.length ||
      generation.report.packages.length ||
      generation.report.vendored.length ||
      generation.report.removedElements.length ||
      generation.report.appUrls?.length
    );
  const outputs = applicationOutputs || !!diagram;
  const activeTab = tab === "outputs" && !outputs ? "review" : tab;
  const exportSource = async () => {
    setExportError(undefined);
    try {
      if (!(await useDraw.getState().flushEdits()))
        throw new Error("Resolve the unsaved change before exporting.");
      await useDraw.getState().flushLayout();
      const current = useDraw.getState().loaded;
      if (!current || current.project.id !== projectId) return;
      const [state, layout] = await Promise.all([
        api.getDesign(projectId),
        api.getLayout(projectId),
      ]);
      if (state.design.revision !== current.design.revision)
        throw new Error("The design changed elsewhere. Reload before exporting.");
      download("studio-project.json", await exportStudioProject(state.design, layout));
    } catch (e) {
      setExportError((e as Error).message);
    }
  };
  return (
    <div className="generate-workspace">
      <header className="generate-workspace-heading">
        <h1>Generate</h1>
        <span>{loaded.project.name}</span>
      </header>
      <DraftFeedback projectId={projectId} />
      <div className="generate-tabs" role="tablist" aria-label="Generate sections">
        {["review", "activity", ...(outputs ? ["outputs"] : [])].map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`generate-tab-${value}`}
            aria-selected={activeTab === value}
            aria-controls="generate-content"
            onClick={() => setTab(value)}
          >
            {value[0]?.toUpperCase()}
            {value.slice(1)}
          </button>
        ))}
      </div>
      <div
        id="generate-content"
        className="generate-content"
        role="tabpanel"
        aria-labelledby={`generate-tab-${activeTab}`}
      >
        {activeTab === "review" ? (
          <>
            <div className="generate-review-bar">
              <p role="status">
                {busy
                  ? "Capturing review…"
                  : capture
                    ? stale
                      ? `Review is stale · captured revision ${capture.snapshot.project.revision}`
                      : `Review of revision ${capture.snapshot.project.revision} · ${capture.snapshot.designFingerprint.slice(0, 12)}`
                    : "No review captured."}
              </p>
              <Button
                size="xs"
                variant="default"
                loading={busy}
                onClick={() => void useReview.getState().capture(projectId)}
              >
                Refresh review
              </Button>
              <Button size="xs" variant="default" onClick={() => void exportSource()}>
                Export source
              </Button>
            </div>
            {error ? (
              <p role="alert" className="generate-error">
                {error}
              </p>
            ) : null}
            {exportError ? (
              <p role="alert" className="generate-error">
                {exportError}
              </p>
            ) : null}
            {capture ? (
              <Review
                capture={capture}
                project={loaded.project}
                stale={stale}
                onError={setExportError}
              />
            ) : null}
            <div className="generate-review-bar">
              {loaded.project.target ? (
                <Button size="xs" variant="default" onClick={() => setComparisonOpen(true)}>
                  Compare with source
                </Button>
              ) : null}
              <Button
                size="xs"
                variant="default"
                disabled={!capture || stale || busy || !loaded.design.architecture}
                onClick={() => void openScope()}
              >
                Scope and approval
              </Button>
              <Button
                size="xs"
                variant="default"
                disabled={!diagram}
                onClick={() => void exportDiagram()}
              >
                Download diagram SVG
              </Button>
              <span>
                {diagram
                  ? `Captured ${diagram.view}`
                  : (diagramError ??
                    "Open Design, then return to Generate to capture the current diagram.")}
              </span>
            </div>
          </>
        ) : activeTab === "activity" ? (
          <>
            <GenerationControls
              loaded={loaded}
              reviewFingerprint={capture?.snapshot.designFingerprint}
              blocked={!capture || stale || busy}
            />
            <section className="generation-activity" aria-label="Application generation">
              <h2>Latest generation</h2>
              {generation ? (
                <>
                  <p role="status">
                    Generation {generation.id} · {statusText(generation)} · design revision{" "}
                    {generation.revision}
                  </p>
                  {generation.error ? (
                    <p className="generate-error" role="alert">
                      {generation.error}
                    </p>
                  ) : null}
                  {generation.report?.problems.length ? (
                    <details>
                      <summary>File ownership conflicts</summary>
                      <Report generation={generation} />
                    </details>
                  ) : null}
                  <details open={generation.status === "running"}>
                    <summary>Steps and recorded checks</summary>
                    <Steps generation={generation} />
                    <Checks checks={generation.checks} />
                  </details>
                  <details>
                    <summary>Generation log ({generation.log.length} lines)</summary>
                    <Log generation={generation} />
                  </details>
                </>
              ) : (
                <p>No generations yet.</p>
              )}
            </section>
            <section className="orchestration-activity" aria-label="Orchestration history">
              <RunsView embedded />
            </section>
          </>
        ) : (
          <>
            {applicationOutputs && generation ? (
              <>
                <h2>Generation {generation.id} outputs</h2>
                <p>
                  Design revision {generation.revision} · {statusText(generation)}
                </p>
                <p>
                  Output folder: <code>{generation.outputDir}</code>
                </p>
                <Report generation={generation} />
                <AppLinks generation={generation} />
              </>
            ) : (
              <>
                <h2>Portable architecture outputs</h2>
                <p>
                  Design source, handoff and the captured diagram describe architecture intent. No
                  application runtime is supplied by these exports.
                </p>
              </>
            )}
            <div className="generate-review-bar">
              <Button size="xs" variant="default" onClick={() => void exportSource()}>
                Export source
              </Button>
              <Button
                size="xs"
                variant="default"
                disabled={!diagram}
                onClick={() => void exportDiagram()}
              >
                Download diagram SVG
              </Button>
              {capture ? (
                <>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() =>
                      void exportHandoff(capture.snapshot, "json").catch((e: Error) =>
                        setExportError(e.message),
                      )
                    }
                  >
                    Download handoff JSON
                  </Button>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() =>
                      void exportHandoff(capture.snapshot, "markdown").catch((e: Error) =>
                        setExportError(e.message),
                      )
                    }
                  >
                    Download handoff Markdown
                  </Button>
                </>
              ) : null}
            </div>
            {diagram ? (
              <p>
                Diagram scope {diagram.view} · layout {diagram.layoutFingerprint.slice(0, 12)}.
              </p>
            ) : null}
            {capture ? (
              <p>
                Handoff captures revision {capture.snapshot.project.revision}
                {stale ? " · stale; refresh Review for current inputs" : ""}.
              </p>
            ) : null}
            {exportError ? <p role="alert">{exportError}</p> : null}
          </>
        )}
      </div>
      {comparisonOpen ? (
        <TargetComparison initialTab="changes" onClose={() => setComparisonOpen(false)} />
      ) : null}
      {scopeOpen ? (
        <ScopeDialog
          view={diagram?.view ?? "studio"}
          initialTab="scope"
          initialDiagram={diagram}
          onClose={() => setScopeOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Review({
  capture,
  project,
  stale,
  onError,
}: {
  capture: ReviewCapture;
  project: Loaded["project"];
  stale: boolean;
  onError: (message: string) => void;
}) {
  const currentDesign = useDraw((s) => s.loaded?.design);
  const { snapshot, design, findings } = capture;
  const errors = findings.filter((item) => item.severity === "error");
  const structure = errors.filter(isStructural);
  const support = studioGenerationSupport(design);
  const link = (id: string, name = "Show in diagram") => {
    const href = currentDesign && reviewLink(currentDesign, project, id);
    return href ? (
      <a
        href={href}
        onClick={async (event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (!(await useDraw.getState().flushEdits())) {
            onError("Resolve the unsaved change before navigating.");
            return;
          }
          const next = new URL(href, window.location.href);
          const hash = next.hash;
          next.hash = window.location.hash;
          window.history.replaceState(null, "", next);
          window.location.hash = hash;
        }}
      >
        {name}
      </a>
    ) : null;
  };
  const definitions = (design.architecture?.studio?.elements ?? []).map((binding) => ({
    binding,
    definition: resolveStudioDefinition(binding.definition),
    element: design.elements.find((item) => item.id === binding.element),
  }));
  const sourceWork = (snapshot.intent.decisions ?? []).filter(
    (item) => item.id.startsWith("studio-c4b-") && item.status === "Unresolved",
  );
  return (
    <div className="generate-review-grid" data-review-project={project.id}>
      <section>
        <h2>Design checks</h2>
        <p>
          {structure.length
            ? `${structure.length} structural errors`
            : "No structural errors recorded"}{" "}
          · {errors.length - structure.length} other generation blockers
        </p>
        {errors.length ? (
          <details>
            <summary>Inspect {errors.length} blocking findings</summary>
            <ul>
              {errors.map((item) => (
                <li key={JSON.stringify(item)}>
                  <strong>{item.code}</strong> · {item.message}{" "}
                  {link(item.target.element ?? item.target.connection ?? "system")}
                  <details>
                    <summary>Exact target</summary>
                    <pre>{JSON.stringify(item.target, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <p>
          {support.supported
            ? "Legacy template generation eligibility is retained."
            : support.message}
        </p>
      </section>
      <section>
        <h2>Unresolved choices</h2>
        <p>
          {snapshot.openItems.length
            ? `${snapshot.openItems.length} items need review; ${snapshot.openItems.filter((i) => i.critical).length} block implementation review.`
            : "No unresolved review items recorded."}
        </p>
        {snapshot.openItems.length ? (
          <details>
            <summary>Inspect choices and retained requirements</summary>
            <ul>
              {snapshot.openItems.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  {item.message} {link(item.id)}
                  <small>
                    {item.kind}:{item.id}
                    {item.owner ? ` · owner ${item.owner}` : ""}
                    {item.blocks ? ` · blocks ${item.blocks}` : ""}
                  </small>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
      <section>
        <h2>Implementation availability</h2>
        <p>
          {support.supported
            ? `${snapshot.coverage.filter((item) => item.available).length} available definitions of ${snapshot.coverage.length} recorded.`
            : "Studio definitions describe intent. No studio runtime resolver is available."}
        </p>
        <details>
          <summary>Exact templates, contracts and support</summary>
          <ul>
            {snapshot.coverage.map((item) => (
              <li key={`${item.id}:${item.category}:${item.boundary}`}>
                {item.name} · {item.category} ·{" "}
                {item.available ? "available definition" : "unavailable"}
                {item.version ? ` @${item.version}` : ""}
                <small>{item.boundary}</small>
                {link(item.id)}
              </li>
            ))}
          </ul>
          <details>
            <summary>Portable source details</summary>
            <pre>
              {JSON.stringify(
                {
                  manifests: snapshot.manifests,
                  contracts: snapshot.contracts,
                  implementationSupport: snapshot.implementationSupport,
                  intent: snapshot.intent,
                  scope: snapshot.scope,
                  provenance: snapshot.provenance,
                  studioSources: snapshot.studioSources,
                  studio: design.architecture?.studio,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </details>
      </section>
      <section>
        <h2>C4b work</h2>
        <p>
          Project behavior and integration extensions need implementation and acceptance evidence.
          These boundaries are expected; drawing them does not implement them.
        </p>
        {sourceWork.length ? (
          <details>
            <summary>{sourceWork.length} source-linked C4b obligations</summary>
            <ul>
              {sourceWork.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <p>{item.decision}</p>
                  <details>
                    <summary>Source and affected objects</summary>
                    <small>{item.context}</small>
                    {item.links
                      .filter((ref) => ref.kind === "element")
                      .map((ref) => (
                        <span key={ref.id}>
                          {" · "}
                          {link(
                            ref.id,
                            design.elements.find((element) => element.id === ref.id)?.name ??
                              ref.id,
                          )}
                        </span>
                      ))}
                  </details>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {definitions.length ? (
          <details>
            <summary>{definitions.length} studio foundation boundaries</summary>
            <ul>
              {definitions.map(({ binding, definition, element }) => (
                <li key={binding.element}>
                  <strong>{element?.name ?? binding.element}</strong> {link(binding.element)}
                  <small>
                    {binding.definition.id} @{binding.definition.version} ·{" "}
                    {definition ? "Design definition only" : "Exact definition unavailable"}
                  </small>
                  {definition ? (
                    <ul>
                      {definition.c4bObligations.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>Resolve this exact definition before relying on its contract.</p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <details>
          <summary>{snapshot.obligations.length} explicit implementation obligations</summary>
          <ul>
            {snapshot.obligations.map((item) => (
              <li key={item.id}>
                <strong>{item.responsibility}</strong> {link(item.container)}
                <small>
                  {item.id} · {item.acceptanceIds.join(", ") || "No acceptance IDs recorded"}
                </small>
                <details>
                  <summary>Contracts, expectations and gaps</summary>
                  <pre>{JSON.stringify(item, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        </details>
        {design.elements.some(
          (item) =>
            item.notes.trim() || item.attachments.some((attachment) => attachment.notes.trim()),
        ) ? (
          <details>
            <summary>Retained project implementation notes</summary>
            {design.elements
              .filter(
                (item) =>
                  item.notes.trim() ||
                  item.attachments.some((attachment) => attachment.notes.trim()),
              )
              .map((item) => (
                <article key={item.id}>
                  <strong>{item.name}</strong> {link(item.id)}
                  <pre>{item.notes}</pre>
                  {item.attachments
                    .filter((attachment) => attachment.notes.trim())
                    .map((attachment) => (
                      <div key={attachment.id}>
                        <small>
                          {attachment.id} · {attachment.template.id} @{attachment.template.version}
                        </small>
                        <pre>{attachment.notes}</pre>
                      </div>
                    ))}
                </article>
              ))}
          </details>
        ) : null}
      </section>
      <section>
        <h2>Verification evidence</h2>
        <p>
          {snapshot.evidence.environment === "unrecorded"
            ? "No recorded verification environment for this capture."
            : "Recorded local output; inspect revision and environment before applying its results."}
        </p>
        <p>{snapshot.evidence.applicability}</p>
        <details>
          <summary>Recorded generation and run evidence</summary>
          <pre>{JSON.stringify(snapshot.evidence, null, 2)}</pre>
        </details>
      </section>
      <section>
        <h2>Portable handoff</h2>
        <p>
          {snapshot.status}. {snapshot.limitation}
        </p>
        <p>
          {stale
            ? "Downloads retain the captured stale revision. Refresh for current inputs."
            : "Architecture review does not certify a runtime."}
        </p>
        <div className="generate-review-bar">
          <Button
            size="xs"
            variant="default"
            onClick={() =>
              void exportHandoff(snapshot, "json").catch((e: Error) => onError(e.message))
            }
          >
            Download handoff JSON
          </Button>
          <Button
            size="xs"
            variant="default"
            onClick={() =>
              void exportHandoff(snapshot, "markdown").catch((e: Error) => onError(e.message))
            }
          >
            Download handoff Markdown
          </Button>
        </div>
      </section>
    </div>
  );
}

function GenerationControls({
  loaded,
  blocked,
  reviewFingerprint,
}: {
  loaded: Loaded;
  blocked: boolean;
  reviewFingerprint?: string;
}) {
  const state = useGenerate();
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const failed = formDrafts.hasProblems(loaded.project.id);
  const [expanded, setExpanded] = useState(false);
  const support = studioGenerationSupport(loaded.design);
  const running = state.generation?.status === "running";
  const reason = failed
    ? "Resolve the unsaved change before generating."
    : loaded.project.target
      ? "Target workspaces are planning only."
      : !support.supported
        ? support.message
        : loaded.design.elements.length === 0
          ? "Add an application or resource first."
          : loaded.findings.some((f) => f.severity === "error")
            ? "Resolve generation blockers before starting."
            : blocked
              ? "Capture a current review before starting."
              : undefined;
  const recipe = loaded.design.recipe;
  const pack = state.packs.find((item) => item.id === state.acceptancePack);
  useEffect(() => {
    if (recipe) useGenerate.getState().setAcceptancePack("");
  }, [recipe]);
  const start = async () => {
    await state.start(loaded.design.revision, reviewFingerprint);
    await useRuns.getState().refresh();
  };
  return (
    <section className="generation-controls" aria-label="Generation controls">
      <h2>Application generation</h2>
      {reason ? (
        <p>{reason}</p>
      ) : (
        <p>Generate the selected legacy templates into a local project. Starting is explicit.</p>
      )}
      <Button
        size="xs"
        variant="default"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        Generation settings
      </Button>
      {expanded ? (
        <div className="generation-settings">
          <TextInput
            label="Output folder"
            value={state.outputDir}
            disabled={running}
            placeholder={state.defaultOutputDir}
            onChange={(e) => state.setOutputDir(e.currentTarget.value)}
          />
          <Checkbox
            label="Run the baseline check (install, type check, Docker, test packs)"
            checked={state.baseline}
            disabled={running}
            onChange={(e) => state.setBaseline(e.currentTarget.checked)}
          />
          {recipe ? (
            <p>
              {recipe.id} @{recipe.version} supplies its own fixed acceptance.
            </p>
          ) : (
            <NativeSelect
              label="Fixed acceptance pack"
              description="None preserves the existing lock's acceptance."
              value={state.acceptancePack}
              disabled={running}
              data={[
                { value: "", label: "None" },
                ...state.packs.map((item) => ({ value: item.id, label: item.id })),
              ]}
              onChange={(e) => state.setAcceptancePack(e.currentTarget.value)}
            />
          )}
          {pack ? (
            <p>
              {pack.suites
                .map((item) => `${item.id} (${item.acceptanceIds.join(", ")})`)
                .join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="generate-review-bar">
        {running ? (
          <Button size="xs" variant="default" onClick={() => void state.cancel()}>
            Cancel generation
          </Button>
        ) : (
          <Button
            color="cyan.9"
            size="xs"
            loading={state.starting}
            disabled={!!reason || !state.outputDir.trim()}
            onClick={() => void start()}
          >
            {state.generation ? "Generate again" : "Generate project"}
          </Button>
        )}
      </div>
      {state.error ? (
        <p className="generate-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
