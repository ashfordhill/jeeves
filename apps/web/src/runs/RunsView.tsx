/**
 * Runs (PLAN §10): plan a run on the generated project, review and edit the plan (edit, reorder,
 * remove tasks), then Start, Pause, Resume, or Cancel it, and watch the state of each task.
 * Everything works by mouse; there are no required shortcuts.
 */
import { ActionIcon, Button, Loader, NativeSelect, Textarea, TextInput } from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconGitBranch,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useId, useState } from "react";
import {
  type Attempt,
  api,
  type ExecutionMode,
  type GitStrategy,
  type RunAction,
  type RunDetail,
  type RunSettings,
  type RunStatus,
  type RunSummary,
  type RunTask,
  type Usage,
  type UsageTotals,
} from "../draw/api.ts";
import { projectFromUrl, useDraw } from "../draw/store.ts";
import { StatusBadge, type StatusColor } from "../shell/StatusBadge.tsx";
import { AttemptDetails } from "./AttemptDetails.tsx";
import "./runs.css";
import { isLive, useRuns } from "./store.ts";

const POLL_MS = 1000;

const statusLabels: Record<RunStatus, string> = {
  planning: "Planning…",
  planned: "Planned",
  running: "Running",
  paused: "Paused",
  "needs-attention": "Needs attention",
  waiting_for_provider: "Waiting for provider",
  cancelled: "Cancelled",
  failed: "Failed",
  succeeded: "Succeeded",
};

/** Shade 9, so light badges keep 4.5:1 contrast (axe). */
const statusColors: Record<RunStatus, StatusColor> = {
  planning: "blue",
  planned: "blue",
  running: "cyan",
  paused: "yellow",
  "needs-attention": "orange",
  waiting_for_provider: "grape",
  cancelled: "gray",
  failed: "red",
  succeeded: "teal",
};

const taskLabels: Record<RunTask["status"], string> = {
  pending: "To do",
  running: "Running",
  done: "Done",
  "needs-attention": "Needs attention",
  cancelled: "Cancelled",
};

const taskColors: Record<RunTask["status"], StatusColor> = {
  pending: "gray",
  running: "cyan",
  done: "teal",
  "needs-attention": "orange",
  cancelled: "gray",
};

const attemptLabels: Record<Attempt["status"], string> = {
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  interrupted: "interrupted by a restart",
  cancelled: "cancelled",
};

function RunBadge({ status }: { status: RunStatus }) {
  return (
    <StatusBadge color={statusColors[status]} className="run-badge">
      {statusLabels[status]}
    </StatusBadge>
  );
}

function usageText(usage: Usage | null): string {
  if (!usage) return "unknown";
  const tokens = `${usage.inputTokens.toLocaleString()} in / ${usage.outputTokens.toLocaleString()} out`;
  if (!usage.known) return `${tokens} known; total unknown`;
  return usage.costUsd === undefined ? tokens : `${tokens} · $${usage.costUsd.toFixed(2)}`;
}

const strategyLabels: Record<GitStrategy, string> = {
  "branch-per-task": "Branch per task, merged after checks",
  direct: "Direct: commit each task on the run branch",
};

