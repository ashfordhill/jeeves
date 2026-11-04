/**
 * Generate (PLAN §5, §9): a button over the board and an output drawer along its bottom edge.
 * The drawer picks the output folder, starts a generation (optionally with the baseline check),
 * and shows the steps, template test-pack results, what was written, and the streamed log.
 */
import { Button, Checkbox, Loader, NativeSelect, TextInput } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconCircle,
  IconMinus,
  IconPlayerPlay,
  IconPlayerStop,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import type { Generation, GenerationCheck, GenerationStep } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";
import "./generate.css";
import { useGenerate } from "./store.ts";

/** The drawer's one-word verdict: "Green" only when the baseline check ran and passed. */
export function statusText(generation: Generation): string {
  switch (generation.status) {
    case "running":
      return "Generating…";
    case "succeeded":
      return generation.baseline ? "Green" : "Written, baseline not run";
    case "failed":
      return "Failed";
    case "blocked":
      return "Stopped";
    case "cancelled":
      return "Cancelled";
    case "interrupted":
      return "Interrupted";
  }
}

function StepIcon({ status }: { status: GenerationStep["status"] }) {
  switch (status) {
    case "running":
      return <Loader size={14} />;
    case "passed":
      return <IconCheck size={16} aria-label="passed" />;
    case "failed":
      return <IconX size={16} aria-label="failed" />;
    case "skipped":
      return <IconMinus size={16} aria-label="skipped" />;
    case "pending":
      return <IconCircle size={14} aria-label="waiting" />;
  }
}

