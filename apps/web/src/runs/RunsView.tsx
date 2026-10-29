/**
 * Runs (PLAN §10): plan a run on the generated project, review and edit the plan (edit, reorder,
 * remove tasks), then Start, Pause, Resume, or Cancel it, and watch the state of each task.
 * Everything works by mouse; there are no required shortcuts.
 */
import { ActionIcon, Badge, Button, Loader, Textarea, TextInput } from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useId, useState } from "react";
import type {
  Attempt,
  RunAction,
  RunDetail,
  RunStatus,
  RunSummary,
  RunTask,
  Usage,
} from "../draw/api.ts";
import { projectFromUrl, useDraw } from "../draw/store.ts";
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

const statusColors: Record<RunStatus, string> = {
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

const taskColors: Record<RunTask["status"], string> = {
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
    <Badge color={statusColors[status]} variant="light" className="run-badge">
      {statusLabels[status]}
    </Badge>
  );
}

function usageText(usage: Usage | null): string {
  if (!usage?.known) return "unknown";
  return `${usage.inputTokens.toLocaleString()} in / ${usage.outputTokens.toLocaleString()} out`;
}

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
      <span className="runs-list-title">Run {run.id}</span>
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
  const pending = detail.tasks.some((t) => t.status === "pending");
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
              Planning reads the generated project, makes one task per element or attachment with
              implementation notes (databases first, then services, their clients, and frontends),
              and lets the planner model split tasks and add acceptance tests. You can edit the plan
              before starting it.
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
      <PlanSummary detail={detail} />
      {run.status !== "planning" && tasks.length === 0 ? (
        <p className="run-reason">This plan has no tasks.</p>
      ) : null}
      {tasks.length > 0 ? (
        <ol className="run-tasks" aria-label="Tasks">
          {tasks.map((task, index) => (
            <li key={task.id}>
              <TaskCard
                task={task}
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

function PlanSummary({ detail }: { detail: RunDetail }) {
  const { planner } = detail.run;
  if (!planner) return null;
  return (
    <div className="run-plan-summary">
      <p>
        <strong>
          {planner.mode === "refined"
            ? `Refined by the planner (${planner.model})`
            : "Seed plan: one task per element or attachment with notes"}
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
  number,
  editable,
  first,
  last,
  problems,
}: {
  task: RunTask;
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
        <Badge color={taskColors[task.status]} variant="light">
          {task.status === "running" ? <Loader size={10} color="currentColor" /> : null}{" "}
          {taskLabels[task.status]}
        </Badge>
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
        <>
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
        </>
      )}

      {task.attempts.length > 0 ? (
        <ul className="run-task-attempts" aria-label="Attempts">
          {task.attempts.map((attempt) => (
            <li key={attempt.id} data-status={attempt.status}>
              Attempt {attempt.number}: {attemptLabels[attempt.status]}
              {attempt.finishedAt ? ` · ${duration(attempt.startedAt, attempt.finishedAt)}` : ""}
              {attempt.summary ? ` · ${attempt.summary}` : ""}
              {attempt.error ? ` · ${attempt.error}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
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
