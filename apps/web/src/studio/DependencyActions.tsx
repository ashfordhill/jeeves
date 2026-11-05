import { buildStudioCommand, type DesignDocument, type StudioViewNode } from "@jeeves/spec";
import { useState } from "react";
import { useDraw } from "../draw/store.ts";
import { applicationKind, type ConnectionDraft, commitAction, endpointKind } from "./actions.ts";

/** Pick a real identity. Reuse never changes another consumer's resource or owner. */
export function DependencyActions({
  projectId,
  design,
  node,
  onCreate,
  onConnection,
}: {
  projectId: string;
  design: DesignDocument;
  node: StudioViewNode;
  onCreate: (draft: ConnectionDraft) => void;
  onConnection: (id: string) => void;
}) {
  const [resource, setResource] = useState("");
  const [problem, setProblem] = useState<string>();
  const ref = node.refs[0];
  if (ref?.kind !== "element" || !applicationKind(endpointKind(design, ref.id))) return null;
  const source = ref.id;
  const settings = design.architecture?.studio?.elements.find(
    (item) => item.element === source,
  )?.settings;
  const choices = design.elements.filter(
    (item) => item.id !== source && endpointKind(design, item.id),
  );
  const use = () => {
    setProblem(undefined);
    const kind = endpointKind(design, resource);
    const lookup =
      settings?.kind === "redirect" && (kind === "database" || kind === "cache")
        ? ({ element: source, resource: kind } as const)
        : undefined;
    const existing = design.connections.filter(
      (item) => item.from.element === source && item.to.element === resource,
    );
    if (existing.length > 1) {
      setProblem(
        lookup
          ? "Several connections exist. Choose the actual connection in Lookup store or Lookup cache above."
          : "Several connections exist. Select the actual connection below.",
      );
      return;
    }
    if (existing.length === 1 && existing[0]) {
      const id = existing[0].id;
      if (lookup)
        void commitAction(projectId, (current) => {
          const binding = current.architecture?.studio?.elements.find(
            (item) => item.element === source,
          );
          if (binding?.settings.kind !== "redirect")
            throw new Error("Redirect changed; reopen its dependencies.");
          return buildStudioCommand(current, {
            type: "edit",
            element: source,
            settings: {
              ...binding.settings,
              [lookup.resource === "database" ? "lookupStoreConnection" : "lookupCacheConnection"]:
                id,
            },
          }).ops;
        }).then((ok) => {
          if (!ok) setProblem(useDraw.getState().notice?.message);
        });
      else onConnection(id);
    } else onCreate({ from: source, to: resource, ...(lookup && { lookup }) });
  };
  return (
    <div className="studio-dependency-actions">
      <button type="button" onClick={() => onCreate({ from: source })}>
        Connect dependency
      </button>
      {choices.length ? (
        <>
          <label className="studio-form-field">
            Use existing service or resource
            <select
              aria-label="Use existing service or resource"
              value={resource}
              onChange={(e) => {
                setResource(e.currentTarget.value);
                setProblem(undefined);
              }}
            >
              <option value="">Select an existing object</option>
              {choices.map((item) => {
                const binding = design.architecture?.studio?.elements.find(
                  (b) => b.element === item.id,
                );
                const owner = binding?.owner;
                const ownerName =
                  owner?.kind === "package"
                    ? design.architecture?.studio?.packages.find((p) => p.id === owner.id)?.name
                    : design.elements.find((e) => e.id === owner?.id)?.name;
                return (
                  <option value={item.id} key={item.id}>
                    {item.name} · {binding?.settings.kind}
                    {ownerName ? ` · Owner: ${ownerName}` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <button type="button" disabled={!resource} onClick={use}>
            {endpointKind(design, resource) === "queue" ? "Publish to queue" : "Use existing"}
          </button>
          {endpointKind(design, resource) === "queue" ? (
            <button type="button" onClick={() => onCreate({ from: resource, to: source })}>
              Consume from queue
            </button>
          ) : null}
        </>
      ) : null}
      {problem ? <p role="alert">{problem}</p> : null}
    </div>
  );
}
