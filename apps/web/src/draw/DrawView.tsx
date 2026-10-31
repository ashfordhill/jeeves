/**
 * The Draw view: loads the current project, then shows the board (with its notice strip, hints,
 * and the Generate button and drawer) and the inspector rail on the right.
 */
import { Button, Loader } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { useEffect } from "react";
import { ArchitectureWorkspace } from "../architecture/ArchitectureWorkspace.tsx";
import { Canvas } from "./Canvas.tsx";
import "./draw.css";
import { projectFromUrl, useDraw } from "./store.ts";

function NoticeStrip() {
  const notice = useDraw((s) => s.notice);
  const setNotice = useDraw((s) => s.setNotice);
  const edit = useDraw((s) => s.edit);
  if (!notice) return null;
  return (
    <div
      className="draw-notice"
      data-tone={notice.tone}
      role={notice.tone === "error" ? "alert" : "status"}
    >
      <p className="draw-notice-message">{notice.message}</p>
      {notice.actions?.length ? (
        <div className="draw-notice-actions">
          {notice.actions.map((action) => (
            <Button
              key={action.label}
              size="xs"
              variant="default"
              onClick={() => {
                setNotice(undefined);
                void edit(action.ops);
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="draw-notice-close"
        aria-label="Dismiss"
        onClick={() => setNotice(undefined)}
      >
        <IconX size={16} />
      </button>
    </div>
  );
}

function PendingHint() {
  const tool = useDraw((s) => s.tool.kind);
  const pending = useDraw((s) => !!s.pendingEnd);
  const setTool = useDraw((s) => s.setTool);
  const setNotice = useDraw((s) => s.setNotice);
  if (tool === "select" || tool === "hand") return null;
  return (
    <p className="draw-tool-hint" role="status">
      {tool === "connect"
        ? pending
          ? "Now click the item to connect to."
          : "Click the item to connect from."
        : tool === "attachment"
          ? "Click a service to add the component."
          : `Click empty board space to place ${tool === "element" ? "the selected template" : tool === "planned" ? "the planned capability" : `a ${tool}`}.`}
      <Button
        size="compact-xs"
        variant="default"
        onClick={() => {
          setTool({ kind: "select" });
          setNotice(undefined);
        }}
      >
        Cancel tool
      </Button>
    </p>
  );
}

export function DrawView() {
  const status = useDraw((s) => s.status);
  const error = useDraw((s) => s.error);
  const projectId = useDraw((s) => s.loaded?.project.id);
  const open = useDraw((s) => s.open);

  useEffect(() => {
    if (useDraw.getState().status === "idle") void open(projectFromUrl());
  }, [open]);

  useEffect(() => {
    const flush = () => void useDraw.getState().flushLayout();
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
      <div className="draw-loading" role="status">
        <Loader size="sm" /> Loading design…
      </div>
    );
  }
  return (
    <ReactFlowProvider key={projectId}>
      <ArchitectureWorkspace
        key={projectId}
        board={
          <div className="draw-main">
            <Canvas />
            <PendingHint />
            <NoticeStrip />
          </div>
        }
      />
    </ReactFlowProvider>
  );
}
