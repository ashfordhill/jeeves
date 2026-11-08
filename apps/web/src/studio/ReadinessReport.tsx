import {
  type DesignDocument,
  designOwnership,
  designReadiness,
  type ReadinessIssue,
  type ReadinessTarget,
} from "@jeeves/spec";
import { useMemo } from "react";

const stages = [
  ["designValidity", "Design validity"],
  ["contractCompleteness", "Exact contracts"],
  ["implementationAvailability", "Implementation availability"],
  ["runtimeEvidence", "Exact output evidence"],
] as const;

/** Read-only disclosure in the existing inspector, over the saved snapshot only. */
export function ReadinessReport({
  design,
  onTarget,
}: {
  design: DesignDocument;
  onTarget: (target: ReadinessTarget) => void;
}) {
  const report = useMemo(() => designReadiness(design), [design]);
  const issue = (item: ReadinessIssue, index: number) => (
    <li key={`${item.code}-${index}`}>
      <p>{item.message}</p>
      <div className="readiness-targets">
        {(["operation", "connection", "element", "owner"] as const).map((kind) => {
          const id = item.target[kind];
          if (!id) return null;
          const name =
            kind === "element"
              ? designOwnership(design).roles.some((role) => role.element === id)
                ? "role"
                : "resource"
              : kind;
          return (
            <button key={kind} type="button" onClick={() => onTarget({ [kind]: id })}>
              Select {name} {id}
            </button>
          );
        })}
      </div>
      {item.target.path?.length ? (
        <small className="readiness-path">{item.target.path.join(".")}</small>
      ) : null}
    </li>
  );
  return (
    <details className="readiness-report" data-composition-sha256={report.composition.sha256}>
      <summary>Compatibility report</summary>
      <p className="studio-field-help">
        Saved snapshot · declarations and implementation evidence are separate.
      </p>
      <dl className="readiness-stages" aria-label="Compatibility stages">
        {stages.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{report[key].status}</dd>
          </div>
        ))}
      </dl>
      <p className="readiness-eligibility">
        Generation eligible: <strong>{report.generationEligible ? "yes" : "no"}</strong>
      </p>
      <p className="studio-field-help">
        No strict contract-compatible product template or evidence registry exists. Experimental
        partial scaffold export is separate; a complete contract does not verify a running output.
      </p>
      {stages.map(([key, label]) => {
        const stage = report[key];
        return stage.blockers.length ? (
          <details key={key} className="readiness-blockers">
            <summary>
              {label} · {stage.blockers.length}{" "}
              {stage.blockers.length === 1 ? "blocker" : "blockers"}
            </summary>
            <ul aria-label={`${label} blockers`}>{stage.blockers.map(issue)}</ul>
          </details>
        ) : null;
      })}
      {report.advisories.length ? (
        <details className="readiness-blockers">
          <summary>Advisories · {report.advisories.length}</summary>
          <ul aria-label="Compatibility advisories">{report.advisories.map(issue)}</ul>
        </details>
      ) : null}
      <details className="readiness-blockers">
        <summary>Composition & limits</summary>
        <p className="studio-field-help">{report.composition.domain}</p>
        <code className="readiness-hash">{report.composition.sha256}</code>
        <ul>
          {report.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </details>
    </details>
  );
}
