import { type DesignDocument, moduleStatuses } from "@jeeves/spec";
import { useMemo } from "react";
import { moduleStatusLine } from "../studio/module-status.ts";

/** Every module and what it generates: Template, Stub, Custom or Refused, with the reason. */
export function GenerationModules({ design }: { design: DesignDocument }) {
  const statuses = useMemo(() => moduleStatuses(design), [design]);
  if (!statuses.length) return null;
  const tile = (id: string) => design.elements.find((item) => item.id === id)?.name ?? id;
  return (
    <details open>
      <summary>Modules · {statuses.length}</summary>
      <ul aria-label="Generated modules">
        {statuses.map((status) => {
          const { label, detail } = moduleStatusLine(status);
          return (
            <li key={status.module}>
              {status.name} <span className="studio-field-help">in {tile(status.host)}</span>
              <p className="lane-module-status" data-status={status.status}>
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
