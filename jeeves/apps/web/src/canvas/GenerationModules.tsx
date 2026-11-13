import { type DesignDocument, moduleStatuses, moduleStatusLabels } from "@jeeves/spec";
import { useMemo } from "react";
import { moduleStatusLine } from "../studio/module-status.ts";

/**
 * Every module and what it generates, in the generator's words (Template, Stub, Custom or Refused,
 * as its report and chat give them; the module page says Generated or You write it), with the
 * template's name or the reason.
 */
export function GenerationModules({ design }: { design: DesignDocument }) {
  const statuses = useMemo(() => moduleStatuses(design), [design]);
  if (!statuses.length) return null;
  const tile = (id: string) => design.elements.find((item) => item.id === id)?.name ?? id;
  return (
    <details open>
      <summary>Modules · {statuses.length}</summary>
      <ul aria-label="Generated modules">
        {statuses.map((status) => {
          const label = moduleStatusLabels[status.status];
          const { detail } = moduleStatusLine(status);
          return (
            <li key={status.module}>
              {status.name} <span className="studio-field-help">in {tile(status.host)}</span>
              <p
                className="lane-module-status"
                data-status={status.status}
                data-family={status.status === "refused" ? "data" : undefined}
              >
                <strong>{label}</strong>
                {detail ? <span>{detail}</span> : null}
              </p>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
