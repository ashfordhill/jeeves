/** Read-only recorded evidence. This never inspects files or upgrades a capability to certification. */
export type EvidenceLayer = "infrastructure" | "template" | "application";
export interface RecordedCheck {
  subject: string;
  template: string;
  id: string;
  title: string;
  layer?: EvidenceLayer;
  status: "passed" | "failed" | "skipped";
  acceptanceIds?: string[];
  reason?: string;
}
export interface RecordedStage {
  id: string;
  title: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
}
export interface RecordedGeneration {
  id: number;
  revision: number;
  outputDir: string;
  baseline: boolean;
  status: "running" | "succeeded" | "failed" | "blocked" | "cancelled" | "interrupted";
  createdAt: string;
  finishedAt: string | null;
  stages: RecordedStage[];
  checks: RecordedCheck[];
  /** A bounded response must never hide omitted evidence behind a positive verdict. */
  omittedChecks: number;
  omittedStages: number;
}
export interface RecordedRun {
  id: number;
  revision: number | null;
  outputDir: string;
  status: string;
  updatedAt: string;
  tasks: Record<string, number>;
}
export interface ArchitectureEvidence {
  projectId: string;
  revision: number;
  outputDir: string | null;
  generation: RecordedGeneration | null;
  run: RecordedRun | null;
}
export type EvidenceState =
  | "none"
  | "running"
  | "written"
  | "passed"
  | "incomplete"
  | "failed"
  | "blocked"
  | "cancelled"
  | "interrupted";
export type CheckTotals = { passed: number; failed: number; skipped: number };

/** Latest attempt only. Historical outcomes never become evidence for a different revision/output. */
export function summarizeArchitectureEvidence(evidence: ArchitectureEvidence) {
  const record = evidence.generation;
  const layers: Record<EvidenceLayer, CheckTotals> = {
    infrastructure: { passed: 0, failed: 0, skipped: 0 },
    template: { passed: 0, failed: 0, skipped: 0 },
    application: { passed: 0, failed: 0, skipped: 0 },
  };
  for (const check of record?.checks ?? []) layers[check.layer ?? "template"][check.status]++;
  const revisionMatches = !!record && record.revision === evidence.revision;
  const outputMatches = !!record && record.outputDir === evidence.outputDir;
  let state: EvidenceState =
    record?.status === "succeeded" ? "incomplete" : (record?.status ?? "none");
  if (record?.status === "succeeded") {
    if (
      record.stages.some((stage) => stage.status === "failed") ||
      record.checks.some((check) => check.status === "failed")
    )
      state = "failed";
    else if (!record.baseline) state = "written";
    else {
      const required = [
        "generate",
        "env",
        "install",
        "typecheck",
        "compose-up",
        "test-packs",
        "compose-down",
      ];
      const finished =
        !!record.finishedAt &&
        !record.omittedChecks &&
        !record.omittedStages &&
        record.checks.length > 0 &&
        !record.checks.some(
          (check) => check.layer === "application" && check.status === "skipped",
        ) &&
        required.every((id) =>
          record.stages.some((stage) => stage.id === id && stage.status === "passed"),
        ) &&
        !record.stages.some((stage) => stage.status === "running" || stage.status === "pending");
      if (finished) state = "passed";
    }
  }
  return {
    state,
    revisionMatches,
    outputMatches,
    current: revisionMatches && outputMatches,
    layers,
  };
}

/** Match declared acceptance IDs in their real service scope; never borrow another service's pass. */
export function acceptanceEvidence(ids: string[], checks: RecordedCheck[], service?: string) {
  return [...new Set(ids)].map((id) => {
    const related = checks.filter(
      (check) =>
        check.layer === "application" &&
        check.acceptanceIds?.includes(id) &&
        (!service || check.subject === service || check.subject.startsWith(`${service}/`)),
    );
    const status = related.some((check) => check.status === "failed")
      ? "failed"
      : related.some((check) => check.status === "skipped")
        ? "skipped"
        : related.some((check) => check.status === "passed")
          ? "passed"
          : "unrecorded";
    return { id, status } as const;
  });
}
