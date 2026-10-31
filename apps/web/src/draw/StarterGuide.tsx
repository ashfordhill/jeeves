import { type WorkspaceBinding, workspaceBindings } from "@jeeves/spec";
import { Button } from "@mantine/core";
import { useState } from "react";
import { useGenerate } from "../generate/store.ts";
import { useDraw } from "./store.ts";

/** Provenance is an origin; next steps always use the current diagram. */
export function StarterGuide({ onArchitecture }: { onArchitecture: () => void }) {
  const loaded = useDraw((state) => state.loaded);
  const [dismissed, setDismissed] = useState(false);
  if (!loaded?.design.startedFrom || dismissed) return null;
  const origin = loaded.design.startedFrom;
  let bindings: [string, WorkspaceBinding][] = [];
  try {
    bindings = Object.entries(workspaceBindings(loaded.design));
  } catch {
    // An edited draft can be incomplete. The inspector/findings remain authoritative.
  }
  const first = bindings[0];
  const inspect = (id: string) => {
    useDraw.getState().setTool({ kind: "select" });
    useDraw.getState().focus({ nodes: [id] }, { zoom: true });
  };
  return (
    <section className="starter-guide" aria-label="Starter next steps">
      <div>
        <strong>Your architecture, ready to shape</strong>
        <small>
          Started from {origin.id} {origin.version} · editable copy
        </small>
      </div>
      <p>
        Review the people and responsibilities, shape your records and screens, then generate and
        check the app.
      </p>
      <div className="starter-guide-actions">
        <Button size="compact-xs" variant="default" onClick={onArchitecture}>
          Review C4 context
        </Button>
        {first ? (
          <>
            <Button size="compact-xs" variant="default" onClick={() => inspect(first[1].service)}>
              Inspect resources
            </Button>
            <Button size="compact-xs" variant="default" onClick={() => inspect(first[0])}>
              Inspect workspace
            </Button>
          </>
        ) : null}
        <Button
          size="compact-xs"
          color="cyan.9"
          onClick={() => useGenerate.getState().setOpen(true)}
        >
          Generate app
        </Button>
        <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setDismissed(true)}>
          Dismiss guide
        </Button>
      </div>
    </section>
  );
}
