import type { BoardHandle, BoardSnapshot } from "@jeeves/board";
import { designOwnership } from "@jeeves/spec";
import { useEffect, useRef, useState } from "react";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { api } from "../project/api.ts";
import { formDrafts } from "../project/form-drafts.ts";
import { useProject } from "../project/store.ts";
import { capturePng } from "./capturePng.tsx";
import {
  CAPTURE_BACKGROUND,
  CAPTURE_MARGIN,
  CAPTURE_SCALE,
  captureJson,
  sha256,
} from "./diagramCapture.ts";
import { ownerNodeId } from "./ownerProjection.ts";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function ExportDiagram({
  board,
  onDiagnostics,
  onClose,
}: {
  board: { current: BoardHandle | null };
  onDiagnostics: () => void;
  onClose: () => void;
}) {
  const loaded = useProject((state) => state.loaded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [details, setDetails] = useState<{ blob: Blob; filename: string }>();
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  if (!loaded) return null;
  const exportPng = async () => {
    const controller = new AbortController();
    active.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]);
    setBusy(true);
    setError(undefined);
    setDetails(undefined);
    const { design, project } = loaded;
    const source = captureJson(design);
    const assertCurrent = () => {
      signal.throwIfAborted();
      const state = useProject.getState();
      if (
        state.status !== "ready" ||
        state.loaded?.project.id !== project.id ||
        state.loaded.design !== design ||
        state.historyBusy ||
        formDrafts.forProject(project.id).some((draft) => draft.flight || draft.paths.size)
      )
        throw new Error(
          "The project changed or has unsaved edits. Export the settled saved view again.",
        );
    };
    const assertSaved = async () => {
      assertCurrent();
      const saved = await api.getDesign(project.id);
      assertCurrent();
      if (captureJson(saved.design) !== source)
        throw new Error(
          "The saved revision differs from this canvas. Reload the project before exporting.",
        );
    };
    try {
      const work = async () => {
        await assertSaved();
        let snapshot: BoardSnapshot | null = null;
        // A click during ELK/animation waits for that same saved design's settled layout.
        while (!snapshot) {
          assertCurrent();
          snapshot = board.current?.snapshot() ?? null;
          if (!snapshot)
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        const capture = await capturePng(snapshot, signal, assertCurrent);
        await assertSaved();
        const filename = `${project.name.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 80) || "diagram"}-r${design.revision}`;
        const metadata = {
          format: "jeeves-diagram-capture-v1",
          capturedAt: new Date().toISOString(),
          project: { id: project.id, name: project.name, revision: design.revision },
          source: {
            designSha256: await sha256(new TextEncoder().encode(source)),
            hashEncoding: "UTF-8 JSON with recursively sorted object keys; array order preserved",
            schemaVersion: design.schemaVersion,
          },
          renderer: {
            appVersion: __APP_VERSION__,
            commit: __RENDERER_COMMIT__,
            trackedTreeDirtyAtBuild: __RENDERER_DIRTY__,
            mode: import.meta.env.MODE,
            treeVerification: import.meta.env.DEV
              ? "Development server: verify Git identity/tree at capture; HMR can change source after startup."
              : "Git identity recorded at build time; record containing snapshot commit separately.",
            browser: navigator.userAgent,
          },
          image: {
            filename: `${filename}.png`,
            sha256: capture.pngSha256,
            width: capture.width,
            height: capture.height,
            scale: CAPTURE_SCALE,
            margin: CAPTURE_MARGIN,
            background: CAPTURE_BACKGROUND,
            bounds: capture.bounds,
            font: "Nunito Variable",
            embeddedFontCssSha256: capture.fontCssSha256,
          },
          view: {
            relationships: "all projected relationships",
            selection: "omitted",
            camera: "full bounds at 1 board pixel per CSS pixel; interactive camera ignored",
            ownerExpansion: "canonical process tiles",
            owners: designOwnership(design).owners.map((owner) => ({
              id: owner.id,
              name: owner.name,
              requestedExpanded: false,
              fallbackExpanded: false,
              rendered: snapshot.tiles.some((tile) => tile.id === ownerNodeId(owner.id))
                ? "collapsed"
                : "roles",
            })),
          },
          layout: snapshot.layout,
          tiles: snapshot.tiles.map(({ content: _, ...tile }) => tile),
          lines: snapshot.lines.map(({ chip, ...line }) => ({
            ...line,
            ...(chip ? { chip: { w: chip.w, h: chip.h } } : {}),
          })),
        };
        assertCurrent();
        download(capture.blob, `${filename}.png`);
        setDetails({
          blob: new Blob([`${JSON.stringify(metadata, null, 2)}\n`], { type: "application/json" }),
          filename: `${filename}-capture.json`,
        });
      };
      await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
      ]);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          signal.aborted
            ? "PNG export timed out. Wait for the diagram and fonts to finish loading, then try again."
            : error instanceof Error
              ? error.message
              : "PNG export failed. Try again.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (active.current === controller) active.current = null;
    }
  };
  return (
    <ConfigurationDialog title="Export diagram" size="lg" onClose={onClose}>
      <div className="diagram-export-options">
        <p>
          Export the full saved diagram as a light PNG at 2× scale, including offscreen tiles and
          all relationships. Selection is omitted.
        </p>
        <button type="button" disabled={busy} onClick={onDiagnostics}>
          Source & diagnostics
        </button>
        <button type="button" disabled={busy} onClick={() => void exportPng()}>
          {busy ? "Preparing PNG…" : "PNG"}
        </button>
        {busy ? <p role="status">Waiting for the saved revision, layout and fonts…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {details ? (
          <p role="status">
            PNG downloaded.{" "}
            <button type="button" onClick={() => download(details.blob, details.filename)}>
              Download capture details
            </button>{" "}
            records this image’s revision, hash, owner view and resolved layout. Keep source and
            renderer Git identity alongside it for versioned snapshots.
          </p>
        ) : null}
      </div>
    </ConfigurationDialog>
  );
}