function seconds(ms: number | undefined): string {
  return ms === undefined ? "" : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export function Steps({ generation }: { generation: Generation }) {
  return (
    <ol className="generate-steps" aria-label="Steps">
      {generation.steps.map((step) => (
        <li key={step.id} className="generate-step" data-status={step.status}>
          <StepIcon status={step.status} />
          <span className="generate-step-title">{step.title}</span>
          <span className="generate-step-time">{seconds(step.durationMs)}</span>
          {step.message ? <span className="generate-step-message">{step.message}</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function Checks({ checks }: { checks: GenerationCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <>
      {(["infrastructure", "template", "application"] as const).map((layer) => {
        const group = checks.filter((check) => (check.layer ?? "template") === layer);
        if (!group.length) return null;
        const passed = group.filter((check) => check.status === "passed").length;
        const skipped = group.filter((check) => check.status === "skipped").length;
        const label =
          layer === "infrastructure"
            ? "Infrastructure checks"
            : layer === "template"
              ? "Template conformance"
              : "Application acceptance";
        return (
          <section key={layer} className="generate-section" aria-label={label}>
            <h3>
              {label}: {passed} of {group.length} passed{skipped ? `; ${skipped} skipped` : ""}
            </h3>
            <ul className="generate-checks">
              {group.map((check) => (
                <li key={`${check.subject}/${check.id}`} data-status={check.status}>
                  {check.status === "passed" ? (
                    <IconCheck size={14} aria-label="passed" />
                  ) : check.status === "skipped" ? (
                    <IconMinus size={14} aria-label="skipped" />
                  ) : (
                    <IconX size={14} aria-label="failed" />
                  )}
                  <span className="generate-check-subject">{check.subject}</span>
                  <span>{check.title}</span>
                  {check.acceptanceIds?.length ? (
                    <span className="generate-check-acceptance">
                      {check.acceptanceIds.join(", ")}
                    </span>
                  ) : null}
                  {check.reason ? <span>{check.reason}</span> : null}
                  {check.error ? <pre className="generate-check-error">{check.error}</pre> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function FileList({ title, paths }: { title: string; paths: string[] }) {
  if (paths.length === 0) return null;
  return (
    <details className="generate-files">
      <summary>
        {title} ({paths.length})
      </summary>
      <ul>
        {paths.map((path) => (
          <li key={path}>
            <code>{path}</code>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AppLinks({ generation }: { generation: Generation }) {
  const urls = generation.report?.appUrls ?? [];
  if (urls.length === 0) return null;
  return (
    <section className="generate-section" aria-label="Open the app">
      <h3>Open the app</h3>
      <ul className="generate-app-links">
        {urls.map((entry) =>
          entry.url ? (
            <li key={entry.element}>
              <a href={entry.url} target="_blank" rel="noreferrer">
                {entry.url}
              </a>
            </li>
          ) : (
            <li key={entry.element}>
              <code>{entry.hint}</code>
            </li>
          ),
        )}
      </ul>
      <p className="generate-help">
        Start the app with <code>docker compose up --wait</code> in the output folder.
      </p>
    </section>
  );
}

export function Report({ generation }: { generation: Generation }) {
  const report = generation.report;
  if (!report) return null;
  if (report.problems.length > 0) {
    return (
      <section className="generate-section" aria-label="Ownership problems">
        <h3>Files Jeeves owns were changed</h3>
        <ul className="generate-problems">
          {report.problems.map((problem) => (
            <li key={problem.path}>
              <code>{problem.path}</code> {problem.message}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section className="generate-section" aria-label="What was written">
      <h3>Project files</h3>
      {report.removedElements.length > 0 ? (
        <p className="generate-warning">
          <IconAlertTriangle size={14} aria-hidden /> No longer in the design, left in place:{" "}
          {report.removedElements.map((e) => `${e.id} (${e.dir}/)`).join(", ")}
        </p>
      ) : null}
      <FileList title="Generated files updated" paths={report.written} />
      <FileList title="Scaffolded (now project-owned)" paths={report.scaffolded} />
      <FileList title="Project-owned files kept as they were" paths={report.kept} />
      <FileList title="package.json files given missing dependencies" paths={report.packages} />
      <FileList title="No longer generated, left in place" paths={report.orphaned} />
      {report.git === "initialized" ? (
        <p>Started a git repository with an initial commit.</p>
      ) : null}
    </section>
  );
}

export function Log({ generation }: { generation: Generation }) {
  const ref = useRef<HTMLDivElement>(null);
  const lines = generation.log.length;
  // Keep the newest output in view unless the person scrolled up to read.
  useEffect(() => {
    const el = ref.current;
    if (!el || lines === 0) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight;
  }, [lines]);
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be keyboard-reachable (axe scrollable-region-focusable)
    <div ref={ref} className="generate-log" role="log" aria-label="Output" tabIndex={0}>
      <pre>{generation.log.map((l) => l.line).join("\n") || "No output yet."}</pre>
    </div>
  );
}

export function GenerateDrawer() {
  const recipe = useDraw((s) => s.loaded?.design.recipe);
  const projectId = useDraw((s) => s.loaded?.project.id);
  const errors = useDraw(
    (s) => s.loaded?.findings.filter((f) => f.severity === "error").length ?? 0,
  );
  const empty = useDraw((s) => (s.loaded?.design.elements.length ?? 0) === 0);
  const setRailTab = useDraw((s) => s.setRailTab);
  const state = useGenerate();
  const { open, generation } = state;
  const pack = state.packs.find((candidate) => candidate.id === state.acceptancePack);

  useEffect(() => {
    if (projectId) void useGenerate.getState().load(projectId);
  }, [projectId]);

  useEffect(() => {
    if (recipe) useGenerate.getState().setAcceptancePack("");
  }, [recipe]);

  if (!open) return null;
  const running = generation?.status === "running";
  const blockedReason = empty
    ? "Add at least one element to the design first."
    : errors > 0
      ? `Fix the design's ${errors} error${errors === 1 ? "" : "s"} before generating.`
      : undefined;

  return (
    <section id="generate-drawer" className="generate-drawer" aria-label="Generate">
      <header className="generate-head">
        <h2>Generate</h2>
        {generation ? (
          <span className="generate-status" data-status={generation.status} role="status">
            {statusText(generation)}
            {generation.status !== "running" ? ` · revision ${generation.revision}` : ""}
          </span>
        ) : null}
        <button
          type="button"
          className="generate-close"
          aria-label="Hide generate output"
          title="Hide"
          onClick={() => state.setOpen(false)}
        >
          <IconChevronDown size={18} aria-hidden />
        </button>
      </header>
      <div className="generate-body">
        <div className="generate-side">
          <TextInput
            label="Output folder"
            description="The template project is written here; existing project files are kept."
            value={state.outputDir}
            placeholder={state.defaultOutputDir}
            disabled={running}
            onChange={(e) => state.setOutputDir(e.currentTarget.value)}
          />
          <Checkbox
            label="Run the baseline check (install, type check, Docker, test packs)"
            checked={state.baseline}
            disabled={running}
            onChange={(e) => state.setBaseline(e.currentTarget.checked)}
          />
          {recipe ? (
            <p className="generate-help">
              {recipe.id} {recipe.version} supplies the complete product and its fixed acceptance.
              No implementation model is needed for its provided features.
            </p>
          ) : (
            <NativeSelect
              label="Fixed acceptance pack"
              description="Reviewed repository suites to register as generated-owned tests. None keeps the project's existing lock."
              value={state.acceptancePack}
              disabled={running}
              data={[
                { value: "", label: "None" },
                ...state.packs.map((pack) => ({ value: pack.id, label: pack.id })),
              ]}
              onChange={(event) => state.setAcceptancePack(event.currentTarget.value)}
            />
          )}
          {pack ? (
            <p className="generate-help">
              {pack.suites
                .map((suite) => `${suite.id} (${suite.acceptanceIds.join(", ")})`)
                .join(", ")}
            </p>
          ) : null}
          {blockedReason && !running ? (
            <p className="generate-warning" role="note">
              <IconAlertTriangle size={14} aria-hidden /> {blockedReason}{" "}
              {errors > 0 ? (
                <Button size="compact-xs" variant="default" onClick={() => setRailTab("findings")}>
                  Show findings
                </Button>
              ) : null}
            </p>
          ) : null}
          <div className="generate-actions">
            {running ? (
              <Button
                variant="default"
                leftSection={<IconPlayerStop size={16} />}
                onClick={() => void state.cancel()}
              >
                Cancel
              </Button>
            ) : (
              <Button
                // The theme's default cyan is too light for white text (axe color-contrast).
                color="cyan.9"
                leftSection={<IconPlayerPlay size={16} />}
                loading={state.starting}
                disabled={!!blockedReason || !state.outputDir.trim()}
                onClick={() => void state.start()}
              >
                {generation ? "Generate again" : "Generate project"}
              </Button>
            )}
          </div>
          {state.error ? (
            <p className="generate-error" role="alert">
              {state.error}
            </p>
          ) : null}
          {generation?.error ? (
            <p className="generate-error" role="alert">
              {generation.error}
            </p>
          ) : null}
          {generation ? <Steps generation={generation} /> : null}
          {generation ? <Checks checks={generation.checks} /> : null}
          {generation ? <Report generation={generation} /> : null}
          {generation ? <AppLinks generation={generation} /> : null}
        </div>
        {generation ? (
          <Log generation={generation} />
        ) : (
          <p className="generate-log generate-log-empty">
            Generate writes a runnable template project for this design: every element as its
            template, wired together with a docker-compose.yml. Agents implement the notes later.
          </p>
        )}
      </div>
    </section>
  );
}
