import type { DesignDocument, ReadinessTarget } from "@jeeves/spec";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { OwnershipSummary } from "../studio/OwnershipSummary.tsx";

/** The preserved source and its ownership summary are separate from normal generation authoring. */
export function SourceDiagnostics({
  design,
  projectName,
  onTarget,
  onClose,
}: {
  design: DesignDocument;
  projectName: string;
  onTarget: (target: ReadinessTarget) => void;
  onClose: () => void;
}) {
  const source = JSON.stringify(design, null, 2);
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${source}\n`], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${projectName.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 80) || "design"}-r${design.revision}-source.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  return (
    <ConfigurationDialog title="Source & diagnostics" size="lg" onClose={onClose}>
      <div className="source-diagnostics">
        <p>
          Saved schema v{design.schemaVersion} · revision {design.revision}. Read-only: the saved
          source, and who owns and may read each store.
        </p>
        <button type="button" onClick={download}>
          Download source JSON
        </button>
        <OwnershipSummary design={design} onTarget={onTarget} />
        <details>
          <summary>Full saved source</summary>
          <pre>{source}</pre>
        </details>
      </div>
    </ConfigurationDialog>
  );
}
