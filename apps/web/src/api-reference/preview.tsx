import type { ApiOperation, ApiPreview } from "@jeeves/spec";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { api } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";

type State = { preview?: ApiPreview; error?: string; retry: () => void };
const Preview = createContext<State>({ retry: () => {} });
export function ApiPreviewProvider({ children }: { children: ReactNode }) {
  const loaded = useDraw((s) => s.loaded)!;
  const [result, setResult] = useState<{ project: string; preview: ApiPreview }>();
  const [error, setError] = useState<string>();
  const [attempt, retry] = useState(0);
  const project = loaded.project.id,
    revision = loaded.design.revision;
  useEffect(() => {
    void attempt; // Explicit retry of the same saved revision.
    let active = true;
    setError(undefined);
    api
      .apiPreview(project)
      .then((next) => {
        if (!active) return;
        if (next.revision !== revision) {
          setError("The saved design changed. Reload the design to preview its current revision.");
          return;
        }
        setResult({ project, preview: next });
      })
      .catch((failure: unknown) => {
        if (active)
          setError(failure instanceof Error ? failure.message : "API preview unavailable.");
      });
    return () => {
      active = false;
    };
  }, [project, revision, attempt]);
  return (
    <Preview.Provider
      value={{
        preview:
          result?.project === project && result.preview.revision === revision
            ? result.preview
            : undefined,
        error,
        retry: () => retry((value) => value + 1),
      }}
    >
      {children}
    </Preview.Provider>
  );
}
export const useApiPreview = () => useContext(Preview);

/** A short type label, not a second schema renderer. Full schemas belong to the reference viewer. */
export function schemaLabel(schema: Record<string, unknown>): string {
  if (typeof schema.title === "string") return schema.title;
  const type = Array.isArray(schema.type) ? schema.type.join(" | ") : schema.type;
  return `${typeof type === "string" ? type : "$ref" in schema ? "reference" : "schema"}${typeof schema.format === "string" ? ` (${schema.format})` : ""}`;
}
export function responseSummary(operation: ApiOperation, successOnly = true): string {
  return Object.entries(operation.contract.responses)
    .filter(([code]) => !successOnly || /^[23]/.test(code))
    .map(([code, response]) => {
      const media = Object.entries(response.content ?? {})
        .map(([name, content]) => `${name} · ${schemaLabel(content.schema)}`)
        .join(", ");
      return `${code} · ${media || (/^30[12378]$/.test(code) ? "redirect · no body" : "no body")}`;
    })
    .join(" / ");
}
export function OperationLabel({ operation }: { operation: ApiOperation }) {
  return (
    <>
      <span className="endpoint-line">
        <strong>{operation.method}</strong> {operation.path}
      </span>
      <span className="api-purpose">{operation.purpose}</span>
      <span className="endpoint-response">{responseSummary(operation)}</span>
    </>
  );
}
