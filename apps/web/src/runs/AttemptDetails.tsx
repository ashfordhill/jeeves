/**
 * One attempt's evidence (PLAN §10): the agent's live events and Jeeves's own checks, the files
 * it changed, and the diff. Loaded on demand, and polled while the attempt runs.
 */
import { Loader, Tabs } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { type AttemptDetail, type AttemptEvent, api } from "../draw/api.ts";

const POLL_MS = 1000;

const kindLabels: Record<AttemptEvent["kind"], string> = {
  message: "Agent",
  reasoning: "Thinking",
  command: "Command",
  files: "Files",
  todo: "Plan",
  warning: "Warning",
  step: "Check",
  check: "Check",
  log: "Jeeves",
  git: "Git",
};

export function AttemptDetails({
  projectId,
  runId,
  attemptId,
  running,
}: {
  projectId: string;
  runId: number;
  attemptId: number;
  running: boolean;
}) {
  const [detail, setDetail] = useState<AttemptDetail>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stopped = false;
    const load = () =>
      api
        .attempt(projectId, runId, attemptId)
        .then((d) => {
          if (!stopped) setDetail(d);
        })
        .catch((e: Error) => {
          if (!stopped) setError(e.message);
        });
    void load();
    if (!running)
      return () => {
        stopped = true;
      };
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [projectId, runId, attemptId, running]);

  if (error) return <p className="attempt-error">{error}</p>;
  if (!detail) {
    return (
      <p className="attempt-loading" role="status">
        <Loader size="xs" /> Loading attempt…
      </p>
    );
  }
  const changes = detail.changes ?? [];
  return (
    <div className="attempt-details">
      <Tabs defaultValue="log" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="log">Log ({detail.events.length})</Tabs.Tab>
          <Tabs.Tab value="checks">Checks</Tabs.Tab>
          <Tabs.Tab value="changes">Changes ({changes.length})</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="log">
          <EventLog events={detail.events} follow={running} />
        </Tabs.Panel>
        <Tabs.Panel value="checks">
          <ChecksView detail={detail} />
        </Tabs.Panel>
        <Tabs.Panel value="changes">
          {changes.length > 0 ? (
            <ul className="attempt-files" aria-label="Changed files">
              {changes.map((c) => (
                <li key={c.path}>
                  <span className="attempt-file-status" data-status={c.status}>
                    {c.status}
                  </span>{" "}
                  <code>{c.path}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="run-task-muted">
              {detail.status === "running" ? "Shown when the agent stops." : "No changed files."}
            </p>
          )}
          {detail.diff ? (
            <>
              <h4 className="attempt-diff-heading">Diff against the task's starting commit</h4>
              <Diff text={detail.diff} />
            </>
          ) : null}
          {detail.commit ? (
            <p className="attempt-commit">
              Commit <code>{detail.commit.slice(0, 10)}</code>
            </p>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function EventLog({ events, follow }: { events: AttemptEvent[]; follow: boolean }) {
  const ref = useRef<HTMLOListElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when new events arrive
  useEffect(() => {
    const list = ref.current;
    if (list && follow && atBottom) list.scrollTop = list.scrollHeight;
  }, [events.length, follow, atBottom]);
  if (events.length === 0) return <p className="run-task-muted">Nothing yet.</p>;
  return (
    <ol
      ref={ref}
      className="attempt-log"
      aria-label="Attempt log"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable, so it must take keyboard focus
      tabIndex={0}
      onScroll={(e) => {
        const el = e.currentTarget;
        setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
      }}
    >
      {events.map((event, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the log only grows (or drops its head)
        <li key={index} data-kind={event.kind} data-status={event.status}>
          <span className="attempt-log-time">{(event.t / 1000).toFixed(1)}s</span>
          <span className="attempt-log-kind">{kindLabels[event.kind]}</span>
          <span className="attempt-log-text">{event.text}</span>
        </li>
      ))}
    </ol>
  );
}

function ChecksView({ detail }: { detail: AttemptDetail }) {
  const checks = detail.checks;
  if (!checks) {
    return (
      <p className="run-task-muted">
        {detail.status === "running"
          ? "Jeeves runs its checks when the agent stops."
          : "No checks ran."}
      </p>
    );
  }
  return (
    <div className="attempt-checks">
      {checks.rejectedPaths.length > 0 ? (
        <div className="attempt-rejected" role="note">
          <strong>Outside the task's paths (reverted):</strong>
          <ul>
            {checks.rejectedPaths.map((p) => (
              <li key={p}>
                <code>{p}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="attempt-check" data-status="passed">
          Owned paths: every change is inside the task's paths
        </p>
      )}
      {checks.steps.length > 0 ? (
        <ul className="attempt-steps" aria-label="Check steps">
          {checks.steps.map((s) => (
            <li key={s.step} className="attempt-check" data-status={s.status}>
              {s.title}: {s.status}
              {s.status !== "skipped" ? ` (${(s.durationMs / 1000).toFixed(1)} s)` : ""}
              {s.message ? ` · ${s.message}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {checks.checks.length > 0 ? (
        <ul className="attempt-steps" aria-label="Test-pack checks">
          {checks.checks.map((c) => (
            <li key={`${c.subject}/${c.id}`} className="attempt-check" data-status={c.status}>
              {c.layer === "application" ? "Application acceptance" : "Template conformance"} ·{" "}
              {c.subject}: {c.title}: {c.status}
              {c.acceptanceIds?.length ? ` · ${c.acceptanceIds.join(", ")}` : ""}
              {c.reason ? ` · ${c.reason}` : ""}
              {c.error ? ` · ${c.error}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Diff({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    // A focusable region, so the scrolling diff can be read with the keyboard too.
    // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable, so it must take keyboard focus
    <section className="attempt-diff" aria-label="Diff" tabIndex={0}>
      <pre>
        {lines.map((line, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: static text
            key={index}
            data-line={
              line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ")
                ? "file"
                : line.startsWith("@@")
                  ? "hunk"
                  : line.startsWith("+")
                    ? "add"
                    : line.startsWith("-")
                      ? "del"
                      : undefined
            }
          >
            {line}
            {"\n"}
          </span>
        ))}
      </pre>
    </section>
  );
}