function duration(from: string, to: string | null): string {
  if (!to) return "";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`;
}

export function RunsView() {
  const projectId = useDraw((s) => s.loaded?.project.id);
  const drawStatus = useDraw((s) => s.status);
  const open = useDraw((s) => s.open);
  const load = useRuns((s) => s.load);
  const refresh = useRuns((s) => s.refresh);
  const live = useRuns((s) => isLive(s.detail));

  // The project is opened by the Draw view; open it here when the app starts on Runs.
  useEffect(() => {
    if (drawStatus === "idle") void open(projectFromUrl());
  }, [drawStatus, open]);

  useEffect(() => {
    if (projectId) void load(projectId);
  }, [projectId, load]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [live, refresh]);

  if (!projectId) {
    return (
      <div className="draw-loading" role="status">
        <Loader size="sm" /> Loading project…
      </div>
    );
  }
  return (
    <div className="runs-view">
      <RunList />
      <RunPanel />
    </div>
  );
}

function RunList() {
  const overview = useRuns((s) => s.overview);
  const selectedId = useRuns((s) => s.selectedId);
  const busy = useRuns((s) => s.busy);
  const plan = useRuns((s) => s.plan);
  const select = useRuns((s) => s.select);
  const active = overview?.runs.find(
    (r) => !["cancelled", "failed", "succeeded"].includes(r.status),
  );
  const readiness = overview?.readiness;
  const hint = !readiness
    ? undefined
    : !readiness.ready
      ? readiness.reason
      : active
        ? `Run ${active.id} is ${statusLabels[active.status].toLowerCase()}. Finish or cancel it before planning another.`
        : `Plans the project in ${readiness.outputDir}.`;
  return (
    <aside className="runs-sidebar" aria-labelledby="runs-heading">
      <h1 id="runs-heading" className="runs-heading">
        Runs
      </h1>
      <Button
        color="cyan.9"
        leftSection={<IconPlayerPlay size={16} aria-hidden />}
        disabled={!readiness?.ready || !!active || busy}
        onClick={() => void plan()}
      >
        Plan a run
      </Button>
      {hint ? <p className="runs-hint">{hint}</p> : null}
      {overview?.implementation ? (
        <section aria-label="Project implementation usage">
          <strong>Cumulative implementation</strong>
          <UsageSummary usage={overview.implementation} />
          <p className="runs-hint">
            Initial build and feature runs, including failures and planning. Design chat excluded.
          </p>
        </section>
      ) : null}
      <details>
        <summary>New run settings</summary>
        <RunSettingsForm />
      </details>
      {overview && overview.runs.length > 0 ? (
        <ul className="runs-list" aria-label="All runs">
          {overview.runs.map((run) => (
            <li key={run.id}>
              <RunListItem
                run={run}
                selected={run.id === selectedId}
                onSelect={() => void select(run.id)}
              />
            </li>
          ))}
        </ul>
      ) : overview ? (
        <p className="runs-hint">No runs yet.</p>
      ) : null}
    </aside>
  );
}

/** The project's git strategy and retry limit, used by runs planned from now on. */
function RunSettingsForm() {
  const projectId = useRuns((s) => s.projectId);
  const [settings, setSettings] = useState<RunSettings>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!projectId) return;
    setSettings(undefined);
    api.runSettings(projectId).then(setSettings, (e: Error) => setError(e.message));
  }, [projectId]);
  if (!projectId || !settings) return null;
  const save = async (patch: Partial<RunSettings>) => {
    setError(undefined);
    try {
      setSettings(await api.saveRunSettings(projectId, patch));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="runs-settings" aria-labelledby="runs-settings-heading">
      <h2 id="runs-settings-heading">For new runs</h2>
      <NativeSelect
        label="Git strategy"
        value={settings.gitStrategy}
        data={(Object.keys(strategyLabels) as GitStrategy[]).map((value) => ({
          value,
          label: strategyLabels[value],
        }))}
        onChange={(e) => void save({ gitStrategy: e.currentTarget.value as GitStrategy })}
      />
      <NativeSelect
        label="Retries after a failed attempt"
        value={String(settings.maxRetries)}
        data={["0", "1", "2", "3", "4", "5"]}
        onChange={(e) => void save({ maxRetries: Number(e.currentTarget.value) })}
      />
      {error ? <p className="run-task-problem">{error}</p> : null}
    </section>
  );
}

function RunListItem({
  run,
  selected,
  onSelect,
}: {
  run: RunSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="runs-list-item"
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
    >
      <span className="runs-list-title">
        Run {run.id} ·{" "}
        {run.kind === "feature"
          ? "Feature"
          : run.kind === "initial-build"
            ? "Initial build"
            : "Legacy"}
      </span>
      <RunBadge status={run.status} />
      <span className="runs-list-meta">
        {run.doneCount}/{run.taskCount} tasks · {new Date(run.createdAt).toLocaleString()}
      </span>
    </button>
  );
}

const actionButtons: Record<
  RunAction,
  { label: string; icon: typeof IconPlayerPlay; color?: string; variant?: string }
> = {
  start: { label: "Start", icon: IconPlayerPlay, color: "cyan.9" },
  resume: { label: "Resume", icon: IconPlayerPlay, color: "cyan.9" },
  pause: { label: "Pause", icon: IconPlayerPause, variant: "default" },
  replan: { label: "Plan again", icon: IconRefresh, variant: "default" },
  cancel: { label: "Cancel run", icon: IconX, variant: "default" },
};

function RunActions({ detail }: { detail: RunDetail }) {
  const busy = useRuns((s) => s.busy);
  const act = useRuns((s) => s.act);
  const [confirming, setConfirming] = useState(false);
  const pending = detail.tasks.some(
    (t) => t.status === "pending" || t.status === "needs-attention",
  );
  if (confirming) {
    return (
      <div className="run-actions">
        <span className="run-confirm">Cancel this run? Tasks not done yet won't run.</span>
        <Button
          color="red.8"
          disabled={busy}
          onClick={() => {
            setConfirming(false);
            void act("cancel");
          }}
        >
          Yes, cancel run
        </Button>
        <Button variant="default" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    );
  }
  return (
    <div className="run-actions">
      {detail.actions.map((action) => {
        const { label, icon: Icon, color, variant } = actionButtons[action];
        const needsTasks = (action === "start" || action === "resume") && !pending;
        return (
          <Button
            key={action}
            color={color}
            variant={variant ?? "filled"}
            leftSection={<Icon size={16} aria-hidden />}
            disabled={busy || needsTasks}
            onClick={() => (action === "cancel" ? setConfirming(true) : void act(action))}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

function RunPanel() {
  const detail = useRuns((s) => s.detail);
  const selectedId = useRuns((s) => s.selectedId);
  const error = useRuns((s) => s.error);
  const clearError = useRuns((s) => s.clearError);
  const overview = useRuns((s) => s.overview);

  const errorBox = error ? (
    <div className="run-error" role="alert">
      <span>{error}</span>
      <ActionIcon variant="subtle" color="red.9" aria-label="Dismiss" onClick={clearError}>
        <IconX size={16} />
      </ActionIcon>
    </div>
  ) : null;

  if (!detail || detail.run.id !== selectedId) {
    return (
      <section className="run-panel" aria-label="Run">
        {errorBox}
        {selectedId !== undefined ? (
          <div className="draw-loading" role="status">
            <Loader size="sm" /> Loading run…
          </div>
        ) : overview ? (
          <div className="run-empty">
            <h2>Nothing planned yet</h2>
            <p>
              Generate standard capabilities, then plan the remaining extensions and frontend work.
              Review the tasks and execution mode before Start.
            </p>
          </div>
        ) : null}
      </section>
    );
  }

  const { run, tasks } = detail;
  const canEdit = detail.editable;
  const problems = new Map<number, string[]>();
  for (const p of detail.orderProblems) {
    problems.set(p.taskId, [...(problems.get(p.taskId) ?? []), p.message]);
  }
  const pendingIds = tasks.filter((t) => t.status === "pending").map((t) => t.id);
  return (
    <section className="run-panel" aria-labelledby="run-heading">
      {errorBox}
      <header className="run-header">
        <h2 id="run-heading">Run {run.id}</h2>
        <span role="status" aria-label="Run status">
          <RunBadge status={run.status} />
        </span>
        <RunActions detail={detail} />
      </header>
      {run.statusReason ? <p className="run-reason">{run.statusReason}</p> : null}
      <RunOverview detail={detail} />
      {run.warnings.length > 0 ? (
        <ul className="run-warnings" aria-label="Warnings">
          {run.warnings.map((w) => (
            <li key={w}>
              <IconAlertTriangle size={16} aria-hidden /> {w}
            </li>
          ))}
        </ul>
      ) : null}
      {run.status === "planning" ? (
        <p className="run-planning" role="status">
          <Loader size="xs" /> Planning: reading the project and asking the planner…
        </p>
      ) : null}
      <details>
        <summary>Plan and Git details</summary>
        <PlanSummary detail={detail} />
        <GitSummary detail={detail} />
      </details>
      <RunEvidence detail={detail} />
      {run.status !== "planning" && tasks.length === 0 ? (
        <p className="run-reason">This plan has no tasks.</p>
      ) : null}
      {tasks.length > 0 ? (
        <ol className="run-tasks" aria-label="Tasks">
          {tasks.map((task, index) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                usage={detail.taskUsage?.[task.id]}
                number={index + 1}
                editable={canEdit && task.status === "pending"}
                first={pendingIds[0] === task.id}
                last={pendingIds.at(-1) === task.id}
                problems={problems.get(task.id) ?? []}
              />
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function UsageSummary({ usage }: { usage: UsageTotals }) {
  if (usage.records === 0)
    return <p className="run-usage">No implementation usage yet. Cost unknown.</p>;
  return (
    <p className="run-usage">
      {usage.inputTokens.toLocaleString()} input / {usage.outputTokens.toLocaleString()} output
      tokens known · token coverage {usage.tokenRecords}/{usage.records} records
      {usage.known ? "" : "; total unknown"}
      <br />
      Cost {usage.costRecords ? `$${usage.knownCostUsd.toFixed(4)} known` : "unknown"} · cost
      coverage {usage.costRecords}/{usage.records} records
    </p>
  );
}

function RunOverview({ detail }: { detail: RunDetail }) {
  const mode = useRuns((s) => s.mode);
  const busy = useRuns((s) => s.busy);
  const { run, tasks } = detail;
  const completed = tasks.filter((t) => t.status === "done").length;
  const current = tasks.find((t) => t.status === "running");
  return (
    <section className="run-overview" aria-label="Implementation progress">
      <p>
        <strong>
          {completed}/{tasks.length} tasks verified
        </strong>{" "}
        · {duration(run.createdAt, run.finishedAt ?? new Date().toISOString())} elapsed ·{" "}
        {run.kind === "feature"
          ? "Feature run"
          : run.kind === "initial-build"
            ? "Initial build"
            : "Legacy run"}
      </p>
      <progress aria-label="Verified tasks" value={completed} max={Math.max(1, tasks.length)} />
      <p>
        {current
          ? `Working on ${current.title}`
          : run.status === "planning"
            ? "Preparing tasks"
            : run.status === "planned"
              ? "Ready to review and start"
              : statusLabels[run.status]}
      </p>
      {detail.activity ? <p className="run-activity">{detail.activity}</p> : null}
      {detail.implementation ? <UsageSummary usage={detail.implementation} /> : null}
      <p>
        Coding model:{" "}
        <strong>
          {detail.coding
            ? `${detail.coding.provider} / ${detail.coding.model || "provider default"}`
            : "unavailable"}
        </strong>
        . Design model is selected separately in Settings.
      </p>
      <NativeSelect
        label="Execution mode"
        value={run.executionMode ?? "continuous"}
        disabled={busy || !detail.editable || tasks.some((t) => t.status === "running")}
        data={[
          { value: "continuous", label: "Continuous" },
          { value: "review-after-task", label: "Review after each task" },
        ]}
        onChange={(e) => void mode(e.currentTarget.value as ExecutionMode)}
      />
      <p className="runs-hint">
        Continuous continues after verified tasks and stops on problems. Review mode pauses after
        verification and commit; Resume continues with the next task.
      </p>
      <details open={!run.startedAt}>
        <summary>Capabilities and verification</summary>
        <h3>Generated capabilities</h3>
        {detail.capabilities?.length ? (
          <ul>
            {detail.capabilities.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : (
          <p>Template infrastructure and configured connections.</p>
        )}
        <p>
          {tasks.filter((t) => t.status === "pending").length} remaining extension or frontend
          tasks.
        </p>
        <h3>Verification layers</h3>
        <p>
          Infrastructure readiness → template conformance → application acceptance. Required fixed
          checks run independently; deferred checks never count as passes.
        </p>
      </details>
    </section>
  );
}

function RunEvidence({ detail }: { detail: RunDetail }) {
  const addNote = useRuns((s) => s.note);
  const busy = useRuns((s) => s.busy);
  const [note, setNote] = useState("");
  const { run } = detail;
  return (
    <details className="run-evidence">
      <summary>Usage ledger, provenance and human help</summary>
      <p>
        Generated design revision {run.designRevision ?? "unknown"} · parent run{" "}
        {run.parentRunId ?? "none"}
      </p>
      {run.evidence ? (
        <>
          <p>
            Design hash <code>{run.evidence.designHash}</code>
          </p>
          <p>
            Starting Git revision <code>{run.evidence.startingCommit ?? "unknown"}</code>
          </p>
          <p>Templates: {run.evidence.templates.join(", ")}</p>
          <p>
            Planned coding selection:{" "}
            {run.evidence.coding
              ? `${run.evidence.coding.provider} / ${run.evidence.coding.model}`
              : "unknown"}
            . Each attempt records its actual selection.
          </p>
        </>
      ) : (
        <p>Historical provenance was not recorded.</p>
      )}
      <ul aria-label="Implementation ledger">
        {detail.ledger?.map((entry) => (
          <li key={entry.id}>
            <details>
              <summary>
                {entry.kind} · {entry.taskKey ?? "run"} · {entry.status} ·{" "}
                {entry.provider ?? "unknown provider"} / {entry.model ?? "unknown model"} ·{" "}
                {usageText(entry.usage)}
              </summary>
              <p>
                {duration(entry.startedAt, entry.finishedAt)} elapsed · attempt{" "}
                {entry.attemptId ?? "none"}
              </p>
              <pre>
                {entry.request
                  ? JSON.stringify(entry.request, null, 2)
                  : "Historical request unavailable."}
              </pre>
            </details>
          </li>
        ))}
      </ul>
      <ul aria-label="Human interventions">
        {run.interventions?.map((entry, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: persisted interventions are append-only
          <li key={`${entry.at}-${index}`}>
            {new Date(entry.at).toLocaleString()} · {entry.action}: {entry.note}
          </li>
        ))}
      </ul>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (note.trim() && (await addNote(note.trim()))) setNote("");
        }}
      >
        <Textarea
          label="Human help or review note"
          value={note}
          maxLength={4000}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Button type="submit" disabled={busy || !note.trim()}>
          Record note
        </Button>
      </form>
    </details>
  );
}

function GitSummary({ detail }: { detail: RunDetail }) {
  const { run } = detail;
  const branch = detail.tasks.find((t) => t.workspace)?.workspace?.runBranch;
  return (
    <p className="run-git">
      <IconGitBranch size={16} aria-hidden /> {strategyLabels[run.gitStrategy]} · up to{" "}
      {run.maxRetries} {run.maxRetries === 1 ? "retry" : "retries"} per task ·{" "}
      {branch ? (
        <>
          work goes to <code>{branch}</code> in <code>{run.outputDir}</code>
        </>
      ) : (
        <>
          work will go to <code>jeeves/run-{run.id}</code> in <code>{run.outputDir}</code>
        </>
      )}
    </p>
  );
}

function PlanSummary({ detail }: { detail: RunDetail }) {
  const { planner } = detail.run;
  if (!planner) return null;
  return (
    <div className="run-plan-summary">
      <p>
        <strong>
          {planner.mode === "refined"
            ? `Refined by the planner (${planner.model})`
            : "Deterministic task plan"}
        </strong>
        {planner.message ? ` · ${planner.message}` : null}
      </p>
      <p className="run-usage">
        Tokens: planner {planner.model ? usageText(detail.usage.planner) : "not used"} · tasks{" "}
        {detail.tasks.some((t) => t.attempts.length > 0)
          ? usageText(detail.usage.attempts)
          : "none yet"}
      </p>
    </div>
  );
}

function TaskCard({
  task,
  usage,
  number,
  editable,
  first,
  last,
  problems,
}: {
  task: RunTask;
  usage?: UsageTotals;
  number: number;
  editable: boolean;
  first: boolean;
  last: boolean;
  problems: string[];
}) {
  const busy = useRuns((s) => s.busy);
  const moveTask = useRuns((s) => s.moveTask);
  const removeTask = useRuns((s) => s.removeTask);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const titleId = useId();
  const target = task.attachment ? `${task.element} · ${task.attachment}` : task.element;

  return (
    <article className="run-task" data-status={task.status} aria-labelledby={titleId}>
      <header className="run-task-header">
        <span className="run-task-number" aria-hidden>
          {number}
        </span>
        <h3 id={titleId} className="run-task-title">
          {task.title}
        </h3>
        <code className="run-task-target" title="Element (and attachment) this task implements">
          {target}
        </code>
        <StatusBadge color={taskColors[task.status]}>
          {task.status === "running" ? <Loader size={10} color="currentColor" /> : null}{" "}
          {taskLabels[task.status]}
        </StatusBadge>
        {task.edited ? <span className="run-task-tag">edited</span> : null}
        {editable && !editing ? (
          <span className="run-task-tools">
            <ActionIcon
              variant="subtle"
              color="dark"
              aria-label={`Move "${task.title}" up`}
              disabled={busy || first}
              onClick={() => void moveTask(task.id, -1)}
            >
              <IconArrowUp size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="dark"
              aria-label={`Move "${task.title}" down`}
              disabled={busy || last}
              onClick={() => void moveTask(task.id, 1)}
            >
              <IconArrowDown size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="dark"
              aria-label={`Edit "${task.title}"`}
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              <IconPencil size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red.9"
              aria-label={`Remove "${task.title}"`}
              disabled={busy}
              onClick={() => setRemoving(true)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </span>
        ) : null}
      </header>

      {removing ? (
        <div className="run-task-confirm">
          <span>Remove this task from the plan?</span>
          <Button
            size="xs"
            color="red.8"
            disabled={busy}
            onClick={() => {
              setRemoving(false);
              void removeTask(task.id);
            }}
          >
            Remove task
          </Button>
          <Button size="xs" variant="default" onClick={() => setRemoving(false)}>
            Keep it
          </Button>
        </div>
      ) : null}

      {problems.map((p) => (
        <p key={p} className="run-task-problem">
          <IconAlertTriangle size={14} aria-hidden /> {p}
        </p>
      ))}

      {editing ? (
        <TaskForm task={task} onDone={() => setEditing(false)} />
      ) : (
        <details className="task-description">
          <summary>Task details</summary>
          <p className="run-task-description">{task.description}</p>
          <div className="run-task-section">
            <h4>Acceptance tests</h4>
            {task.acceptance.length > 0 ? (
              <ul>
                {task.acceptance.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : (
              <p className="run-task-muted">None yet. Edit the task to add some.</p>
            )}
          </div>
          <p className="run-task-paths">
            May change:{" "}
            {task.ownedPaths.map((p) => (
              <code key={p}>{p}</code>
            ))}
          </p>
        </details>
      )}
      {usage && usage.records > 0 ? <UsageSummary usage={usage} /> : null}

      {task.commit ? (
        <p className="run-task-paths">
          Committed <code>{task.commit.slice(0, 10)}</code>
        </p>
      ) : null}

      {task.attempts.length > 0 ? (
        <ul className="run-task-attempts" aria-label="Attempts">
          {task.attempts.map((attempt) => (
            <AttemptRow key={attempt.id} attempt={attempt} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function AttemptRow({ attempt }: { attempt: Attempt }) {
  const projectId = useRuns((s) => s.projectId);
  const runId = useRuns((s) => s.selectedId);
  const running = attempt.status === "running";
  const [open, setOpen] = useState(false);
  const Chevron = open ? IconChevronDown : IconChevronRight;
  return (
    <li data-status={attempt.status}>
      <button
        type="button"
        className="attempt-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Chevron size={14} aria-hidden />
        Attempt {attempt.number}: {attemptLabels[attempt.status]}
        {running ? <Loader size={10} color="currentColor" /> : null}
      </button>
      {attempt.finishedAt ? ` · ${duration(attempt.startedAt, attempt.finishedAt)}` : ""}
      {attempt.usage ? ` · ${usageText(attempt.usage)} tokens` : ""}

      {attempt.error ? <span className="attempt-error-text"> · {attempt.error}</span> : null}
      {open && projectId && runId !== undefined ? (
        <AttemptDetails
          projectId={projectId}
          runId={runId}
          attemptId={attempt.id}
          running={running}
        />
      ) : null}
    </li>
  );
}

function TaskForm({ task, onDone }: { task: RunTask; onDone: () => void }) {
  const busy = useRuns((s) => s.busy);
  const editTask = useRuns((s) => s.editTask);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [acceptance, setAcceptance] = useState(task.acceptance.join("\n"));
  const lines = acceptance
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const valid = title.trim().length > 0 && description.trim().length > 0;
  return (
    <form
      className="run-task-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid) return;
        const saved = await editTask(task.id, {
          title: title.trim(),
          description: description.trim(),
          acceptance: lines,
        });
        if (saved) onDone();
      }}
    >
      <TextInput
        label="Title"
        value={title}
        maxLength={200}
        error={title.trim() ? undefined : "Enter a title."}
        onChange={(e) => setTitle(e.currentTarget.value)}
      />
      <Textarea
        label="Description"
        autosize
        minRows={2}
        maxRows={10}
        value={description}
        error={description.trim() ? undefined : "Describe the task."}
        onChange={(e) => setDescription(e.currentTarget.value)}
      />
      <Textarea
        label="Acceptance tests"
        description="One per line."
        autosize
        minRows={2}
        maxRows={10}
        value={acceptance}
        onChange={(e) => setAcceptance(e.currentTarget.value)}
      />
      <div className="run-task-form-actions">
        <Button type="submit" size="xs" color="cyan.9" disabled={!valid || busy}>
          Save task
        </Button>
        <Button size="xs" variant="default" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
