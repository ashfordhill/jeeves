/**
 * The Draw view: loads the current project, then shows the board (with its notice strip and
 * hints) and the inspector rail on the right.
 */
import { Button, Loader } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { useEffect } from "react";
import { Canvas } from "./Canvas.tsx";
import "./draw.css";
import { Rail } from "./inspector/Rail.tsx";
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

/** Hint shown while the board is empty, so the first step is obvious. */
function EmptyHint() {
  const empty = useDraw(
    (s) =>
      !!s.loaded &&
      s.loaded.design.elements.length === 0 &&
      s.loaded.design.annotations.length === 0,
  );
  if (!empty) return null;
  return (
    <p className="draw-empty-hint">
      Pick an element from the toolbar, then click the board, or drag it onto the board.
    </p>
  );
}

function PendingHint() {
  const tool = useDraw((s) => s.tool.kind);
  const pending = useDraw((s) => !!s.pendingEnd);
  if (tool !== "connect") return null;
  return (
    <p className="draw-tool-hint" role="status">
      {pending ? "Now click the item to connect to." : "Click the item to connect from."}
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
      <div className="draw-layout">
        <div className="draw-main">
          <Canvas />
          <EmptyHint />
          <PendingHint />
          <NoticeStrip />
        </div>
        <Rail />
      </div>
    </ReactFlowProvider>
  );
}
