import { useSyncExternalStore } from "react";
import { formDrafts } from "../project/form-drafts.ts";

export function DraftFeedback({ projectId }: { projectId: string }) {
  useSyncExternalStore(formDrafts.subscribe, formDrafts.snapshot);
  const entries = formDrafts
    .forProject(projectId)
    .filter((entry) => entry.problem || entry.pending);
  if (!entries.length) return null;
  return (
    <div className="studio-draft-feedback">
      {entries.map((entry) => (
        <div key={entry.key} role={entry.problem?.kind === "failed" ? "alert" : "status"}>
          <span>
            {entry.spec.label}: {entry.problem?.message ?? "Saving…"}
          </span>
          {entry.problem?.kind === "failed" ? (
            <button type="button" onClick={() => formDrafts.retry(entry.key)}>
              Retry
            </button>
          ) : null}
          {entry.problem ? (
            <button type="button" onClick={() => formDrafts.discard(entry.key)}>
              {entry.problem.kind === "failed" ? "Discard" : "Dismiss"}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
