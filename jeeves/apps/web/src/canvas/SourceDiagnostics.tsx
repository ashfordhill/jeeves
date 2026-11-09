import { type DesignDocument, designScope, type ReadinessTarget } from "@jeeves/spec";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { OperationsSummary } from "../studio/OperationsSummary.tsx";
import { OwnershipSummary } from "../studio/OwnershipSummary.tsx";
import { ReadinessReport } from "../studio/ReadinessReport.tsx";

/** Preserved source and strict reports are separate from normal generation authoring. */
export function SourceDiagnostics({
  design,
  projectName,
  selectedOperation,
  onTarget,
  onClose,
}: {
  design: DesignDocument;
  projectName: string;
  selectedOperation?: string;
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
          Saved schema v{design.schemaVersion} · revision {design.revision}. These read-only
          declarations retain custom and historical intent. The strict TinyURL report is separate
          from experimental template support and runtime verification.
        </p>
        <button type="button" onClick={download}>
          Download source JSON
        </button>
        <ReadinessReport design={design} onTarget={onTarget} />
        <OwnershipSummary design={design} onTarget={onTarget} />
        <OperationsSummary
          design={design}
          onTarget={onTarget}
          selectedBinding={selectedOperation}
        />
        <details>
          <summary>Profile & requirements</summary>
          <pre>{JSON.stringify(designScope(design), null, 2)}</pre>
        </details>
        <details>
          <summary>Full saved source</summary>
          <pre>{source}</pre>
        </details>
      </div>
    </ConfigurationDialog>
  );
}
