import {
  type ArchitectureViewNode,
  type ArchitectureViews,
  acceptanceEvidence,
  type ArchitectureEvidence as Evidence,
  type EvidenceState,
  summarizeArchitectureEvidence,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { useDraw } from "../draw/store.ts";
import { useGenerate } from "../generate/store.ts";
import "./evidence.css";

const labels: Record<EvidenceState, string> = {
  none: "No generation recorded",
  running: "Generation in progress",
  written: "Written · checks not run",
  passed: "Recorded baseline passed",
  incomplete: "Incomplete check evidence",
  failed: "Latest generation failed",
  blocked: "Generation stopped",
  cancelled: "Generation cancelled",
  interrupted: "Generation interrupted",
};
export function evidenceLabel(evidence: Evidence) {
  const summary = summarizeArchitectureEvidence(evidence);
  if (evidence.generation && !summary.revisionMatches)
    return `Earlier evidence · revision ${evidence.generation.revision}`;
  if (evidence.generation && !summary.outputMatches) return "Evidence belongs to another output";
  return labels[summary.state];
}
const layerTitles = {
  infrastructure: "Infrastructure readiness",
  template: "Template conformance",
  application: "Application acceptance",
} as const;
const subjectIn = (subject: string, scope: string) =>
  !scope || subject === scope || subject.startsWith(`${scope}/`);

export function ArchitectureEvidenceDialog({
  evidence,
  views,
  selected,
  loading,
  error,
  onRefresh,
  onClose,
  onBoard,
}: {
  evidence: Evidence;
  views: ArchitectureViews;
  selected?: ArchitectureViewNode;
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onClose: () => void;
  onBoard: () => void;
}) {
  const planning = useDraw((state) => Boolean(state.loaded?.project.target));
  const [tab, setTab] = useState<"checks" | "responsibilities">("checks");
  const [scope, setScope] = useState("");
  const summary = summarizeArchitectureEvidence(evidence),
    record = evidence.generation;
  const checks = (record?.checks ?? []).filter((check) => subjectIn(check.subject, scope));
  const responsibilities = views.components.flatMap((view) =>
    view.nodes
      .flatMap((node) =>
        node.members?.length
          ? [...node.members, ...(node.support === "planned" ? [node] : [])]
          : [node],
      )
      .filter(
        (node) =>
          (node.kind === "component" ||
            (node.kind === "binding" && node.binding?.element === view.container)) &&
          (!scope || node.binding?.element === scope),
      ),
  );
  for (const node of views.containers.nodes) {
    if (
      node.binding &&
      node.kind === "container" &&
      (!scope || node.binding.element === scope) &&
      !views.components.some((view) => view.container === node.binding?.element)
    )
      responsibilities.push(node);
  }
  const readiness =
    record?.stages.filter((stage) =>
      ["env", "install", "typecheck", "compose-up", "compose-down"].includes(stage.id),
    ) ?? [];
  const supplied = responsibilities.filter(
    (node) => node.support === "recipe" || node.support === "template",
  );
  const project = responsibilities.filter(
    (node) =>
      node.support === "extension" ||
      node.support === "intent" ||
      node.support === "planned" ||
      node.support === "mixed",
  );
  const references = acceptanceEvidence(
    selected?.acceptance ?? [],
    record?.omittedChecks ? [] : (record?.checks ?? []),
    selected?.binding?.element,
  );
  const run = evidence.run;
  const runCurrent =
    !!run && run.revision === evidence.revision && run.outputDir === evidence.outputDir;
  const openGenerate = () => {
    useGenerate.getState().setOpen(true);
    onClose();
    onBoard();
  };
  return (
    <ConfigurationDialog
      title="Architecture evidence"
      size="xl"
      onClose={onClose}
      footer={
        <Group justify="space-between">
          <Button variant="default" loading={loading} onClick={onRefresh}>
            Refresh evidence
          </Button>
          <Group gap="xs">
            <Button
              variant="default"
              onClick={() => {
                onClose();
                window.location.hash = "/runs";
              }}
            >
              Open Runs
            </Button>
            <Button color="cyan.9" disabled={planning} onClick={openGenerate}>
              Open Generate
            </Button>
            <Button variant="default" onClick={onClose}>
              Close evidence
            </Button>
          </Group>
        </Group>
      }
    >
      <Stack gap="md">
        {planning ? (
          <Alert color="blue">
            Planning target · no output ownership or inherited evidence. Generation and runs are
            unavailable.
          </Alert>
        ) : null}
        {error ? (
          <Alert color="red" title="Evidence could not refresh">
            {error}
          </Alert>
        ) : null}
        <div className="evidence-overview">
          <span className="evidence-kicker">DESIGN REVISION {evidence.revision}</span>
          <h2>{labels[summary.state]}</h2>
          {record ? (
            <p>
              Generation #{record.id} · revision {record.revision} ·{" "}
              {record.finishedAt
                ? `finished ${new Date(record.finishedAt).toLocaleString()}`
                : `started ${new Date(record.createdAt).toLocaleString()}`}
            </p>
          ) : (
            <p>
              Generate the current design with checks to record evidence. Starter and template
              labels describe supplied behavior.
            </p>
          )}
          {record && !summary.revisionMatches ? (
            <p className="evidence-stale" role="note">
              Stale design evidence: this record is for revision {record.revision}; the current
              design is revision {evidence.revision}.
            </p>
          ) : null}
          {record && !summary.outputMatches ? (
            <p className="evidence-stale" role="note">
              This record belongs to a different output folder.
            </p>
          ) : null}
          {record ? (
            <details>
              <summary>Recorded output folder</summary>
              <code>{record.outputDir}</code>
            </details>
          ) : null}
          <p className="evidence-footnote">
            Recorded results only. Current output files and live deployments are not inspected here.
          </p>
        </div>
        <fieldset className="evidence-tabs" aria-label="Evidence sections">
          <button type="button" aria-pressed={tab === "checks"} onClick={() => setTab("checks")}>
            Recorded checks
          </button>
          <button
            type="button"
            aria-pressed={tab === "responsibilities"}
            onClick={() => setTab("responsibilities")}
          >
            Supplied &amp; project work
          </button>
        </fieldset>
        <NativeSelect
          label="Evidence scope"
          value={scope}
          data={[
            { value: "", label: "Whole project" },
            ...views.containers.nodes
              .filter((node) => node.binding && node.kind === "container")
              .map((node) => ({ value: node.binding!.element, label: node.name })),
          ]}
          onChange={(event) => setScope(event.currentTarget.value)}
        />
        {tab === "checks" ? (
          <>
            <div className="evidence-layer-grid">
              {(Object.keys(layerTitles) as (keyof typeof layerTitles)[]).map((layer) => {
                const items = checks.filter((check) => (check.layer ?? "template") === layer);
                return (
                  <section key={layer} className="evidence-layer" aria-label={layerTitles[layer]}>
                    <h3>{layerTitles[layer]}</h3>
                    {layer === "infrastructure" && readiness.length ? (
                      <>
                        <strong>
                          {readiness.filter((stage) => stage.status === "passed").length} stages
                          passed
                        </strong>
                        <p>
                          Whole project ·{" "}
                          {readiness.filter((stage) => stage.status === "failed").length} failed ·{" "}
                          {readiness.filter((stage) => stage.status === "skipped").length} skipped
                        </p>
                        <details>
                          <summary>Inspect readiness stages</summary>
                          <ul>
                            {readiness.map((stage) => (
                              <li key={stage.id}>
                                <span className="evidence-outcome" data-status={stage.status}>
                                  {stage.status}
                                </span>{" "}
                                {stage.title}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </>
                    ) : null}
                    {items.length ? (
                      <>
                        <strong>
                          {items.filter((item) => item.status === "passed").length} passed
                        </strong>
                        <p>
                          {items.filter((item) => item.status === "failed").length} failed ·{" "}
                          {items.filter((item) => item.status === "skipped").length} skipped
                        </p>
                        <details>
                          <summary>Inspect {items.length} recorded checks</summary>
                          <ul>
                            {items.map((item) => (
                              <li key={`${item.subject}:${item.template}:${item.id}`}>
                                <span className="evidence-outcome" data-status={item.status}>
                                  {item.status}
                                </span>{" "}
                                <strong>{item.title}</strong>
                                <small>
                                  {item.subject} · {item.template}
                                </small>
                                {item.acceptanceIds?.length ? (
                                  <small>{item.acceptanceIds.join(", ")}</small>
                                ) : null}
                                {item.reason ? <p>{item.reason}</p> : null}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </>
                    ) : layer === "infrastructure" && readiness.length ? null : (
                      <p>No recorded checks in this scope.</p>
                    )}
                  </section>
                );
              })}
            </div>
            {record?.omittedChecks || record?.omittedStages ? (
              <Alert color="yellow">
                This bounded view omits {record.omittedChecks} checks and {record.omittedStages}{" "}
                stages. Open Generate for the complete record; no passing verdict is inferred from
                this partial view.
              </Alert>
            ) : null}
            {record?.stages.length ? (
              <details className="evidence-stages">
                <summary>Generation stages · whole project</summary>
                <ul>
                  {record.stages.map((stage) => (
                    <li key={stage.id}>
                      <span className="evidence-outcome" data-status={stage.status}>
                        {stage.status}
                      </span>{" "}
                      {stage.title}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {references.length ? (
              <section className="evidence-references" aria-label="Selected acceptance references">
                <h3>{selected?.name}: declared acceptance</h3>
                <p>
                  Matching application checks in this object's service scope, for the recorded
                  generation.{" "}
                  {record?.omittedChecks
                    ? "The record is truncated; acceptance outcomes are unrecorded in this view."
                    : ""}
                </p>
                <ul>
                  {references.map((reference) => (
                    <li key={reference.id}>
                      <strong>{reference.id}</strong>
                      <span className="evidence-outcome" data-status={reference.status}>
                        {reference.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section className="evidence-run" aria-label="Latest implementation run">
              <h3>Latest implementation run</h3>
              {run ? (
                <>
                  <p>
                    Run #{run.id} · {run.status.replaceAll("_", " ")} · revision{" "}
                    {run.revision ?? "unknown"}
                    {!runCurrent ? " · earlier or different output" : ""}
                  </p>
                  <p>
                    {Object.entries(run.tasks)
                      .map(([status, count]) => `${count} ${status}`)
                      .join(" · ") || "No tasks recorded"}
                  </p>
                  <p className="evidence-footnote">
                    Task status is separate from recorded generation checks. Open Runs for attempt
                    checks and commits.
                  </p>
                </>
              ) : (
                <p>
                  No run recorded. Supplied behavior needs no implementation task; additional domain
                  work stays explicit.
                </p>
              )}
            </section>
          </>
        ) : (
          <>
            <p className="evidence-footnote">
              Responsibilities derive from the current design. An earlier check does not establish
              that a project-owned implementation is complete.
            </p>
            <div className="evidence-responsibilities">
              <section aria-label="Supplied responsibilities">
                <h3>Supplied by generation</h3>
                <ul>
                  {supplied.map((item) => (
                    <li key={item.id}>
                      <strong>{item.name}</strong>
                      <small>
                        {item.technology} · {item.support}
                      </small>
                      <p>{item.description}</p>
                    </li>
                  ))}
                </ul>
                {!supplied.length ? (
                  <Text size="sm">No supplied components in this scope.</Text>
                ) : null}
              </section>
              <section aria-label="Project responsibilities">
                <h3>Project implementation &amp; intent</h3>
                <ul>
                  {project.map((item) => (
                    <li key={item.id}>
                      <strong>{item.name}</strong>
                      <small>{item.technology}</small>
                      <p>{item.description}</p>
                      {item.acceptance.length ? (
                        <small>Required references: {item.acceptance.join(", ")}</small>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {!project.length ? (
                  <Text size="sm">
                    No additional component implementation is declared in this scope.
                  </Text>
                ) : null}
              </section>
            </div>
          </>
        )}
      </Stack>
    </ConfigurationDialog>
  );
}
