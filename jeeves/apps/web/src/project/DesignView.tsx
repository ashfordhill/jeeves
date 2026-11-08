/** Loads the current project into the lane canvas workspace and flushes pending writes on leave. */
import { Button, Loader } from "@mantine/core";
import { useEffect } from "react";
import { Workspace } from "../canvas/Workspace.tsx";
import "./design-view.css";
import { projectFromUrl, useProject } from "./store.ts";

export function DesignView() {
  const status = useProject((s) => s.status);
  const error = useProject((s) => s.error);
  const projectId = useProject((s) => s.loaded?.project.id);
  const open = useProject((s) => s.open);

  useEffect(() => {
    if (useProject.getState().status === "idle") void open(projectFromUrl());
  }, [open]);

  useEffect(() => {
    const flush = () => void useProject.getState().flushEdits();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  if (status === "error") {
    return (
      <div className="empty-view" role="alert">
        <h1>Couldn't load the design</h1>
        <p>{error}</p>
        <Button mt="md" onClick={() => void open(projectFromUrl())}>
          Try again
        </Button>
      </div>
    );
  }
  if (!projectId || status === "loading") {
    return (
      <div className="view-loading" role="status">
        <Loader size="sm" /> Loading design…
      </div>
    );
  }
  return <Workspace key={projectId} />;
}
